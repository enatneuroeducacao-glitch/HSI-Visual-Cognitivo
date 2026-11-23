import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { questions } from './question-bank.js';
import { scoreDothp } from './instrument-scoring.js';
import { hasRole, validateAssessmentMode } from './security.js';

async function sendPasswordResetEmail(to: string, rawToken: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.MAIL_FROM;
  if (!apiKey || !senderEmail) throw new Error('BREVO_EMAIL_NOT_CONFIGURED');

  const base = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const resetUrl = base + '/reset-password.html?token=' + encodeURIComponent(rawToken);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'HSI — Suporte', email: senderEmail },
      to: [{ email: to }],
      subject: 'Redefinição de senha — HSI Visual Cognitivo',
      textContent: 'Recebemos uma solicitação para redefinir sua senha. Acesse o link seguro: ' + resetUrl + '\n\nO link expira em 30 minutos e só pode ser utilizado uma vez. Se você não solicitou esta alteração, ignore esta mensagem.',
      htmlContent: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17233b"><h2>Redefinição de senha</h2><p>Recebemos uma solicitação para redefinir a senha da sua conta HSI.</p><p><a href="' + resetUrl + '" style="display:inline-block;padding:12px 20px;background:#5865d9;color:#fff;text-decoration:none;border-radius:8px">Criar nova senha</a></p><p>O link expira em 30 minutos e só pode ser utilizado uma vez.</p><p>Se você não solicitou esta alteração, ignore esta mensagem.</p><small>HSI Visual Cognitivo · ENAT</small></div>'
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Brevo transactional email failed:', response.status, detail.slice(0, 500));
    throw new Error('BREVO_EMAIL_SEND_FAILED');
  }
}


const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!process.env.DATABASE_URL || !JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('DATABASE_URL e JWT_SECRET (mínimo 32 caracteres) são obrigatórios.');
}

app.set('trust proxy', 1);
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); cb(new Error('Origem não autorizada')); }, credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));

type AuthUser = { id: string; name: string; email: string; role: UserRole; status: UserStatus; participantCode: string | null; groupId: string | null };
declare global { namespace Express { interface Request { authUser?: AuthUser } } }

const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);
const publicUser = (u: AuthUser) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, participantCode: u.participantCode, groupId: u.groupId });

const authenticate = asyncRoute(async (req, res, next) => {
  const raw = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!raw) return res.status(401).json({ error: 'Autenticação necessária.' });
  try {
    const payload = jwt.verify(raw, JWT_SECRET!, { issuer: 'hsi-visual-cognitivo', algorithms: ['HS256'] }) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) return res.status(401).json({ error: 'Sessão inválida ou usuário inativo.' });
    req.authUser = user as AuthUser;
    next();
  } catch { return res.status(401).json({ error: 'Sessão expirada ou inválida.' }); }
});
const allow = (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) =>
  hasRole(req.authUser?.role, roles) ? next() : res.status(403).json({ error: 'Você não tem permissão para esta operação.' });

const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });
app.get('/api/health', asyncRoute(async (_req, res) => { await prisma.$queryRawUnsafe('SELECT 1'); res.json({ status: 'ok', database: 'connected', service: 'hsi-visual-cognitivo-api', timestamp: new Date().toISOString() }); }));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Informe e-mail e senha válidos.' });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || user.status !== UserStatus.ACTIVE || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }
  const token = jwt.sign({}, JWT_SECRET!, { subject: user.id, expiresIn: '30m', issuer: 'hsi-visual-cognitivo' });
  await prisma.auditLog.create({ data: { actorId: user.id, action: 'AUTH_LOGIN', targetType: 'USER', targetId: user.id } });
  return res.json({ token, expiresIn: 1800, user: publicUser(user as AuthUser) });
}));


const selfRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200)
}).strict();

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const parsed = selfRegistrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Informe nome, e-mail válido e senha com pelo menos 12 caracteres.' });
  const data = parsed.data;
  const email = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Este e-mail já possui uma conta. Entre ou utilize a recuperação de senha.' });
  try {
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash: await bcrypt.hash(data.password, 12),
        role: UserRole.PARTICIPANT,
        status: UserStatus.ACTIVE
      },
      select: { id:true,name:true,email:true,role:true,status:true,participantCode:true,groupId:true }
    });
    await prisma.auditLog.create({ data: { actorId: user.id, action: 'AUTH_SELF_REGISTER', targetType: 'USER', targetId: user.id } });
    const token = jwt.sign({}, JWT_SECRET!, { subject: user.id, expiresIn: '30m', issuer: 'hsi-visual-cognitivo' });
    return res.status(201).json({ token, expiresIn: 1800, user: publicUser(user as AuthUser) });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Este e-mail já possui uma conta. Entre ou utilize a recuperação de senha.' });
    throw error;
  }
}));

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.authUser!) }));

