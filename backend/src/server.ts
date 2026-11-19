import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { questions } from './question-bank.js';
import { hasRole, validateAssessmentMode } from './security.js';

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
    const payload = jwt.verify(raw, JWT_SECRET!) as { sub: string };
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

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.authUser!) }));

app.post('/api/auth/forgot-password', asyncRoute(async (req, res) => {
  const email = z.string().email().safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM)) return res.status(503).json({ error: 'O serviço de recuperação de senha ainda não foi configurado. Procure o administrador da plataforma.' });
  const user = await prisma.user.findUnique({ where: { email: email.data.toLowerCase() } });
  const generic = { message: 'Se o endereço estiver cadastrado, você receberá instruções para redefinir a senha.' };
  if (!user || user.status !== UserStatus.ACTIVE) return res.json(generic);
  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM) {
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    const base = process.env.PUBLIC_APP_URL || '';
    await transport.sendMail({ from: process.env.MAIL_FROM, to: user.email, subject: 'Redefinição de senha — HSI Visual Cognitivo', text: 'Para redefinir sua senha, acesse: ' + base + '/reset-password.html?token=' + rawToken + '\nO link expira em 30 minutos.' });
  }
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
app.get('/api/users', authenticate, allow(UserRole.ADMIN, UserRole.ANALYST), asyncRoute(async (req, res) => {
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
app.get('/api/groups', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (_req,res) => {
  const groups = await prisma.participantGroup.findMany({include:{_count:{select:{users:true}}},orderBy:{name:'asc'}});
  res.json({groups});
}));
app.post('/api/groups', authenticate, allow(UserRole.ADMIN), asyncRoute(async (req,res) => {
  const parsed=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(500).optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Nome de grupo inválido.'});
  const group=await prisma.participantGroup.create({data:parsed.data});
  res.status(201).json({group});
}));

const resultSchema = z.object({
  id:z.string().min(8).max(100),participantCode:z.string().max(60),mode:z.string().max(100),completedAt:z.string().datetime(),
  totalQuestions:z.number().int().min(1).max(30),correct:z.number().int().min(0).max(30),accuracy:z.number().int().min(0).max(100),
  durationSeconds:z.number().int().min(1).max(86400),axes:z.array(z.record(z.string(), z.unknown())).max(6),answerDetails:z.array(z.record(z.string(), z.unknown())).min(1).max(30)
});
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
  if (correct !== d.correct || accuracy !== d.accuracy) return res.status(400).json({error:'Pontuação enviada não corresponde às respostas registradas.'});
  const axes = [...new Set(verified.map(a => a.axisId))].map(axisId => {
    const rows = verified.filter(a => a.axisId === axisId);
    const axisTitles: Record<string,string> = { logic:'Raciocínio lógico', attention:'Atenção seletiva', patterns:'Percepção de padrões', anticipation:'Antecipação de situações', risk:'Percepção de riscos no trânsito', decision:'Tomada de decisão' };
    const axisCorrect = rows.filter(a => a.correct).length;
    return { axisId, title: axisTitles[axisId] || axisId, correct: axisCorrect, total: rows.length, accuracy: Math.round(axisCorrect / rows.length * 100), averageSeconds: Math.round(rows.reduce((sum,a) => sum + a.seconds, 0) / rows.length) };
  });
  const existing = await prisma.assessmentResult.findUnique({where:{id:d.id}});
  if (existing && existing.userId !== req.authUser!.id) return res.status(409).json({error:'Identificador de resultado já utilizado.'});
  const result = existing || await prisma.assessmentResult.create({data:{id:d.id,userId:req.authUser!.id,participantCode:req.authUser!.participantCode || 'SEM-CÓDIGO',mode:d.mode,completedAt:new Date(d.completedAt),totalQuestions:verified.length,correct,accuracy,durationSeconds:d.durationSeconds,axes:axes as Prisma.InputJsonValue,answerDetails:verified as Prisma.InputJsonValue}});
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'ASSESSMENT_SUBMIT',targetType:'RESULT',targetId:result.id}});
  res.status(201).json({result});
}));

app.get('/api/analytics', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (req,res) => {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : new Date(Date.now()-30*86400000);
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
  const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return res.status(400).json({error:'Período inválido.'});
  const where = { completedAt:{gte:from,lte:to}, ...(groupId ? {user:{groupId}} : {}) };
  const rows = await prisma.assessmentResult.findMany({where,include:{user:{select:{id:true,name:true,participantCode:true,group:{select:{id:true,name:true}}}}},orderBy:{completedAt:'desc'},take:5000});
  const count=rows.length, participants=new Set(rows.map(r=>r.userId)).size;
  const totalQuestions=rows.reduce((s,r)=>s+r.totalQuestions,0), correct=rows.reduce((s,r)=>s+r.correct,0);
  const axesMap=new Map<string,{title:string;correct:number;total:number;seconds:number;attempts:number}>();
  for(const row of rows) for(const raw of (row.axes as Array<Record<string,unknown>>)) {
    const id=String(raw.axisId || 'unknown'), current=axesMap.get(id) || {title:String(raw.title || id),correct:0,total:0,seconds:0,attempts:0};
    current.correct+=Number(raw.correct || 0);current.total+=Number(raw.total || 0);current.seconds+=Number(raw.averageSeconds || 0);current.attempts++;axesMap.set(id,current);
  }
  res.json({summary:{assessments:count,participants,totalQuestions,correct,accuracy:totalQuestions?Math.round(correct/totalQuestions*100):0},axes:[...axesMap.entries()].map(([axisId,v])=>({axisId,title:v.title,correct:v.correct,total:v.total,accuracy:v.total?Math.round(v.correct/v.total*100):0,averageSeconds:v.attempts?Math.round(v.seconds/v.attempts):0})),results:rows.map(r=>({id:r.id,participant:r.user.name,participantCode:r.user.participantCode,group:r.user.group?.name || 'Sem grupo',completedAt:r.completedAt.toISOString(),mode:r.mode,accuracy:r.accuracy,totalQuestions:r.totalQuestions,correct:r.correct}))});
}));

app.use((err: unknown,_req:Request,res:Response,_next:NextFunction) => {
  if (err instanceof Error && err.message === 'INVALID_ANSWER') return res.status(400).json({error:'Resposta inválida ou questão não reconhecida.'});
  console.error(err);
  if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') return res.status(409).json({error:'Já existe um registro com esses dados.'});
  return res.status(500).json({error:'Erro interno. Consulte os registros do serviço.'});
});
export { app };
if (process.env.NODE_ENV !== 'test') app.listen(PORT,'0.0.0.0',()=>console.log('HSI API listening on',PORT));