app.post('/api/auth/forgot-password', asyncRoute(async (req, res) => {
  const email = z.string().email().safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (!(process.env.BREVO_API_KEY && process.env.MAIL_FROM && process.env.PUBLIC_APP_URL)) return res.status(503).json({ error: 'O serviço de recuperação de senha ainda não foi configurado. Procure o administrador da plataforma.' });
  const user = await prisma.user.findUnique({ where: { email: email.data.toLowerCase() } });
  const generic = { message: 'Se o endereço estiver cadastrado, você receberá instruções para redefinir a senha.' };
  if (!user || user.status !== UserStatus.ACTIVE) return res.json(generic);
  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  await sendPasswordResetEmail(user.email, rawToken);
  return res.json(generic);
}));

app.post('/api/auth/reset-password', asyncRoute(async (req, res) => {
  const schema = z.object({ token: z.string().min(32).max(200), password: z.string().min(12).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Token ou senha inválidos. A senha deve ter ao menos 12 caracteres.' });
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return res.status(400).json({ error: 'Link expirado ou já utilizado. Solicite uma nova redefinição.' });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.updateMany({ where: { userId: reset.userId, id: { not: reset.id }, usedAt: null }, data: { usedAt: new Date() } })
  ]);
  return res.json({ message: 'Senha redefinida. Faça login com a nova senha.' });
}));

const participantSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), password: z.string().min(12).max(200).optional(), role: z.enum(['PARTICIPANT','ANALYST']).default('PARTICIPANT'), participantCode: z.string().trim().max(60).optional(), groupId: z.string().optional() });
app.get('/api/users', authenticate, allow(UserRole.ADMIN), asyncRoute(async (req, res) => {
  const users = await prisma.user.findMany({ where: req.authUser!.role === UserRole.ANALYST ? { role: UserRole.PARTICIPANT } : {}, select: { id:true,name:true,email:true,role:true,status:true,participantCode:true,groupId:true,createdAt:true,group:{select:{id:true,name:true}} }, orderBy: { createdAt:'desc' } });
  res.json({ users });
}));
app.post('/api/users', authenticate, allow(UserRole.ADMIN), asyncRoute(async (req, res) => {
  const parsed = participantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  const data = parsed.data;
  const temporaryPassword = data.password || crypto.randomBytes(18).toString('base64url') + 'Aa1!';
  const user = await prisma.user.create({ data: { name:data.name,email:data.email.toLowerCase(),passwordHash:await bcrypt.hash(temporaryPassword,12),role:data.role,status:UserStatus.ACTIVE,participantCode:data.participantCode || null,groupId:data.groupId || null }, select:{id:true,name:true,email:true,role:true,status:true,participantCode:true,groupId:true} });
  await prisma.auditLog.create({ data:{actorId:req.authUser!.id,action:'USER_CREATE',targetType:'USER',targetId:user.id} });
  res.status(201).json({ user, ...(data.password ? {} : { temporaryPassword }) });
}));
app.patch('/api/users/:id', authenticate, allow(UserRole.ADMIN), asyncRoute(async (req, res) => {
  const schema = z.object({ name:z.string().trim().min(2).max(120).optional(),role:z.enum(['PARTICIPANT','ANALYST','ADMIN']).optional(),status:z.enum(['ACTIVE','INVITED','DISABLED']).optional(),participantCode:z.string().trim().max(60).nullable().optional(),groupId:z.string().nullable().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:'Dados inválidos.'});
  if (String(req.params.id) === req.authUser!.id && (parsed.data.role && parsed.data.role !== 'ADMIN' || parsed.data.status === 'DISABLED')) return res.status(400).json({error:'Não é permitido remover seu próprio acesso administrativo.'});
  const user = await prisma.user.update({ where:{id:String(req.params.id)},data:parsed.data,select:{id:true,name:true,email:true,role:true,status:true,participantCode:true,groupId:true} });
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'USER_UPDATE',targetType:'USER',targetId:user.id,metadata:parsed.data}});
  res.json({user});
}));
app.get('/api/admin/overview', authenticate, allow(UserRole.ADMIN), asyncRoute(async (_req,res) => {
  const [users,activeUsers,participants,analysts,admins,groups,assessments,instrumentAssessments] = await Promise.all([
    prisma.user.count(), prisma.user.count({where:{status:UserStatus.ACTIVE}}),
    prisma.user.count({where:{role:UserRole.PARTICIPANT}}), prisma.user.count({where:{role:UserRole.ANALYST}}),
    prisma.user.count({where:{role:UserRole.ADMIN}}), prisma.participantGroup.count(),
    prisma.assessmentResult.count(), prisma.instrumentAssessment.count()
  ]);
  res.json({generatedAt:new Date().toISOString(),system:{api:'operational',database:'connected'},counts:{users,activeUsers,participants,analysts,admins,groups,assessments,instrumentAssessments}});
}));
const institutionSchema=z.object({
  name:z.string().trim().min(2).max(180),
  type:z.enum(['SCHOOL','COMPANY','PUBLIC_AGENCY','RESEARCH_CENTER','OTHER']).default('OTHER'),
  city:z.string().trim().min(2).max(100),
  state:z.string().trim().length(2).transform(v=>v.toUpperCase()),
  country:z.string().trim().length(2).default('BR'),
});
app.get('/api/institutions', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (_req,res) => {
  const institutions=await prisma.institution.findMany({where:{active:true},include:{_count:{select:{groups:true,assessments:true}}},orderBy:[{state:'asc'},{city:'asc'},{name:'asc'}]});
  res.json({institutions});
}));
app.post('/api/institutions', authenticate, allow(UserRole.ADMIN), asyncRoute(async (req,res) => {
  const parsed=institutionSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Dados institucionais inválidos.',details:parsed.error.flatten()});
  const institution=await prisma.institution.create({data:parsed.data});
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'INSTITUTION_CREATE',targetType:'INSTITUTION',targetId:institution.id}});
  res.status(201).json({institution});
}));
app.patch('/api/institutions/:id', authenticate, allow(UserRole.ADMIN), asyncRoute(async (req,res) => {
  const parsed=institutionSchema.partial().extend({active:z.boolean().optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Dados institucionais inválidos.'});
  const institution=await prisma.institution.update({where:{id:String(req.params.id)},data:parsed.data});
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'INSTITUTION_UPDATE',targetType:'INSTITUTION',targetId:institution.id}});
  res.json({institution});
}));
app.get('/api/groups', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (_req,res) => {
  const groups = await prisma.participantGroup.findMany({include:{institution:true,_count:{select:{users:true,assessments:true}}},orderBy:{name:'asc'}});
  res.json({groups});
}));
app.post('/api/groups', authenticate, allow(UserRole.ADMIN), asyncRoute(async (req,res) => {
  const parsed=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(500).optional(),institutionId:z.string().optional(),city:z.string().trim().min(2).max(100).optional(),state:z.string().trim().length(2).transform(v=>v.toUpperCase()).optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Dados do grupo inválidos.'});
  const group=await prisma.participantGroup.create({data:parsed.data});
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'GROUP_CREATE',targetType:'GROUP',targetId:group.id}});
  res.status(201).json({group});
}));

app.get('/api/questions', authenticate, asyncRoute(async (req, res) => {
  const mode = req.query.mode;
  const axisId = typeof req.query.axisId === 'string' ? req.query.axisId : undefined;
  if (mode === 'full') return res.json({ questions: questions.map(({ id, axis, prompt, visual, options }) => ({ id, axis, prompt, visual, options })) });
  if (mode === 'axis' && axisId && ['logic','attention','patterns','anticipation','risk','decision'].includes(axisId)) {
    const delivered = questions.filter(q => q.axis === axisId).map(({ id, axis, prompt, visual, options }) => ({ id, axis, prompt, visual, options }));
    if (delivered.length !== 5) return res.status(500).json({ error: 'Banco de questões inconsistente.' });
    return res.json({ questions: delivered });
  }
  return res.status(400).json({ error: 'Modalidade ou eixo inválido.' });
}));

const resultSchema = z.object({
  id:z.string().min(8).max(100), mode:z.enum(['Avaliação completa','Eixo individual']),
  completedAt:z.string().datetime(), totalQuestions:z.number().int().min(1).max(30),
  durationSeconds:z.number().int().min(1).max(86400),
  answerDetails:z.array(z.object({ questionId:z.string().min(1).max(40), axisId:z.string().min(1).max(40), selected:z.number().int().min(0).max(3), seconds:z.number().int().min(1).max(3600) }).strict()).min(1).max(30),
}).strict();
app.get('/api/results', authenticate, asyncRoute(async (req,res) => {
  const rows=await prisma.assessmentResult.findMany({where:{userId:req.authUser!.id},orderBy:{completedAt:'desc'},take:200});
  res.json({results:rows.map(r=>({...r,completedAt:r.completedAt.toISOString()}))});
}));
app.post('/api/results', authenticate, asyncRoute(async (req,res) => {
  const parsed=resultSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Resultado inválido.',details:parsed.error.flatten()});
  const d=parsed.data;
  const bank = new Map(questions.map((q: any) => [q.id, q] as [string, any]));
  if (d.answerDetails.length !== d.totalQuestions) return res.status(400).json({error:'Quantidade de respostas não corresponde ao total informado.'});
  const seen = new Set<string>();
  const verified = d.answerDetails.map((raw: Record<string, unknown>) => {
    const questionId = String(raw.questionId || '');
    const question = bank.get(questionId) as any;
    const selected = Number(raw.selected);
    const seconds = Number(raw.seconds);
    if (!question || seen.has(questionId) || !Number.isInteger(selected) || selected < 0 || selected >= question.options.length || !Number.isFinite(seconds) || seconds < 1 || seconds > 3600 || raw.axisId !== question.axis) throw new Error('INVALID_ANSWER');
    seen.add(questionId);
    return { questionId, axisId: question.axis, selected, correct: selected === question.answer, seconds, prompt: question.prompt, selectedOption: question.options[selected], correctOption: question.options[question.answer] };
  });
  const modeError = validateAssessmentMode(d.mode, verified.length, verified.map(a => a.axisId), questions.length);
  if (modeError) return res.status(400).json({error:modeError});
  const correct = verified.filter(a => a.correct).length;
  const accuracy = Math.round(correct / verified.length * 100);

  const axes = [...new Set(verified.map(a => a.axisId))].map(axisId => {
    const rows = verified.filter(a => a.axisId === axisId);
    const axisTitles: Record<string,string> = { logic:'Raciocínio lógico', attention:'Atenção seletiva', patterns:'Percepção de padrões', anticipation:'Antecipação de situações', risk:'Percepção de riscos no trânsito', decision:'Tomada de decisão' };
    const axisCorrect = rows.filter(a => a.correct).length;
    return { axisId, title: axisTitles[axisId] || axisId, correct: axisCorrect, total: rows.length, accuracy: Math.round(axisCorrect / rows.length * 100), averageSeconds: Math.round(rows.reduce((sum,a) => sum + a.seconds, 0) / rows.length) };
  });
  const existing = await prisma.assessmentResult.findUnique({where:{id:d.id}});
  if (existing) return res.status(409).json({error:'Identificador de resultado já utilizado.'});
  const result = await prisma.assessmentResult.create({data:{id:d.id,userId:req.authUser!.id,participantCode:req.authUser!.participantCode || 'SEM-CÓDIGO',mode:d.mode,completedAt:new Date(d.completedAt),totalQuestions:verified.length,correct,accuracy,durationSeconds:d.durationSeconds,axes:axes as Prisma.InputJsonValue,answerDetails:verified as Prisma.InputJsonValue}});
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'ASSESSMENT_SUBMIT',targetType:'RESULT',targetId:result.id}});
  res.status(201).json({result});
}));


const instrumentResultSchema = z.object({
  id: z.string().min(8).max(100),
  instrument: z.literal('HSI-DOTH-P'),
  context: z.enum(['cotidiano','trabalho','educacao','familia','social','digital','transito','integrado']),
  answers: z.array(z.number().int().min(1).max(5)).length(25),
  contextVersion: z.string().max(20).default('1.0'),
  consentVersion: z.string().max(40).optional(),
}).strict();

app.get('/api/instrument-results', authenticate, asyncRoute(async (req,res) => {
  const rows = await prisma.instrumentAssessment.findMany({
    where: { userId: req.authUser!.id },
    orderBy: { completedAt: 'desc' },
    take: 200,
  });
  res.json({ results: rows.map(row => ({ ...row, completedAt: row.completedAt.toISOString() })) });
}));


app.get('/api/instrument-results/longitudinal', authenticate, asyncRoute(async (req,res) => {
  const [behavioral, cognitive] = await Promise.all([
    prisma.instrumentAssessment.findMany({
      where: { userId: req.authUser!.id, instrument: 'HSI-DOTH-P' },
      orderBy: { completedAt: 'asc' },
      select: { id:true, context:true, contextVersion:true, completedAt:true, dimensions:true }
    }),
    prisma.assessmentResult.findMany({
      where: { userId: req.authUser!.id },
      orderBy: { completedAt: 'asc' },
      select: { id:true, mode:true, completedAt:true, accuracy:true, correct:true, totalQuestions:true, axes:true }
    })
  ]);
  const contextLabels:Record<string,string> = {
    cotidiano:'Vida cotidiana e relações pessoais', trabalho:'Trabalho e ambiente profissional',
    educacao:'Estudos e aprendizagem', familia:'Família e convivência',
    social:'Comunidade e participação social', digital:'Ambientes digitais',
    transito:'Mobilidade e trânsito', integrado:'Diferentes contextos da vida'
  };
  const normalized = behavioral.map(row => ({
    id:row.id, context:row.context, contextLabel:contextLabels[row.context]||row.context,
    contextVersion:row.contextVersion, completedAt:row.completedAt.toISOString(),
    dimensions:(row.dimensions as Array<Record<string,unknown>>).map(d=>({
      id:String(d.id||'unknown'), name:String(d.name||d.id||'Dimensão'),
      score:Number(d.score||0), mean:Number(d.mean||0)
    }))
  }));
  const previousByContext = new Map<string, typeof normalized[number]>();
  const timeline = normalized.map(row => {
    const previous = previousByContext.get(row.context);
    const comparison = row.dimensions.map(d => {
      const old = previous?.dimensions.find(x=>x.id===d.id);
      return { dimensionId:d.id, score:d.score, previousScore:old?.score??null, difference:old?d.score-old.score:null };
    });
    previousByContext.set(row.context,row);
    return { ...row, comparisonWithPreviousSameContext:comparison };
  });
  const contexts = [...new Set(normalized.map(row=>row.context))].map(context => {
    const rows=normalized.filter(row=>row.context===context);
    const latest=rows[rows.length-1];
    return {
      context, label:contextLabels[context]||context, applications:rows.length,
      firstCompletedAt:rows[0].completedAt, latestCompletedAt:latest.completedAt,
      dimensions:latest.dimensions.map(d=>{
        const values=rows.map(r=>r.dimensions.find(x=>x.id===d.id)?.score).filter((v):v is number=>typeof v==='number');
        return {id:d.id,name:d.name,latestScore:d.score,meanAcrossApplications:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null,observations:values.length};
      })
    };
  });
  const cognitiveTimeline=cognitive.map(row=>({
    id:row.id,mode:row.mode,completedAt:row.completedAt.toISOString(),
    accuracy:row.accuracy,correct:row.correct,totalQuestions:row.totalQuestions,
    axes:row.axes
  }));
  res.json({
    generatedAt:new Date().toISOString(),
    methodology:{
      behavioralInstrument:'HSI-DOTH-P',cognitiveInstrument:'HSI Visual Cognitivo',
      scalesCombined:false,causalInference:false,
      note:'As séries comportamental e cognitiva são apresentadas separadamente. Diferenças entre aplicações são descritivas e não comprovam mudança estável, validade preditiva ou causalidade.'
    },
    totals:{behavioralApplications:behavioral.length,cognitiveApplications:cognitive.length},
    contexts, behavioralTimeline:timeline, cognitiveTimeline
  });
}));

app.post('/api/instrument-results', authenticate, asyncRoute(async (req,res) => {
  const parsed = instrumentResultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Questionário incompleto ou dados inválidos.', details: parsed.error.flatten() });
  const data = parsed.data;
  const existing = await prisma.instrumentAssessment.findUnique({ where: { id: data.id } });
  if (existing) return res.status(409).json({ error: 'Identificador de avaliação já utilizado.' });
  const participant = await prisma.user.findUnique({where:{id:req.authUser!.id},select:{groupId:true,group:{select:{institutionId:true,city:true,state:true,institution:{select:{city:true,state:true}}}}}});
  const scored = scoreDothp(data.answers, data.context);
  const result = await prisma.instrumentAssessment.create({
    data: {
      id: data.id,
      userId: req.authUser!.id,
      instrument: data.instrument,
      context: data.context,
      contextVersion: data.contextVersion,
      groupId: participant?.groupId || null,
      institutionId: participant?.group?.institutionId || null,
      city: participant?.group?.city || participant?.group?.institution?.city || null,
      state: participant?.group?.state || participant?.group?.institution?.state || null,
      consentVersion: data.consentVersion || null,
      consentedAt: data.consentVersion ? new Date() : null,
      completedAt: new Date(),
      answers: scored.answers as Prisma.InputJsonValue,
      dimensions: scored.dimensions as Prisma.InputJsonValue,
    },
  });
  await prisma.auditLog.create({ data: { actorId: req.authUser!.id, action: 'INSTRUMENT_SUBMIT', targetType: 'INSTRUMENT_RESULT', targetId: result.id, metadata: { instrument: data.instrument, context: data.context } } });
  res.status(201).json({ result: { ...result, completedAt: result.completedAt.toISOString() } });
}));

app.get('/api/analytics', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (req,res) => {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : new Date(Date.now()-30*86400000);
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
  const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return res.status(400).json({error:'Período inválido.'});
  const where = { completedAt:{gte:from,lte:to}, ...(groupId ? {user:{groupId}} : {}) };
  const rows=await prisma.assessmentResult.findMany({where,select:{userId:true,mode:true,totalQuestions:true,correct:true,durationSeconds:true,axes:true,answerDetails:true,completedAt:true}});
  const totalQuestions=rows.reduce((sum,row)=>sum+row.totalQuestions,0);
  const correct=rows.reduce((sum,row)=>sum+row.correct,0);
  const axisMap=new Map<string,{title:string;correct:number;total:number;seconds:number;attempts:number;fastErrors:number;slowCorrect:number}>();
  const responseTimes={under3:0,from3to5:0,from6to10:0,over10:0};
  for(const row of rows){
    for(const raw of (row.axes as Array<Record<string,unknown>>)){
      const id=String(raw.axisId||'unknown');
      const current=axisMap.get(id)||{title:String(raw.title||id),correct:0,total:0,seconds:0,attempts:0,fastErrors:0,slowCorrect:0};
      current.correct+=Number(raw.correct||0);current.total+=Number(raw.total||0);current.seconds+=Number(raw.averageSeconds||0);current.attempts++;axisMap.set(id,current);
    }
    for(const answer of (row.answerDetails as Array<Record<string,unknown>>)){
      const seconds=Number(answer.seconds||0);
      if(seconds<3) responseTimes.under3++; else if(seconds<=5) responseTimes.from3to5++; else if(seconds<=10) responseTimes.from6to10++; else responseTimes.over10++;
      const axis=axisMap.get(String(answer.axisId||''));
      if(axis && answer.correct===false && seconds<=5) axis.fastErrors++;
      if(axis && answer.correct===true && seconds>=15) axis.slowCorrect++;
    }
  }
  const uniqueParticipants=new Set(rows.map(row=>row.userId)).size;
  const minimumGroupSize=5;
  if(rows.length>0&&uniqueParticipants<minimumGroupSize)return res.status(403).json({error:'Indicadores suprimidos por privacidade: são necessários pelo menos cinco participantes distintos no conjunto selecionado.',privacy:{suppressed:true,minimumGroupSize}});
  res.json({
    privacy:{suppressed:false,minimumGroupSize},
    generatedAt:new Date().toISOString(),
    summary:{assessments:rows.length,participants:uniqueParticipants,totalQuestions,correct,accuracy:totalQuestions?Math.round(correct/totalQuestions*100):0,completeAssessments:rows.filter(r=>r.mode==='Avaliação completa').length,axisAssessments:rows.filter(r=>r.mode==='Eixo individual').length},
    axes:[...axisMap.entries()].map(([axisId,value])=>({axisId,title:value.title,correct:value.correct,total:value.total,accuracy:value.total?Math.round(value.correct/value.total*100):0,averageSeconds:value.attempts?Math.round(value.seconds/value.attempts):0,fastErrors:value.fastErrors,slowCorrect:value.slowCorrect})),
    responseTimes,
    timeline:[...rows.reduce((map,row)=>{const key=row.completedAt.toISOString().slice(0,7);const value=map.get(key)||{period:key,assessments:0,questions:0,correct:0};value.assessments++;value.questions+=row.totalQuestions;value.correct+=row.correct;map.set(key,value);return map;},new Map<string,{period:string;assessments:number;questions:number;correct:number}>()).values()].sort((a,b)=>a.period.localeCompare(b.period)).map(v=>({...v,accuracy:v.questions?Math.round(v.correct/v.questions*100):0}))
  });
}));

app.get('/api/admin/behavior', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (req,res) => {
  const from=typeof req.query.from==='string'?new Date(req.query.from):new Date(Date.now()-365*86400000);
  const to=typeof req.query.to==='string'?new Date(req.query.to):new Date();
  const groupId=typeof req.query.groupId==='string'?req.query.groupId:undefined;
  if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||from>to)return res.status(400).json({error:'Período inválido.'});
  const where={completedAt:{gte:from,lte:to},...(groupId?{user:{groupId}}:{})};
  const [cognitive,instruments]=await Promise.all([
    prisma.assessmentResult.findMany({where,select:{userId:true,totalQuestions:true,correct:true,axes:true,answerDetails:true,completedAt:true}}),
    prisma.instrumentAssessment.findMany({where:{completedAt:{gte:from,lte:to},...(groupId?{user:{groupId}}:{})},select:{userId:true,context:true,dimensions:true,answers:true,completedAt:true}})
  ]);
  const minimumGroupSize=5;
  const cognitiveParticipants=new Set(cognitive.map(row=>row.userId)).size;
  const behavioralParticipants=new Set(instruments.map(row=>row.userId)).size;
  if((cognitive.length>0&&cognitiveParticipants<minimumGroupSize)||(instruments.length>0&&behavioralParticipants<minimumGroupSize))return res.status(403).json({error:'Relatório suprimido por privacidade: cada conjunto de respostas precisa conter pelo menos cinco participantes distintos.',privacy:{suppressed:true,minimumGroupSize}});
  const dimensionMap=new Map<string,{name:string;sum:number;scoreSum:number;count:number;low:number;mid:number;high:number}>();
  const contextMap=new Map<string,number>();
  const likert=[0,0,0,0,0];
  for(const result of instruments){
    contextMap.set(result.context,(contextMap.get(result.context)||0)+1);
    for(const raw of (result.dimensions as Array<Record<string,unknown>>)){
      const id=String(raw.id||'unknown');
      const item=dimensionMap.get(id)||{name:String(raw.name||id),sum:0,scoreSum:0,count:0,low:0,mid:0,high:0};
      item.sum+=Number(raw.mean||0);item.scoreSum+=Number(raw.score||0);item.count++;
      const score=Number(raw.score||0);if(score<34)item.low++;else if(score<67)item.mid++;else item.high++;
      dimensionMap.set(id,item);
    }
    for(const answer of (result.answers as Array<Record<string,unknown>>)){
      const value=Number(answer.scoredResponse||0);if(value>=1&&value<=5)likert[value-1]++;
    }
  }
  const cognitiveQuestions=cognitive.reduce((sum,row)=>sum+row.totalQuestions,0);
  const cognitiveCorrect=cognitive.reduce((sum,row)=>sum+row.correct,0);
  const dothpCount=instruments.length;
  res.json({
    generatedAt:new Date().toISOString(),
    privacy:{individualRecords:false,minimumGroupSize,identifiersIncluded:false,suppressed:false},
    totals:{cognitiveAssessments:cognitive.length,cognitiveQuestions,cognitiveCorrect,cognitiveAccuracy:cognitiveQuestions?Math.round(cognitiveCorrect/cognitiveQuestions*100):0,dothpAssessments:dothpCount},
    dothp:{dimensions:[...dimensionMap.entries()].map(([id,v])=>({id,name:v.name,mean:v.count?Number((v.sum/v.count).toFixed(2)):0,score:v.count?Math.round(v.scoreSum/v.count):0,applications:v.count,low:v.low,medium:v.mid,high:v.high})),contexts:[...contextMap.entries()].map(([context,count])=>({context,count})),likertDistribution:likert.map((count,index)=>({value:index+1,count}))},
    cognitive:{responseCount:cognitiveQuestions}
  });
}));

const researchQuerySchema=z.object({
  from:z.string().datetime().optional(),
  to:z.string().datetime().optional(),
  institutionId:z.string().optional(),
  context:z.enum(['cotidiano','trabalho','educacao','familia','social','digital','transito','integrado']).optional(),
});
async function getResearchAggregate(query:Record<string,unknown>){
  const parsed=researchQuerySchema.safeParse(query);
  if(!parsed.success)throw Object.assign(new Error('Filtros de pesquisa inválidos.'),{status:400});
  const from=parsed.data.from?new Date(parsed.data.from):new Date(Date.now()-365*86400000);
  const to=parsed.data.to?new Date(parsed.data.to):new Date();
  if(from>to)throw Object.assign(new Error('Período inválido.'),{status:400});
  const rows=await prisma.instrumentAssessment.findMany({
    where:{completedAt:{gte:from,lte:to},consentVersion:{not:null},...(parsed.data.institutionId?{institutionId:parsed.data.institutionId}:{}),...(parsed.data.context?{context:parsed.data.context}:{})},
    select:{userId:true,institutionId:true,city:true,state:true,context:true,dimensions:true,institution:{select:{name:true,type:true,city:true,state:true}},completedAt:true}
  });
  const participants=new Set(rows.map(x=>x.userId)).size;
  const minimumGroupSize=5;
  if(participants<minimumGroupSize)return {privacy:{suppressed:true,minimumGroupSize,distinctParticipants:participants},generatedAt:new Date().toISOString(),totals:{assessments:0,participants:0},dimensions:[],timeline:[],contexts:[],geography:[],institutions:[]};
  const dims=new Map<string,{name:string;sum:number;count:number}>();
  const contexts=new Map<string,{count:number;users:Set<string>}>();
  const geo=new Map<string,{state:string;city:string;count:number;users:Set<string>;scores:Map<string,{sum:number;count:number}>}>();
  const orgs=new Map<string,{name:string;type:string;city:string;state:string;count:number;users:Set<string>;scores:Map<string,{sum:number;count:number}>}>();
  const timeline=new Map<string,{period:string;count:number;users:Set<string>;scores:Map<string,{sum:number;count:number}>}>();
  for(const row of rows){
    const period=row.completedAt.toISOString().slice(0,7);
    const month=timeline.get(period)||{period,count:0,users:new Set<string>(),scores:new Map()};month.count++;month.users.add(row.userId);
    for(const raw of row.dimensions as Array<Record<string,unknown>>){const id=String(raw.id||'unknown'),score=Number(raw.score||0);const item=month.scores.get(id)||{sum:0,count:0};item.sum+=score;item.count++;month.scores.set(id,item);}
    timeline.set(period,month);
    const ctx=contexts.get(row.context)||{count:0,users:new Set<string>()};ctx.count++;ctx.users.add(row.userId);contexts.set(row.context,ctx);
    const place=row.institution;
    if(row.state&&row.city){
      const key=row.state+'|'+row.city;
      const g=geo.get(key)||{state:row.state,city:row.city,count:0,users:new Set<string>(),scores:new Map()};
      g.count++;g.users.add(row.userId);
      for(const raw of row.dimensions as Array<Record<string,unknown>>){
        const id=String(raw.id||'unknown'),score=Number(raw.score||0);
        const ds=g.scores.get(id)||{sum:0,count:0};ds.sum+=score;ds.count++;g.scores.set(id,ds);
      }
      geo.set(key,g);
      if(place&&row.institutionId){
        const o=orgs.get(row.institutionId)||{name:place.name,type:place.type,city:place.city,state:place.state,count:0,users:new Set<string>(),scores:new Map()};
        o.count++;o.users.add(row.userId);
        for(const raw of row.dimensions as Array<Record<string,unknown>>){
          const id=String(raw.id||'unknown'),score=Number(raw.score||0);
          const os=o.scores.get(id)||{sum:0,count:0};os.sum+=score;os.count++;o.scores.set(id,os);
        }
        orgs.set(row.institutionId,o);
      }
    }
    for(const raw of row.dimensions as Array<Record<string,unknown>>){
      const id=String(raw.id||'unknown'),item=dims.get(id)||{name:String(raw.name||id),sum:0,count:0};
      item.sum+=Number(raw.score||0);item.count++;dims.set(id,item);
    }
  }
  const dimensionRows=[...dims.entries()].map(([id,v])=>({id,name:v.name,score:Math.round(v.sum/v.count),applications:v.count}));
  const states = new Map<string,{state:string;count:number;users:Set<string>;scores:Map<string,{sum:number;count:number}>}>();
  for (const cityGroup of geo.values()) {
    const stateGroup=states.get(cityGroup.state)||{state:cityGroup.state,count:0,users:new Set<string>(),scores:new Map<string,{sum:number;count:number}>()};
    stateGroup.count+=cityGroup.count;
    for (const userId of cityGroup.users) stateGroup.users.add(userId);
    for (const [dimensionId,score] of cityGroup.scores.entries()) {
      const total=stateGroup.scores.get(dimensionId)||{sum:0,count:0};
      total.sum+=score.sum;total.count+=score.count;stateGroup.scores.set(dimensionId,total);
    }
    states.set(cityGroup.state,stateGroup);
  }
  type AggregateGroup = { users: Set<string>; scores: Map<string, { sum: number; count: number }> };
  const safeGroups = <T extends AggregateGroup>(
    map: Map<string, T>
  ): Array<Omit<T, 'users' | 'scores'> & {
    id: string;
    participants: number;
    dimensions: Array<{ dimensionId: string; score: number }>;
  }> => [...map.entries()]
    .filter(([, value]) => value.users.size >= minimumGroupSize)
    .map(([id, value]) => {
      const { users, scores, ...attributes } = value;
      return {
        id,
        ...attributes,
        participants: users.size,
        dimensions: [...scores.entries()].map(([dimensionId, score]) => ({
          dimensionId,
          score: Math.round(score.sum / score.count),
        })),
      };
    });
  return {privacy:{suppressed:false,minimumGroupSize,distinctParticipants:participants},generatedAt:new Date().toISOString(),period:{from:from.toISOString(),to:to.toISOString()},totals:{assessments:rows.length,participants},dimensions:dimensionRows,timeline:[...timeline.values()].filter(v=>v.users.size>=minimumGroupSize).sort((a,b)=>a.period.localeCompare(b.period)).map(v=>({period:v.period,assessments:v.count,participants:v.users.size,dimensions:[...v.scores.entries()].map(([dimensionId,s])=>({dimensionId,score:Math.round(s.sum/s.count)}))})),contexts:[...contexts.entries()].filter(([,v])=>v.users.size>=minimumGroupSize).map(([context,v])=>({context,assessments:v.count,participants:v.users.size})),geography:safeGroups(geo),states:safeGroups(states),institutions:safeGroups(orgs)};
}
app.get('/api/research/aggregate', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (req,res)=>{
  const aggregate=await getResearchAggregate(req.query as Record<string,unknown>);
  res.json(aggregate);
}));
app.get('/api/research/export.csv', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (req,res)=>{
  const aggregate=await getResearchAggregate(req.query as Record<string,unknown>);
  if(aggregate.privacy.suppressed)return res.status(403).json({error:'Exportação suprimida: são necessários pelo menos cinco participantes distintos.',privacy:aggregate.privacy});
  const rows:string[][]=[['tipo','codigo','dimensao','pontuacao_media','aplicacoes','participantes']];
  for(const d of aggregate.dimensions)rows.push(['geral','TODOS',d.name,String(d.score),String(d.applications),String(aggregate.totals.participants)]);
  for(const g of aggregate.geography)for(const d of g.dimensions)rows.push(['municipio',g.state+'-'+g.city,d.dimensionId,String(d.score),String(g.count),String(g.participants)]);
  for(const o of aggregate.institutions)for(const d of o.dimensions)rows.push(['instituicao',o.id,d.dimensionId,String(d.score),String(o.count),String(o.participants)]);
  const csv=rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(';')).join('\\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="enat-relatorio-agregado.csv"');
  res.send('\\uFEFF'+csv);
}));

app.post('/api/advisor', authenticate, asyncRoute(async (req, res) => {
  const parsed = z.object({ resultIds: z.array(z.string().min(8).max(100)).min(1).max(6) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Informe resultados válidos para orientação.' });
  const rows = await prisma.assessmentResult.findMany({ where: { id: { in: parsed.data.resultIds }, userId: req.authUser!.id }, orderBy: { completedAt: 'desc' } });
  if (rows.length !== new Set(parsed.data.resultIds).size) return res.status(404).json({ error: 'Um ou mais resultados não foram encontrados nesta conta.' });
  const axisMap = new Map<string, { title: string; correct: number; total: number }>();
  for (const row of rows) for (const item of row.axes as Array<{axisId:string;title:string;correct:number;total:number}>) {
    const current = axisMap.get(item.axisId) || { title: item.title, correct: 0, total: 0 };
    current.correct += item.correct; current.total += item.total; axisMap.set(item.axisId, current);
  }
  const guidance = [...axisMap.values()].map(item => {
    const pct = item.total ? Math.round(item.correct / item.total * 100) : 0;
    const suggestion = pct >= 80 ? 'ampliar a variedade dos exercícios e observar a consistência em novas sessões' : pct >= 60 ? 'retomar os itens com erro e praticar estratégias gradualmente' : 'revisar os conceitos e realizar atividades orientadas em sessões curtas';
    return item.title + ': ' + item.correct + '/' + item.total + ' acertos (' + pct + '%). Sugestão educativa: ' + suggestion + '.';
  });
  res.json({ guidance: 'Orientação educativa automatizada, baseada apenas nos resultados registrados nesta conta. Não constitui avaliação clínica ou de aptidão para dirigir.\\n\\n' + guidance.join('\\n') });
}));

app.use((err: unknown,_req:Request,res:Response,_next:NextFunction) => {
  if (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') return res.status(err.status).json({error:err instanceof Error?err.message:'Solicitação inválida.'});
  if (err instanceof Error && err.message === 'INVALID_ANSWER') return res.status(400).json({error:'Resposta inválida ou questão não reconhecida.'});
  console.error(err);
  if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') return res.status(409).json({error:'Já existe um registro com esses dados.'});
  return res.status(500).json({error:'Erro interno. Consulte os registros do serviço.'});
});
export { app };
if (process.env.NODE_ENV !== 'test') app.listen(PORT,'0.0.0.0',()=>console.log('HSI API listening on',PORT));
