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
import { scoreDothp, dothpItems, dothpDimensions } from './instrument-scoring.js';
import { hasRole, validateAssessmentMode } from './security.js';
import { analyzeDataQuality } from './data-quality.js';

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
app.use('/api/public', rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false }));

type AuthUser = {
  id: string; name: string; email: string; role: UserRole; status: UserStatus;
  participantCode: string | null; groupId: string | null; publicAccess?: boolean;
  birthDate?: Date | null; sex?: string | null; city?: string | null; state?: string | null;
  licenseCategory?: string | null; institutionType?: string | null; institutionName?: string | null;
  groupSector?: string | null; researchConsentVersion?: string | null; researchConsentedAt?: Date | null;
};
declare global { namespace Express { interface Request { authUser?: AuthUser } } }

const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

async function withSerializableRetry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await work(); }
    catch (error: any) { if (error?.code !== 'P2034' || attempt === 2) throw error; }
  }
  throw new Error('Não foi possível reservar a sequência da avaliação.');
}
const PRIVACY_NOTICE_VERSION='ENAT-PRIVACY-1.1';
const RESEARCH_CONSENT_VERSION='ENAT-RESEARCH-1.1';
async function recordConsent(userId:string,granted:boolean,source:string,extra:{instrument?:string;assessmentId?:string;privacyNoticeVersion?:string}={}) {
 await prisma.consentEvent.create({data:{userId,purpose:'RESEARCH_USE',granted,consentVersion:RESEARCH_CONSENT_VERSION,privacyNoticeVersion:extra.privacyNoticeVersion||PRIVACY_NOTICE_VERSION,instrument:extra.instrument||null,assessmentId:extra.assessmentId||null,source}});
}
const publicUser = (u: AuthUser) => ({
  id: u.id, name: u.publicAccess ? 'Participante público' : u.name,
  email: u.publicAccess ? null : u.email, role: u.role, status: u.status,
  participantCode: u.participantCode, groupId: u.groupId, publicAccess: Boolean(u.publicAccess),
  researchProfile: (u.publicAccess || u.birthDate || u.sex || u.city || u.state || u.institutionType || (u as any).researchConsentGranted || u.researchConsentVersion) ? {
    birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null,
    sex: u.sex, licenseCategory: u.licenseCategory, city: u.city, state: u.state,
    institutionType: u.institutionType, institutionName: u.institutionName, groupSector: u.groupSector,
    researchConsent: Boolean((u as any).researchConsentGranted), researchConsentVersion: u.researchConsentVersion
  } : null
});

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


const publicParticipantSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(['M', 'F']),
  licenseCategory: z.enum(['NONE','ACC','A','B','C','D','E','AB','AC','AD','AE']).nullable().optional(),
  city: z.string().trim().min(2).max(100),
  state: z.enum(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']),
  institutionType: z.enum(['INDEPENDENT','SCHOOL','COMPANY','PUBLIC_AGENCY','UNIVERSITY','RESEARCH_CENTER','COMMUNITY','OTHER']),
  institutionName: z.string().trim().max(180).nullable().optional(),
  groupSector: z.string().trim().max(120).nullable().optional(),
  privacyNoticeVersion: z.literal(PRIVACY_NOTICE_VERSION),
  researchConsent: z.boolean()
}).strict();

function publicSessionToken(userId: string) {
  return jwt.sign({ access: 'public-participant' }, JWT_SECRET!, { subject: userId, expiresIn: '365d', issuer: 'hsi-visual-cognitivo' });
}

app.post('/api/public/participants', asyncRoute(async (req, res) => {
  const parsed = publicParticipantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Confira os dados obrigatórios e a confirmação do aviso de privacidade.', details: parsed.error.flatten() });
  const data = parsed.data;
  const birthDate = new Date(data.birthDate + 'T00:00:00.000Z');
  if (!Number.isFinite(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== data.birthDate || birthDate > new Date()) {
    return res.status(400).json({ error: 'Informe uma data de nascimento válida.' });
  }
  if (data.institutionType === 'INDEPENDENT' && data.institutionName?.trim()) {
    return res.status(400).json({ error: 'O nome da instituição só pode ser informado quando houver vínculo institucional.' });
  }
  const participantCode = 'ENAT-PUB-' + crypto.randomBytes(24).toString('base64url');
  const email = 'public-' + crypto.randomUUID() + '@anonymous.hsi.invalid';
  const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12);
  const user = await prisma.user.create({ data: {
    name: 'Participante público', email, passwordHash, role: UserRole.PARTICIPANT, status: UserStatus.ACTIVE,
    participantCode, publicAccess: true, birthDate, sex: data.sex, city: data.city, state: data.state,
    licenseCategory: data.licenseCategory || null, institutionType: data.institutionType,
    institutionName: data.institutionName?.trim() || null, groupSector: data.groupSector?.trim() || null,
    privacyNoticeVersion: data.privacyNoticeVersion, privacyAcknowledgedAt: new Date(),
    researchConsentVersion: RESEARCH_CONSENT_VERSION,
    researchConsentedAt: data.researchConsent ? new Date() : null,
    researchConsentGranted: data.researchConsent
  }});
  await recordConsent(user.id,data.researchConsent,'PUBLIC_REGISTRATION',{privacyNoticeVersion:data.privacyNoticeVersion});
  await prisma.auditLog.create({ data: {
    actorId: user.id, action: 'PUBLIC_PARTICIPANT_CREATE', targetType: 'USER', targetId: user.id,
    metadata: { publicAccess: true, researchConsent: data.researchConsent, privacyNoticeVersion: data.privacyNoticeVersion }
  }});
  return res.status(201).json({ token: publicSessionToken(user.id), expiresIn: 31536000, participantCode, user: publicUser(user as AuthUser) });
}));

app.post('/api/public/session', asyncRoute(async (req, res) => {
  const parsed = z.object({ participantCode: z.string().trim().min(30).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Informe seu código privado de participante.' });
  const user = await prisma.user.findUnique({ where: { participantCode: parsed.data.participantCode } });
  if (!user || !user.publicAccess || user.status !== UserStatus.ACTIVE) return res.status(401).json({ error: 'Código de participante inválido. Confira os caracteres e tente novamente.' });
  await prisma.auditLog.create({ data: { actorId: user.id, action: 'PUBLIC_PARTICIPANT_RESUME', targetType: 'USER', targetId: user.id }});
  return res.json({ token: publicSessionToken(user.id), expiresIn: 31536000, participantCode: user.participantCode, user: publicUser(user as AuthUser) });
}));


app.patch('/api/public/research-consent', authenticate, asyncRoute(async (req, res) => {
  if (!req.authUser!.publicAccess) return res.status(403).json({ error: 'Esta operação está disponível somente para participantes públicos.' });
  const parsed = z.object({ researchConsent: z.boolean() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Informe uma opção válida de consentimento.' });
  const enabled = parsed.data.researchConsent;
  const user = await prisma.user.update({
    where: { id: req.authUser!.id },
    data: {
      researchConsentVersion: RESEARCH_CONSENT_VERSION,
      researchConsentedAt: enabled ? new Date() : null,
      researchConsentGranted: enabled
    }
  });
  await recordConsent(user.id,enabled,'PARTICIPANT_PREFERENCE');
  await prisma.auditLog.create({ data: {
    actorId: user.id, action: enabled ? 'PUBLIC_RESEARCH_CONSENT_GRANTED' : 'PUBLIC_RESEARCH_CONSENT_WITHDRAWN',
    targetType: 'USER', targetId: user.id, metadata: { researchConsent: enabled }
  }});
  return res.json({ user: publicUser(user as AuthUser) });
}));

const researchProfileSchema = z.object({
  birthDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  sex: z.enum(['M','F']),
  licenseCategory: z.enum(['NONE','ACC','A','B','C','D','E','AB','AC','AD','AE']).nullable().optional(),
  city: z.string().trim().min(2).max(100),
  state: z.enum(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']),
  institutionType: z.enum(['INDEPENDENT','SCHOOL','COMPANY','PUBLIC_AGENCY','UNIVERSITY','RESEARCH_CENTER','COMMUNITY','OTHER']),
  institutionName: z.string().trim().max(180).nullable().optional(),
  groupSector: z.string().trim().max(120).nullable().optional(),
  privacyNoticeVersion: z.literal(PRIVACY_NOTICE_VERSION),
  researchConsent: z.boolean()
}).strict();

app.patch('/api/auth/research-profile', authenticate, asyncRoute(async (req, res) => {
  const parsed = researchProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Confira os dados obrigatórios do cadastro de pesquisa.', details: parsed.error.flatten() });
  const data = parsed.data;
  const birthDate = new Date(data.birthDate + 'T00:00:00.000Z');
  if (!Number.isFinite(birthDate.getTime()) || birthDate.toISOString().slice(0,10) !== data.birthDate || birthDate > new Date()) {
    return res.status(400).json({ error: 'Informe uma data de nascimento válida.' });
  }
  if (data.institutionType === 'INDEPENDENT' && data.institutionName?.trim()) {
    return res.status(400).json({ error: 'O nome da instituição só pode ser informado quando houver vínculo institucional.' });
  }
  const user = await prisma.user.update({
    where: { id: req.authUser!.id },
    data: {
      birthDate, sex: data.sex, city: data.city, state: data.state,
      licenseCategory: data.licenseCategory || null, institutionType: data.institutionType,
      institutionName: data.institutionName?.trim() || null, groupSector: data.groupSector?.trim() || null,
      privacyNoticeVersion: data.privacyNoticeVersion, privacyAcknowledgedAt: new Date(),
      researchConsentVersion: RESEARCH_CONSENT_VERSION,
      researchConsentedAt: data.researchConsent ? new Date() : null,
      researchConsentGranted: data.researchConsent
    }
  });
  await recordConsent(user.id,data.researchConsent,'RESEARCH_PROFILE_UPDATE',{privacyNoticeVersion:data.privacyNoticeVersion});
  await prisma.auditLog.create({ data: {
    actorId: user.id, action: 'RESEARCH_PROFILE_UPDATED', targetType: 'USER', targetId: user.id,
    metadata: { researchConsent: data.researchConsent, privacyNoticeVersion: data.privacyNoticeVersion }
  }});
  return res.json({ user: publicUser(user as AuthUser) });
}));

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.authUser!) }));

app.patch('/api/auth/research-consent',authenticate,asyncRoute(async(req,res)=>{
 const parsed=z.object({researchConsent:z.boolean()}).strict().safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Informe uma escolha válida.'});
 const granted=parsed.data.researchConsent;
 const user=await prisma.user.update({where:{id:req.authUser!.id},data:{researchConsentGranted:granted,researchConsentVersion:RESEARCH_CONSENT_VERSION,researchConsentedAt:granted?new Date():null}});
 await recordConsent(user.id,granted,'ACCOUNT_PRIVACY_CENTER');
 await prisma.auditLog.create({data:{actorId:user.id,action:granted?'RESEARCH_CONSENT_GRANTED':'RESEARCH_CONSENT_WITHDRAWN',targetType:'USER',targetId:user.id,metadata:{consentVersion:RESEARCH_CONSENT_VERSION}}});
 res.json({user:publicUser(user as AuthUser)});
}));

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
  const users = await prisma.user.findMany({ where: req.authUser!.role === UserRole.ANALYST ? { role: UserRole.PARTICIPANT } : {}, select: { id:true,name:true,email:true,role:true,status:true,participantCode:true,publicAccess:true,birthDate:true,sex:true,city:true,state:true,licenseCategory:true,institutionType:true,institutionName:true,groupSector:true,privacyNoticeVersion:true,privacyAcknowledgedAt:true,researchConsentVersion:true,researchConsentedAt:true,groupId:true,createdAt:true,group:{select:{id:true,name:true}} }, orderBy: { createdAt:'desc' } });
  res.json({ users: users.map(user => ({ ...user, name:user.publicAccess?'Participante público':user.name, email:user.publicAccess?null:user.email })) });
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
  const [users,activeUsers,participants,analysts,admins,groups,assessments,instrumentAssessments,cognitiveGroups,behavioralGroups,experimentalCognitive,experimentalBehavioral,baselineCognitive,baselineBehavioral] = await Promise.all([
    prisma.user.count(), prisma.user.count({where:{status:UserStatus.ACTIVE}}),
    prisma.user.count({where:{role:UserRole.PARTICIPANT}}), prisma.user.count({where:{role:UserRole.ANALYST}}),
    prisma.user.count({where:{role:UserRole.ADMIN}}), prisma.participantGroup.count(),
    prisma.assessmentResult.count(), prisma.instrumentAssessment.count(),
    prisma.assessmentResult.groupBy({by:['userId'],_count:{_all:true}}),
    prisma.instrumentAssessment.groupBy({by:['userId'],_count:{_all:true}}),
    prisma.assessmentResult.count({where:{applicationType:'EXPERIMENTAL'}}),
    prisma.instrumentAssessment.count({where:{applicationType:'EXPERIMENTAL'}}),
    prisma.assessmentResult.count({where:{applicationType:'BASELINE'}}),
    prisma.instrumentAssessment.count({where:{applicationType:'BASELINE'}})
  ]);
  const returningParticipants=new Set([
    ...cognitiveGroups.filter(row=>row._count._all>1).map(row=>row.userId),
    ...behavioralGroups.filter(row=>row._count._all>1).map(row=>row.userId)
  ]);
  const repeatApplications=[
    ...cognitiveGroups.map(row=>Math.max(0,row._count._all-1)),
    ...behavioralGroups.map(row=>Math.max(0,row._count._all-1))
  ].reduce((sum,count)=>sum+count,0);
  res.json({
    generatedAt:new Date().toISOString(),
    system:{api:'operational',database:'connected'},
    counts:{users,activeUsers,participants,analysts,admins,groups,assessments,instrumentAssessments},
    longitudinal:{repeatApplications,returningParticipants:returningParticipants.size,experimentalApplications:experimentalCognitive+experimentalBehavioral,baselineApplications:baselineCognitive+baselineBehavioral}
  });
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
  const version=await ensureActiveInstrumentVersion('HSI Visual Cognitivo');
  const bank=version.questions as Array<any>;
  const safe=bank.map(({id,axis,prompt,visual,options}:any)=>({id,axis,prompt,visual,options}));
  if (mode === 'full') return res.json({ questions: safe, instrumentVersion:version.version });
  if (mode === 'axis' && axisId && ['logic','attention','patterns','anticipation','risk','decision'].includes(axisId)) {
    const delivered = safe.filter(q => q.axis === axisId);
    if (delivered.length !== 5) return res.status(500).json({ error: 'Banco de questões inconsistente na versão ativa.' });
    return res.json({ questions: delivered, instrumentVersion:version.version });
  }
  return res.status(400).json({ error: 'Modalidade ou eixo inválido.' });
}));

const resultSchema = z.object({
  id:z.string().min(8).max(100), mode:z.enum(['Avaliação completa','Eixo individual']),
  completedAt:z.string().datetime(), totalQuestions:z.number().int().min(1).max(30),
  durationSeconds:z.number().int().min(1).max(86400),
  researchConsent:z.boolean(),
  studyCode:z.string().trim().min(2).max(80).optional(),
  studyGroupCode:z.string().trim().min(1).max(40).optional(),
  instrumentVersion:z.string().trim().min(1).max(20).default('1.0'),
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
  const activeVersion=await ensureActiveInstrumentVersion('HSI Visual Cognitivo');
  const versionQuestions=activeVersion.questions as Array<any>;
  const bank = new Map(versionQuestions.map((q: any) => [q.id, q] as [string, any]));
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

  const axes = [...new Set(verified.map(a => a.axisId))].map(axisId => {
    const rows = verified.filter(a => a.axisId === axisId);
    const axisTitles: Record<string,string> = { logic:'Raciocínio lógico', attention:'Atenção seletiva', patterns:'Percepção de padrões', anticipation:'Antecipação de situações', risk:'Percepção de riscos no trânsito', decision:'Tomada de decisão' };
    const axisCorrect = rows.filter(a => a.correct).length;
    return { axisId, title: axisTitles[axisId] || axisId, correct: axisCorrect, total: rows.length, accuracy: Math.round(axisCorrect / rows.length * 100), averageSeconds: Math.round(rows.reduce((sum,a) => sum + a.seconds, 0) / rows.length) };
  });
  const weights=(activeVersion.scoringCriteria as any).axisWeights||{logic:1,attention:1,patterns:1,anticipation:1,risk:1,decision:1};
  const applicableWeight=axes.reduce((sum,axis)=>sum+Number(weights[axis.axisId]||0),0);
  const accuracy=applicableWeight?Math.round(axes.reduce((sum,axis)=>sum+axis.accuracy*Number(weights[axis.axisId]||0),0)/applicableWeight):0;
  const studyCode=d.studyCode?.trim()||null;
  const study=studyCode?await prisma.scientificStudy.findUnique({where:{code:studyCode}}):null;
  if(studyCode&&(!study||study.status!=='ACTIVE'))return res.status(400).json({error:'Estudo não encontrado ou não está ativo para receber aplicações.'});
  const studyGroup= d.studyGroupCode&&study ? await prisma.studyGroup.findUnique({where:{studyId_code:{studyId:study.id,code:d.studyGroupCode}}}) : null;
  if(d.studyGroupCode&&!studyGroup)return res.status(400).json({error:'Grupo de pesquisa não pertence ao estudo informado.'});
  const result = await withSerializableRetry(() => prisma.$transaction(async tx => {
    const existing = await tx.assessmentResult.findUnique({where:{id:d.id}});
    if (existing) throw Object.assign(new Error('Identificador de resultado já utilizado.'), { status: 409 });
    const applicationNumber = await tx.assessmentResult.count({where:{userId:req.authUser!.id}}) + 1;
    const created = await tx.assessmentResult.create({data:{
      id:d.id,userId:req.authUser!.id,participantCode:req.authUser!.participantCode || 'SEM-CÓDIGO',
      mode:d.mode,completedAt:new Date(d.completedAt),totalQuestions:verified.length,correct,accuracy,
      durationSeconds:d.durationSeconds,axes:axes as Prisma.InputJsonValue,answerDetails:verified as Prisma.InputJsonValue,
      applicationNumber,applicationType:studyCode?'EXPERIMENTAL':applicationNumber===1?'BASELINE':'REEVALUATION',
      studyCode,instrumentVersion:activeVersion.version,instrumentVersionId:activeVersion.id,
      scoringSnapshot:activeVersion.scoringCriteria as Prisma.InputJsonValue,versionVerification:'VERIFIED',
      researchConsentGranted:d.researchConsent,researchConsentVersion:RESEARCH_CONSENT_VERSION,researchConsentedAt:d.researchConsent?new Date():null,
      studyId:study?.id||null,studyGroupId:studyGroup?.id||null
    }});
    await tx.consentEvent.create({data:{userId:req.authUser!.id,purpose:'RESEARCH_USE',granted:d.researchConsent,consentVersion:RESEARCH_CONSENT_VERSION,instrument:'HSI Visual Cognitivo',assessmentId:created.id,source:'ASSESSMENT_SUBMISSION'}});
    await tx.auditLog.create({data:{actorId:req.authUser!.id,action:'ASSESSMENT_SUBMIT',targetType:'RESULT',targetId:created.id,metadata:{applicationNumber,applicationType:created.applicationType,studyCode}}});
    return created;
  }, {isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
  res.status(201).json({result});
}));


const instrumentResultSchema = z.object({
  id: z.string().min(8).max(100),
  instrument: z.literal('HSI-DOTH-P'),
  context: z.enum(['cotidiano','trabalho','educacao','familia','social','digital','transito','integrado']),
  answers: z.array(z.number().int().min(1).max(5)).length(25),
  contextVersion: z.string().max(20).default('1.0'),
  instrumentVersion: z.string().trim().min(1).max(20).default('1.0'),
  studyCode: z.string().trim().min(2).max(80).optional(),
  studyGroupCode: z.string().trim().min(1).max(40).optional(),
  researchConsent: z.boolean(),
  participantData: z.object({
    birthDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sex:z.enum(['M','F']),
    licenseCategory:z.enum(['NONE','ACC','A','B','C','D','E','AB','AC','AD','AE']).nullable().optional(),
    city:z.string().trim().min(2).max(100),
    state:z.string().trim().length(2).transform(v=>v.toUpperCase()),
    country:z.literal('BR').default('BR'),
    institutionType:z.enum(['INDEPENDENT','SCHOOL','COMPANY','PUBLIC_AGENCY','UNIVERSITY','RESEARCH_CENTER','COMMUNITY','OTHER']),
    institutionName:z.string().trim().max(180).nullable().optional(),
    groupSector:z.string().trim().max(120).nullable().optional(),
  }).optional(),
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
    prisma.instrumentAssessment.findMany({where:{userId:req.authUser!.id,instrument:'HSI-DOTH-P'},orderBy:[{completedAt:'asc'},{createdAt:'asc'},{id:'asc'}],select:{id:true,context:true,contextVersion:true,completedAt:true,createdAt:true,dimensions:true,applicationNumber:true,applicationType:true,studyCode:true,instrumentVersion:true}}),
    prisma.assessmentResult.findMany({where:{userId:req.authUser!.id},orderBy:[{completedAt:'asc'},{createdAt:'asc'},{id:'asc'}],select:{id:true,mode:true,completedAt:true,createdAt:true,accuracy:true,correct:true,totalQuestions:true,axes:true,applicationNumber:true,applicationType:true,studyCode:true,instrumentVersion:true}})
  ]);
  const labels:Record<string,string>={cotidiano:'Vida cotidiana e relações pessoais',trabalho:'Trabalho e ambiente profissional',educacao:'Estudos e aprendizagem',familia:'Família e convivência',social:'Comunidade e participação social',digital:'Ambientes digitais',transito:'Mobilidade e trânsito',integrado:'Diferentes contextos da vida'};
  const normalized=behavioral.map(row=>({id:row.id,context:row.context,contextLabel:labels[row.context]||row.context,contextVersion:row.contextVersion,completedAt:row.completedAt.toISOString(),applicationNumber:row.applicationNumber,applicationType:row.applicationType,studyCode:row.studyCode,instrumentVersion:row.instrumentVersion,dimensions:(row.dimensions as Array<Record<string,unknown>>).map(d=>({id:String(d.id||'unknown'),name:String(d.name||d.id||'Dimensão'),score:Number(d.score||0),mean:Number(d.mean||0)}))}));
  const previousByContext=new Map<string,typeof normalized[number]>();
  const behavioralTimeline=normalized.map(row=>{
    const previous=previousByContext.get(row.context);
    const comparison=row.dimensions.map(d=>{const old=previous?.dimensions.find(x=>x.id===d.id);return{dimensionId:d.id,score:d.score,previousScore:old?.score??null,difference:old?d.score-old.score:null};});
    previousByContext.set(row.context,row);
    return{...row,comparisonWithPreviousSameContext:comparison};
  });
  const contexts=[...new Set(normalized.map(row=>row.context))].map(context=>{
    const rows=normalized.filter(row=>row.context===context),latest=rows[rows.length-1];
    return{context,label:labels[context]||context,applications:rows.length,firstCompletedAt:rows[0].completedAt,latestCompletedAt:latest.completedAt,dimensions:latest.dimensions.map(d=>{const values=rows.map(r=>r.dimensions.find(x=>x.id===d.id)?.score).filter((v):v is number=>typeof v==='number');return{id:d.id,name:d.name,latestScore:d.score,meanAcrossApplications:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null,observations:values.length};})};
  });
  const cognitiveTimeline=cognitive.map(row=>({id:row.id,mode:row.mode,completedAt:row.completedAt.toISOString(),accuracy:row.accuracy,correct:row.correct,totalQuestions:row.totalQuestions,applicationNumber:row.applicationNumber,applicationType:row.applicationType,studyCode:row.studyCode,instrumentVersion:row.instrumentVersion,axes:row.axes}));
  res.json({generatedAt:new Date().toISOString(),methodology:{behavioralInstrument:'HSI-DOTH-P',cognitiveInstrument:'HSI Visual Cognitivo',scalesCombined:false,causalInference:false,repeatApplications:'Ilimitadas; cada envio válido gera novo registro imutável, com numeração própria por instrumento.',applicationTypes:['BASELINE','REEVALUATION','EXPERIMENTAL'],note:'As séries comportamental e cognitiva são apresentadas separadamente. Diferenças entre aplicações são descritivas e não comprovam mudança estável, validade preditiva ou causalidade.'},totals:{behavioralApplications:behavioral.length,cognitiveApplications:cognitive.length},contexts,behavioralTimeline,cognitiveTimeline});
}));

app.post('/api/instrument-results', authenticate, asyncRoute(async (req,res) => {
  const parsed = instrumentResultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Questionário incompleto ou dados inválidos.', details: parsed.error.flatten() });
  const data = parsed.data;
  const existing = await prisma.instrumentAssessment.findUnique({ where: { id: data.id } });
  if (existing) return res.status(409).json({ error: 'Identificador de avaliação já utilizado.' });
  const participant = await prisma.user.findUnique({where:{id:req.authUser!.id},select:{groupId:true,group:{select:{institutionId:true,city:true,state:true,institution:{select:{city:true,state:true}}}}}});
  const profile = data.participantData;
  const birthDateValue = profile ? new Date(profile.birthDate+'T00:00:00.000Z') : null;
  if(profile && (!birthDateValue || Number.isNaN(birthDateValue.getTime()) || birthDateValue.toISOString().slice(0,10)!==profile.birthDate))return res.status(400).json({error:'Data de nascimento inválida.'});
  if(birthDateValue && birthDateValue>new Date())return res.status(400).json({error:'A data de nascimento não pode estar no futuro.'});
  const linkedInstitution = profile?.institutionName && profile.institutionType!=='INDEPENDENT' && ['SCHOOL','COMPANY','PUBLIC_AGENCY','RESEARCH_CENTER','OTHER'].includes(profile.institutionType)
    ? await prisma.institution.findFirst({where:{active:true,name:{equals:profile.institutionName,mode:'insensitive'},city:{equals:profile.city,mode:'insensitive'},state:profile.state,type:profile.institutionType as any},select:{id:true}})
    : null;
  const activeVersion=await ensureActiveInstrumentVersion('HSI-DOTH-P');
  const scored = scoreDothp(data.answers, data.context, activeVersion.questions as Array<Record<string, any>>, activeVersion.scoringCriteria as Record<string, any>);
  const studyCode=data.studyCode?.trim()||null;
  const study=studyCode?await prisma.scientificStudy.findUnique({where:{code:studyCode}}):null;
  if(studyCode&&(!study||study.status!=='ACTIVE'))return res.status(400).json({error:'Estudo não encontrado ou não está ativo para receber aplicações.'});
  const studyGroup=data.studyGroupCode&&study?await prisma.studyGroup.findUnique({where:{studyId_code:{studyId:study.id,code:data.studyGroupCode}}}):null;
  if(data.studyGroupCode&&!studyGroup)return res.status(400).json({error:'Grupo de pesquisa não pertence ao estudo informado.'});
  const result = await withSerializableRetry(() => prisma.$transaction(async tx => {
    const existing = await tx.instrumentAssessment.findUnique({where:{id:data.id}});
    if(existing) throw Object.assign(new Error('Identificador de avaliação já utilizado.'), {status:409});
    const applicationNumber = await tx.instrumentAssessment.count({where:{userId:req.authUser!.id,instrument:data.instrument}}) + 1;
    const created = await tx.instrumentAssessment.create({
    data: {
      id: data.id,
      userId: req.authUser!.id,
      instrument: data.instrument,
      context: data.context,
      contextVersion: data.contextVersion,
      instrumentVersion: activeVersion.version,
      instrumentVersionId: activeVersion.id,
      scoringSnapshot: activeVersion.scoringCriteria as Prisma.InputJsonValue,
      versionVerification: 'VERIFIED',
      studyId: study?.id || null,
      studyGroupId: studyGroup?.id || null,
      applicationNumber,
      applicationType: studyCode?'EXPERIMENTAL':applicationNumber===1?'BASELINE':'REEVALUATION',
      studyCode,
      groupId: participant?.groupId || null,
      institutionId: linkedInstitution?.id || (profile ? null : participant?.group?.institutionId || null),
      city: profile?.city || participant?.group?.city || participant?.group?.institution?.city || null,
      state: profile?.state || participant?.group?.state || participant?.group?.institution?.state || null,
      birthDate: birthDateValue,
      sex: profile?.sex || null,
      licenseCategory: profile?.licenseCategory || null,
      institutionType: profile?.institutionType || null,
      institutionName: profile?.institutionName || null,
      groupSector: profile?.groupSector || null,
      consentVersion: RESEARCH_CONSENT_VERSION,
      consentedAt: data.researchConsent ? new Date() : null,
      researchConsentGranted: data.researchConsent,
      completedAt: new Date(),
      answers: scored.answers as Prisma.InputJsonValue,
      dimensions: scored.dimensions as Prisma.InputJsonValue,
    },
    });
    await tx.consentEvent.create({data:{userId:req.authUser!.id,purpose:'RESEARCH_USE',granted:data.researchConsent,consentVersion:RESEARCH_CONSENT_VERSION,instrument:'HSI-DOTH-P',assessmentId:created.id,source:'ASSESSMENT_SUBMISSION'}});
    await tx.auditLog.create({ data: { actorId: req.authUser!.id, action: 'INSTRUMENT_SUBMIT', targetType: 'INSTRUMENT_RESULT', targetId: created.id, metadata: { instrument: data.instrument, context: data.context, applicationNumber, applicationType:created.applicationType, studyCode } } });
    return created;
  }, {isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
  res.status(201).json({ result: { ...result, completedAt: result.completedAt.toISOString() } });
}));

app.get('/api/analytics', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (req,res) => {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : new Date(Date.now()-30*86400000);
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
  const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return res.status(400).json({error:'Período inválido.'});
  const where = { completedAt:{gte:from,lte:to}, researchConsentGranted:true, user:{ ...(groupId ? {groupId} : {}) } };
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
  const userFilter={...(groupId?{groupId}:{})};
  const where={completedAt:{gte:from,lte:to},researchConsentGranted:true,user:userFilter};
  const [cognitive,instruments]=await Promise.all([
    prisma.assessmentResult.findMany({where,select:{userId:true,totalQuestions:true,correct:true,axes:true,answerDetails:true,completedAt:true}}),
    prisma.instrumentAssessment.findMany({where:{completedAt:{gte:from,lte:to},researchConsentGranted:true,user:userFilter},select:{userId:true,context:true,dimensions:true,answers:true,completedAt:true}})
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



app.get('/api/admin/national-analytics', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (req,res) => {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : new Date(Date.now()-365*86400000);
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return res.status(400).json({error:'Período inválido.'});
  const minimumGroupSize = 5;
  const userFilter = {OR:[{publicAccess:false},{publicAccess:true,researchConsentedAt:{not:null}}]};
  const [cognitiveRows,behavioralRows] = await Promise.all([
    prisma.assessmentResult.findMany({where:{completedAt:{gte:from,lte:to},researchConsentGranted:true,user:userFilter},select:{userId:true,completedAt:true,totalQuestions:true,correct:true,axes:true,answerDetails:true,user:{select:{city:true,state:true,institutionName:true,institutionType:true}}}}),
    prisma.instrumentAssessment.findMany({where:{completedAt:{gte:from,lte:to},researchConsentGranted:true,user:userFilter},select:{userId:true,completedAt:true,context:true,dimensions:true,answers:true,city:true,state:true,institutionName:true,institutionType:true,institution:{select:{name:true,type:true,city:true,state:true}}}})
  ]);
  const build = (rows:any[], kind:'cognitive'|'behavioral') => {
    const users = new Set(rows.map(row=>row.userId));
    const suppressed = users.size < minimumGroupSize;
    const geo = new Map<string,any>();
    const months = new Map<string,any>();
    const dimensions = new Map<string,any>();
    const axes = new Map<string,any>();
    const contexts = new Map<string,any>();
    const likert = [0,0,0,0,0];
    const quality = {uniformResponseApplications:0,concentratedResponseApplications:0};
    const responseTimes = {under3:0,from3to5:0,from6to10:0,over10:0};
    for (const row of rows) {
      const monthKey=row.completedAt.toISOString().slice(0,7);
      const month=months.get(monthKey)||{period:monthKey,applications:0,users:new Set<string>(),correct:0,total:0};
      month.applications++;month.users.add(row.userId);
      if(kind==='cognitive'){month.correct+=row.correct;month.total+=row.totalQuestions;}
      months.set(monthKey,month);
      if(kind==='cognitive'){
        for(const raw of row.axes as Array<Record<string,unknown>>){
          const id=String(raw.axisId||'unknown');
          const a=axes.get(id)||{id,title:String(raw.title||id),correct:0,total:0,seconds:0,attempts:0,fastErrors:0,slowCorrect:0,scores:[] as number[]};
          a.correct+=Number(raw.correct||0);a.total+=Number(raw.total||0);a.seconds+=Number(raw.averageSeconds||0);a.attempts++;a.scores.push(Number(raw.total||0)?Math.round(Number(raw.correct||0)/Number(raw.total||0)*100):0);axes.set(id,a);
        }
        for(const answer of row.answerDetails as Array<Record<string,unknown>>){
          const seconds=Number(answer.seconds||0);
          if(seconds<3)responseTimes.under3++;else if(seconds<=5)responseTimes.from3to5++;else if(seconds<=10)responseTimes.from6to10++;else responseTimes.over10++;
          const a=axes.get(String(answer.axisId||''));
          if(a&&answer.correct===false&&seconds<=5)a.fastErrors++;
          if(a&&answer.correct===true&&seconds>=15)a.slowCorrect++;
        }
      }else{
        const c=contexts.get(row.context)||{context:row.context,applications:0,users:new Set<string>(),dimensions:new Map<string,any>()};c.applications++;c.users.add(row.userId);for(const raw of row.dimensions as Array<Record<string,unknown>>){const id=String(raw.id||'unknown');const d=c.dimensions.get(id)||{name:String(raw.name||id),sum:0,count:0};d.sum+=Number(raw.score||0);d.count++;c.dimensions.set(id,d);}contexts.set(row.context,c);
        const values=(row.answers as Array<Record<string,unknown>>).map(a=>Number(a.response||0)).filter(v=>v>=1&&v<=5);
        const counts=[1,2,3,4,5].map(v=>values.filter(x=>x===v).length);
        if(values.length===25&&new Set(values).size===1)quality.uniformResponseApplications++;
        if(values.length&&Math.max(...counts)/values.length>=0.8)quality.concentratedResponseApplications++;
        for(const a of row.answers as Array<Record<string,unknown>>){const v=Number(a.response||0);if(v>=1&&v<=5)likert[v-1]++;}
        for(const raw of row.dimensions as Array<Record<string,unknown>>){
          const id=String(raw.id||'unknown');const d=dimensions.get(id)||{id,name:String(raw.name||id),sum:0,count:0,low:0,medium:0,high:0};
          const score=Number(raw.score||0);d.sum+=score;d.count++;if(score<34)d.low++;else if(score<67)d.medium++;else d.high++;dimensions.set(id,d);
        }
      }
      const profile=kind==='cognitive'?row.user:row;
      const city=String(profile.city||profile.institution?.city||'').trim();
      const state=String(profile.state||profile.institution?.state||'').trim().toUpperCase();
      const institution=String(profile.institutionName||profile.institution?.name||'').trim();
      const institutionType=String(profile.institutionType||profile.institution?.type||'OTHER');
      const add=(key:string,label:string,type:string)=>{
        const g=geo.get(key)||{id:key,label,type,state,city,applications:0,users:new Set<string>(),correct:0,total:0,dimensions:new Map<string,any>()};
        g.applications++;g.users.add(row.userId);
        if(kind==='cognitive'){g.correct+=row.correct;g.total+=row.totalQuestions;}
        else for(const raw of row.dimensions as Array<Record<string,unknown>>){
          const id=String(raw.id||'unknown');const d=g.dimensions.get(id)||{dimensionId:id,name:String(raw.name||id),sum:0,count:0};
          d.sum+=Number(raw.score||0);d.count++;g.dimensions.set(id,d);
        }
        geo.set(key,g);
      };
      if(state)add('uf:'+state,state,'state');
      if(state&&city)add('city:'+state+':'+city,city+'/'+state,'city');
      if(state&&city&&institution&&institutionType!=='INDEPENDENT')add('institution:'+state+':'+city+':'+institutionType+':'+institution.toLowerCase(),institution+' · '+city+'/'+state,'institution');
    }
    const groupRows=(type:string)=>[...geo.values()].filter(g=>g.type===type&&g.users.size>=minimumGroupSize).map(g=>({id:g.id,label:g.label,state:g.state,city:g.city,applications:g.applications,participants:g.users.size,accuracy:g.total?Math.round(g.correct/g.total*100):null,dimensions:[...g.dimensions.values()].map(d=>({dimensionId:d.dimensionId,name:d.name,score:Math.round(d.sum/d.count)}))})).sort((a,b)=>b.participants-a.participants);
    const monthly=[...months.values()].filter(m=>m.users.size>=minimumGroupSize).sort((a,b)=>a.period.localeCompare(b.period)).map(m=>({period:m.period,applications:m.applications,participants:m.users.size,accuracy:m.total?Math.round(m.correct/m.total*100):null}));
    const total=kind==='cognitive'?rows.reduce((s,r)=>s+r.totalQuestions,0):0;
    const correct=kind==='cognitive'?rows.reduce((s,r)=>s+r.correct,0):0;
    return {
      privacy:{suppressed,minimumGroupSize,distinctParticipants:users.size},
      summary:suppressed?{participants:0,applications:0,correct:0,totalQuestions:0,accuracy:null}:{participants:users.size,applications:rows.length,correct:kind==='cognitive'?correct:null,totalQuestions:kind==='cognitive'?total:null,accuracy:kind==='cognitive'&&total?Math.round(correct/total*100):null},
      monthly:suppressed?[]:monthly,states:suppressed?[]:groupRows('state'),cities:suppressed?[]:groupRows('city'),institutions:suppressed?[]:groupRows('institution'),
      axes:suppressed?[]:[...axes.values()].map(a=>{const mean=a.scores.length?a.scores.reduce((sum:number,value:number)=>sum+value,0)/a.scores.length:0;const variation=a.scores.length?Math.sqrt(a.scores.reduce((sum:number,value:number)=>sum+Math.pow(value-mean,2),0)/a.scores.length):0;return{id:a.id,title:a.title,correct:a.correct,total:a.total,accuracy:a.total?Math.round(a.correct/a.total*100):0,averageSeconds:a.attempts?Number((a.seconds/a.attempts).toFixed(1)):0,variation:Number(variation.toFixed(1)),fastErrors:a.fastErrors,slowCorrect:a.slowCorrect};}),
      dimensions:suppressed?[]:[...dimensions.values()].map(d=>({id:d.id,name:d.name,score:d.count?Math.round(d.sum/d.count):0,applications:d.count,low:d.low,medium:d.medium,high:d.high})),
      contexts:suppressed?[]:[...contexts.values()].filter(c=>c.users.size>=minimumGroupSize).map(c=>({context:c.context,applications:c.applications,participants:c.users.size,dimensions:[...c.dimensions.entries()].map(([id,d])=>({id,name:d.name,score:Math.round(d.sum/d.count)}))})),
      likert:suppressed?[]:likert.map((count,index)=>({value:index+1,count})),
      quality:suppressed?{uniformResponseApplications:0,concentratedResponseApplications:0}:quality,
      responseTimes:suppressed?{under3:0,from3to5:0,from6to10:0,over10:0}:responseTimes
    };
  };
  const cognitive=build(cognitiveRows,'cognitive');
  const behavioral=build(behavioralRows,'behavioral');
  const participants=new Set([...cognitiveRows.map(r=>r.userId),...behavioralRows.map(r=>r.userId)]);
  const recurring=new Set<string>();
  for(const rows of [cognitiveRows,behavioralRows]){
    const counts=new Map<string,number>();for(const row of rows)counts.set(row.userId,(counts.get(row.userId)||0)+1);
    for(const [id,count] of counts)if(count>1)recurring.add(id);
  }
  const monthlyMap=new Map<string,any>();
  for(const [rows,key] of [[cognitiveRows,'cognitiveApplications'],[behavioralRows,'behavioralApplications']] as const)for(const row of rows){
    const period=row.completedAt.toISOString().slice(0,7);const m=monthlyMap.get(period)||{period,cognitiveApplications:0,behavioralApplications:0,users:new Set<string>()};m[key]++;m.users.add(row.userId);monthlyMap.set(period,m);
  }
  const executiveSuppressed=participants.size<minimumGroupSize;
  const executiveMonthly=executiveSuppressed?[]:[...monthlyMap.values()].filter(m=>m.users.size>=minimumGroupSize).sort((a,b)=>a.period.localeCompare(b.period)).map(m=>({period:m.period,cognitiveApplications:m.cognitiveApplications,behavioralApplications:m.behavioralApplications,totalApplications:m.cognitiveApplications+m.behavioralApplications,participants:m.users.size}));
  res.json({
    generatedAt:new Date().toISOString(),period:{from:from.toISOString(),to:to.toISOString()},privacy:{minimumGroupSize,executiveSuppressed},
    executive:executiveSuppressed?{participants:0,participantsRecurring:0,totalApplications:0,cognitiveApplications:0,behavioralApplications:0,monthly:[]}:{participants:participants.size,participantsRecurring:recurring.size,totalApplications:cognitiveRows.length+behavioralRows.length,cognitiveApplications:cognitiveRows.length,behavioralApplications:behavioralRows.length,monthly:executiveMonthly},
    cognitive,behavioral
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
    where:{completedAt:{gte:from,lte:to},researchConsentGranted:true,...(parsed.data.institutionId?{institutionId:parsed.data.institutionId}:{}),...(parsed.data.context?{context:parsed.data.context}:{})},
    select:{userId:true,institutionId:true,city:true,state:true,context:true,dimensions:true,institutionType:true,institutionName:true,groupSector:true,institution:{select:{name:true,type:true,city:true,state:true}},completedAt:true}
  });
  const participants=new Set(rows.map(x=>x.userId)).size;
  const minimumGroupSize=5;
  if(participants<minimumGroupSize)return {privacy:{suppressed:true,minimumGroupSize,distinctParticipants:participants},generatedAt:new Date().toISOString(),totals:{assessments:0,participants:0},dimensions:[],timeline:[],contexts:[],geography:[],states:[],institutions:[]};
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
      const declaredName=String(row.institutionName||place?.name||'').trim();
      const declaredType=String(row.institutionType||place?.type||'OTHER');
      if(declaredName && declaredType!=='INDEPENDENT'){
        const orgKey=row.institutionId||[row.state,row.city,declaredType,declaredName.normalize('NFKC').toLocaleLowerCase('pt-BR')].join('|');
        const o=orgs.get(orgKey)||{name:declaredName,type:declaredType,city:row.city,state:row.state,count:0,users:new Set<string>(),scores:new Map()};
        o.count++;o.users.add(row.userId);
        for(const raw of row.dimensions as Array<Record<string,unknown>>){
          const id=String(raw.id||'unknown'),score=Number(raw.score||0);
          const os=o.scores.get(id)||{sum:0,count:0};os.sum+=score;os.count++;o.scores.set(id,os);
        }
        orgs.set(orgKey,o);
      }
    }
    for(const raw of row.dimensions as Array<Record<string,unknown>>){
      const id=String(raw.id||'unknown'),item=dims.get(id)||{name:String(raw.name||id),sum:0,count:0};
      item.sum+=Number(raw.score||0);item.count++;dims.set(id,item);
    }
  }
  const dimensionRows=[...dims.entries()].map(([id,v])=>({id,name:v.name,score:Math.round(v.sum/v.count),applications:v.count}));
  const stateMap=new Map<string,{count:number;users:Set<string>;scores:Map<string,{sum:number;count:number}>}>();
  for(const city of geo.values()){
    const state=stateMap.get(city.state)||{count:0,users:new Set<string>(),scores:new Map<string,{sum:number;count:number}>()};
    state.count+=city.count;for(const userId of city.users)state.users.add(userId);
    for(const [dimensionId,value] of city.scores.entries()){const score=state.scores.get(dimensionId)||{sum:0,count:0};score.sum+=value.sum;score.count+=value.count;state.scores.set(dimensionId,score);}
    stateMap.set(city.state,state);
  }
  const stateRows=[...stateMap.entries()].filter(([,v])=>v.users.size>=minimumGroupSize).map(([state,v])=>({id:state,state,count:v.count,participants:v.users.size,dimensions:[...v.scores.entries()].map(([dimensionId,s])=>({dimensionId,score:Math.round(s.sum/s.count)}))}));
  const geographyRows=[...geo.entries()].filter(([,v])=>v.users.size>=minimumGroupSize).map(([id,v])=>({id,state:v.state,city:v.city,count:v.count,participants:v.users.size,dimensions:[...v.scores.entries()].map(([dimensionId,s])=>({dimensionId,score:Math.round(s.sum/s.count)}))}));
  const institutionRows=[...orgs.entries()].filter(([,v])=>v.users.size>=minimumGroupSize).map(([id,v])=>({id,name:v.name,type:v.type,city:v.city,state:v.state,count:v.count,participants:v.users.size,dimensions:[...v.scores.entries()].map(([dimensionId,s])=>({dimensionId,score:Math.round(s.sum/s.count)}))}));
  const timelineRows=[...timeline.values()].filter(v=>v.users.size>=minimumGroupSize).sort((a,b)=>a.period.localeCompare(b.period)).map(v=>({period:v.period,assessments:v.count,participants:v.users.size,dimensions:[...v.scores.entries()].map(([dimensionId,s])=>({dimensionId,score:Math.round(s.sum/s.count)}))}));
  const contextRows=[...contexts.entries()].filter(([,v])=>v.users.size>=minimumGroupSize).map(([context,v])=>({context,assessments:v.count,participants:v.users.size}));
  return {privacy:{suppressed:false,minimumGroupSize,distinctParticipants:participants},generatedAt:new Date().toISOString(),period:{from:from.toISOString(),to:to.toISOString()},totals:{assessments:rows.length,participants},dimensions:dimensionRows,timeline:timelineRows,contexts:contextRows,geography:geographyRows,states:stateRows,institutions:institutionRows};
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
  for(const s of aggregate.states)for(const d of s.dimensions)rows.push(['estado',s.state,d.dimensionId,String(d.score),String(s.count),String(s.participants)]);
  for(const o of aggregate.institutions)for(const d of o.dimensions)rows.push(['instituicao',o.name,d.dimensionId,String(d.score),String(o.count),String(o.participants)]);
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


app.get('/api/admin/data-quality', authenticate, allow(UserRole.ADMIN,UserRole.ANALYST), asyncRoute(async (req,res) => {
  const from=typeof req.query.from==='string'?new Date(req.query.from):new Date(Date.now()-365*86400000);
  const to=typeof req.query.to==='string'?new Date(req.query.to):new Date();
  if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||from>to)return res.status(400).json({error:'Período inválido.'});
  const [cognitive,behavioral]=await Promise.all([
    prisma.assessmentResult.findMany({where:{completedAt:{gte:from,lte:to},researchConsentGranted:true},select:{userId:true,durationSeconds:true,totalQuestions:true,answerDetails:true,completedAt:true,instrumentVersion:true,mode:true,accuracy:true}}),
    prisma.instrumentAssessment.findMany({where:{completedAt:{gte:from,lte:to},researchConsentGranted:true},select:{userId:true,answers:true,dimensions:true,completedAt:true,context:true,contextVersion:true,instrumentVersion:true,state:true,city:true,institutionType:true}})
  ]);
  res.json(analyzeDataQuality(cognitive,behavioral,5));
}));


/* Scientific governance: immutable instrument versions, protocols and study cohorts. */
const instrumentNames = ['HSI-DOTH-P','HSI Visual Cognitivo'] as const;
const scoringCriteriaFor = (instrument:string) => instrument==='HSI-DOTH-P'
  ? {scale:{label:'Likert 1–5',min:1,max:5},scoreRange:{min:0,max:100},reverseItems:[4,9,14,19,24],dimensions:dothpDimensions,formula:'score = round((mean(scored responses) - scale.min) / (scale.max - scale.min) × scoreRange.max)',bands:{low:{maxExclusive:34},medium:{min:34,maxExclusive:67},high:{min:67}},contextualized:true}
  : {method:'structured visual/cognitive tasks',axes:['logic','attention','patterns','anticipation','risk','decision'],axisWeights:{logic:1,attention:1,patterns:1,anticipation:1,risk:1,decision:1},formula:'weightedAccuracy = weighted mean of axis accuracies',timeMetric:'seconds per item',diagnosticUse:false};
const questionsFor = (instrument:string) => instrument==='HSI-DOTH-P'
  ? dothpItems.map(([dimension,prompt],index)=>({id:'dothp-'+(index+1),dimension,prompt,reverseScored:[3,8,13,18,23].includes(index)}))
  : questions.map((q:any)=>({id:q.id,axis:q.axis,prompt:q.prompt,visual:q.visual,options:q.options,answer:q.answer}));
async function ensureActiveInstrumentVersion(instrument:string) {
  let version=await prisma.instrumentVersion.findFirst({where:{instrument,status:'ACTIVE'},orderBy:{publishedAt:'desc'}});
  if(!version) version=await prisma.instrumentVersion.create({data:{
    instrument,version:'1.0',status:'ACTIVE',changeSummary:'Versão de referência inicial registrada na implantação da governança científica. Aplicações anteriores permanecem classificadas como legado não verificado.',
    questions:questionsFor(instrument) as Prisma.InputJsonValue,
    scoringCriteria:scoringCriteriaFor(instrument) as Prisma.InputJsonValue,
    publishedAt:new Date()
  }});
  return version;
}
function validateVersionDefinition(instrument:string,questionsValue:any,criteria:any):string|null {
 if(!Array.isArray(questionsValue))return 'O banco de questões deve ser uma lista.';
 if(instrument==='HSI-DOTH-P'){
  if(questionsValue.length!==25)return 'O HSI-DOTH-P deve conter exatamente 25 afirmações.';
  const ids=['decision','organization','time','humanization','psychocomportamental'];
  if(questionsValue.some(q=>!ids.includes(String(q.dimension||q.dimensionId))||typeof (q.prompt||q.statement)!=='string'||String(q.prompt||q.statement).trim().length<8))return 'Cada afirmação deve conter uma dimensão válida e um enunciado.';
  const reverse=criteria?.reverseItems;
  if(!Array.isArray(reverse)||reverse.some((x:any)=>!Number.isInteger(x)||x<1||x>25)||new Set(reverse).size!==reverse.length)return 'Informe os itens reversos como posições únicas de 1 a 25.';
  const scaleMin=Number(criteria?.scale?.min??1),scaleMax=Number(criteria?.scale?.max??5);
  const scoreMin=Number(criteria?.scoreRange?.min??0),scoreMax=Number(criteria?.scoreRange?.max??100);
  if(!Number.isFinite(scaleMin)||!Number.isFinite(scaleMax)||scaleMax<=scaleMin||!Number.isFinite(scoreMin)||!Number.isFinite(scoreMax)||scoreMax<=scoreMin)return 'Escala e faixa de pontuação inválidas.';
  if(!Array.isArray(criteria?.dimensions)||criteria.dimensions.length!==5||criteria.dimensions.some((d:any)=>!ids.includes(d.id)))return 'Os critérios devem definir as cinco dimensões do instrumento.';
 }else{
  const axes=['logic','attention','patterns','anticipation','risk','decision'];
  if(questionsValue.length!==30)return 'O HSI Visual Cognitivo deve conter 30 questões, cinco por eixo.';
  const seen=new Set<string>();const counts=new Map<string,number>();
  for(const q of questionsValue){
   if(typeof q.id!=='string'||seen.has(q.id)||!axes.includes(String(q.axis))||typeof q.prompt!=='string'||!Array.isArray(q.options)||q.options.length<2||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)return 'Questão cognitiva inválida: confira ID único, eixo, enunciado, alternativas e gabarito.';
   seen.add(q.id);counts.set(q.axis,(counts.get(q.axis)||0)+1);
  }
  if(axes.some(axis=>counts.get(axis)!==5))return 'Cada eixo cognitivo deve conter exatamente cinco questões.';
  const weights=criteria?.axisWeights;
  if(!weights||axes.some(axis=>!Number.isFinite(Number(weights[axis]))||Number(weights[axis])<0)||axes.every(axis=>Number(weights[axis])===0))return 'Defina pesos numéricos não negativos para os seis eixos, com ao menos um peso positivo.';
 }
 return null;
}
const versionInputSchema=z.object({
  instrument:z.enum(instrumentNames),version:z.string().trim().min(1).max(30),
  changeSummary:z.string().trim().min(10).max(3000),
  questions:z.array(z.record(z.string(),z.unknown())).max(300),
  scoringCriteria:z.record(z.string(),z.unknown())
}).strict();
app.get('/api/instrument-definition',authenticate,asyncRoute(async(_req,res)=>{
 const version=await ensureActiveInstrumentVersion('HSI-DOTH-P');
 res.json({instrument:version.instrument,version:version.version,questions:version.questions,scoringCriteria:version.scoringCriteria});
}));
app.get('/api/science/overview',authenticate,allow(UserRole.ADMIN,UserRole.ANALYST),asyncRoute(async(_req,res)=>{
  await Promise.all(instrumentNames.map(name=>ensureActiveInstrumentVersion(name)));
  const [versions,protocols,studies]=await Promise.all([
    prisma.instrumentVersion.findMany({orderBy:[{instrument:'asc'},{createdAt:'desc'}]}),
    prisma.studyProtocol.findMany({orderBy:{updatedAt:'desc'}}),
    prisma.scientificStudy.findMany({include:{protocol:{select:{id:true,title:true,version:true}},groups:{orderBy:{createdAt:'asc'}},_count:{select:{cognitiveResults:true,behavioralResults:true}}},orderBy:{createdAt:'desc'}})
  ]);
  res.json({versions,protocols,studies});
}));
app.post('/api/science/versions',authenticate,allow(UserRole.ADMIN),asyncRoute(async(req,res)=>{
  const parsed=versionInputSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Dados da versão inválidos.',details:parsed.error.flatten()});
  const definitionError=validateVersionDefinition(parsed.data.instrument,parsed.data.questions,parsed.data.scoringCriteria);
  if(definitionError)return res.status(400).json({error:definitionError});
  const v=await prisma.instrumentVersion.create({data:{...parsed.data,status:'DRAFT',createdBy:req.authUser!.id,questions:parsed.data.questions as Prisma.InputJsonValue,scoringCriteria:parsed.data.scoringCriteria as Prisma.InputJsonValue}});
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'INSTRUMENT_VERSION_DRAFT_CREATED',targetType:'INSTRUMENT_VERSION',targetId:v.id,metadata:{instrument:v.instrument,version:v.version}}});
  res.status(201).json({version:v});
}));
app.patch('/api/science/versions/:id',authenticate,allow(UserRole.ADMIN),asyncRoute(async(req,res)=>{
  const parsed=versionInputSchema.partial().omit({instrument:true,version:true}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Alterações inválidas.',details:parsed.error.flatten()});
  const current=await prisma.instrumentVersion.findUnique({where:{id:String(req.params.id)}});
  if(!current)return res.status(404).json({error:'Versão não encontrada.'});
  if(current.status!=='DRAFT'||current.publishedAt)return res.status(409).json({error:'Versões publicadas são imutáveis. Crie uma nova versão para alterar questões ou pontuação.'});
  const definitionError=validateVersionDefinition(current.instrument,parsed.data.questions??current.questions,parsed.data.scoringCriteria??current.scoringCriteria);
  if(definitionError)return res.status(400).json({error:definitionError});
  const updated=await prisma.instrumentVersion.update({where:{id:current.id},data:{...parsed.data,questions:parsed.data.questions as Prisma.InputJsonValue|undefined,scoringCriteria:parsed.data.scoringCriteria as Prisma.InputJsonValue|undefined}});
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'INSTRUMENT_VERSION_DRAFT_UPDATED',targetType:'INSTRUMENT_VERSION',targetId:updated.id,metadata:{instrument:updated.instrument,version:updated.version}}});
  res.json({version:updated});
}));
app.post('/api/science/versions/:id/publish',authenticate,allow(UserRole.ADMIN),asyncRoute(async(req,res)=>{
  const version=await prisma.instrumentVersion.findUnique({where:{id:String(req.params.id)}});
  if(!version)return res.status(404).json({error:'Versão não encontrada.'});
  if(version.status!=='DRAFT'||version.publishedAt)return res.status(409).json({error:'Somente versões em rascunho podem ser publicadas.'});
  const published=await prisma.$transaction(async tx=>{
    await tx.instrumentVersion.updateMany({where:{instrument:version.instrument,status:'ACTIVE'},data:{status:'ARCHIVED'}});
    return tx.instrumentVersion.update({where:{id:version.id},data:{status:'ACTIVE',publishedAt:new Date()}});
  });
  await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'INSTRUMENT_VERSION_PUBLISHED',targetType:'INSTRUMENT_VERSION',targetId:published.id,metadata:{instrument:published.instrument,version:published.version,changeSummary:published.changeSummary}}});
  res.json({version:published,message:'Versão publicada. Novas aplicações usarão esta versão; aplicações históricas não serão recalculadas.'});
}));
const protocolSchema=z.object({
 title:z.string().trim().min(3).max(180),version:z.string().trim().min(1).max(30).default('1.0'),
 researchQuestion:z.string().trim().min(10).max(3000),hypothesis:z.string().trim().min(10).max(3000),
 targetPopulation:z.string().trim().min(5).max(2000),inclusionCriteria:z.string().trim().min(5).max(3000),
 exclusionCriteria:z.string().trim().min(5).max(3000),samplingStrategy:z.string().trim().min(5).max(3000),
 sampleSizeRationale:z.string().trim().min(5).max(3000),analysisPlan:z.string().trim().min(5).max(5000),
 ethicalConsiderations:z.string().max(5000).optional()
}).strict();
app.post('/api/science/protocols',authenticate,allow(UserRole.ADMIN,UserRole.ANALYST),asyncRoute(async(req,res)=>{
 const parsed=protocolSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Protocolo incompleto.',details:parsed.error.flatten()});
 const protocol=await prisma.studyProtocol.create({data:{...parsed.data,createdBy:req.authUser!.id}});
 await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'RESEARCH_PROTOCOL_CREATED',targetType:'STUDY_PROTOCOL',targetId:protocol.id}});
 res.status(201).json({protocol});
}));
const studySchema=z.object({
 code:z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{1,79}$/),title:z.string().trim().min(3).max(180),
 description:z.string().max(3000).optional(),hypothesis:z.string().trim().min(10).max(3000),
 targetPopulation:z.string().trim().min(5).max(2000),inclusionCriteria:z.string().trim().min(5).max(3000),
 exclusionCriteria:z.string().max(3000).optional(),samplingPlan:z.string().trim().min(5).max(3000),
 analysisPlan:z.string().trim().min(5).max(5000),protocolId:z.string().optional()
}).strict();
app.post('/api/science/studies',authenticate,allow(UserRole.ADMIN,UserRole.ANALYST),asyncRoute(async(req,res)=>{
 const parsed=studySchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Plano de estudo incompleto.',details:parsed.error.flatten()});
 const study=await prisma.scientificStudy.create({data:{...parsed.data,description:parsed.data.description||null,exclusionCriteria:parsed.data.exclusionCriteria||null}});
 await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'SCIENTIFIC_STUDY_CREATED',targetType:'SCIENTIFIC_STUDY',targetId:study.id,metadata:{code:study.code}}});
 res.status(201).json({study});
}));
app.patch('/api/science/studies/:id/status',authenticate,allow(UserRole.ADMIN),asyncRoute(async(req,res)=>{
 const parsed=z.object({status:z.enum(['DRAFT','ACTIVE','PAUSED','COMPLETED','ARCHIVED'])}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Status inválido.'});
 const study=await prisma.scientificStudy.update({where:{id:String(req.params.id)},data:{status:parsed.data.status}});
 await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'SCIENTIFIC_STUDY_STATUS_CHANGED',targetType:'SCIENTIFIC_STUDY',targetId:study.id,metadata:{status:study.status}}});
 res.json({study});
}));
app.post('/api/science/studies/:id/groups',authenticate,allow(UserRole.ADMIN,UserRole.ANALYST),asyncRoute(async(req,res)=>{
 const parsed=z.object({code:z.string().trim().min(1).max(40).regex(/^[A-Z0-9_-]+$/),name:z.string().trim().min(2).max(120),arm:z.string().trim().min(2).max(80),description:z.string().max(1000).optional()}).strict().safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Dados do grupo inválidos.'});
 const study=await prisma.scientificStudy.findUnique({where:{id:String(req.params.id)}});if(!study)return res.status(404).json({error:'Estudo não encontrado.'});
 const group=await prisma.studyGroup.create({data:{studyId:study.id,...parsed.data}});
 await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'SCIENTIFIC_STUDY_GROUP_CREATED',targetType:'STUDY_GROUP',targetId:group.id,metadata:{studyCode:study.code,groupCode:group.code,arm:group.arm}}});
 res.status(201).json({group});
}));
app.get('/api/science/studies/compare',authenticate,allow(UserRole.ADMIN,UserRole.ANALYST),asyncRoute(async(req,res)=>{
 const codes=typeof req.query.codes==='string'?req.query.codes.split(',').map(x=>x.trim()).filter(Boolean):[];
 if(codes.length<2||codes.length>10)return res.status(400).json({error:'Informe de 2 a 10 códigos de estudo para comparação.'});
 const studies=await prisma.scientificStudy.findMany({where:{code:{in:codes}},include:{groups:true}});
 if(studies.length!==new Set(codes).size)return res.status(404).json({error:'Um ou mais estudos não foram encontrados.'});
 const results=await Promise.all(studies.map(async study=>{
   const [cognitive,behavioral]=await Promise.all([
     prisma.assessmentResult.findMany({where:{studyId:study.id,researchConsentGranted:true},select:{userId:true,accuracy:true,correct:true,totalQuestions:true,axes:true,instrumentVersion:true,versionVerification:true}}),
     prisma.instrumentAssessment.findMany({where:{studyId:study.id,researchConsentGranted:true},select:{userId:true,dimensions:true,instrumentVersion:true,versionVerification:true}})
   ]);
   const minimum=5;
   const cognitiveUsers=new Set(cognitive.map(x=>x.userId)).size,behavioralUsers=new Set(behavioral.map(x=>x.userId)).size;
   return {code:study.code,title:study.title,status:study.status,
    cognitive:cognitiveUsers<minimum?{suppressed:true,minimumParticipants:minimum,participants:cognitiveUsers}:{suppressed:false,participants:cognitiveUsers,applications:cognitive.length,accuracy:cognitive.length?Math.round(cognitive.reduce((s,x)=>s+x.accuracy,0)/cognitive.length):null,versions:[...new Set(cognitive.map(x=>x.instrumentVersion))],legacyUnverified:cognitive.filter(x=>x.versionVerification!=='VERIFIED').length,axes:(['logic','attention','patterns','anticipation','risk','decision']).map(axisId=>{const vals=cognitive.flatMap(x=>(x.axes as Array<any>).filter(a=>a.axisId===axisId).map(a=>Number(a.accuracy)));return{axisId,meanAccuracy:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null,n:vals.length};})},
    behavioral:behavioralUsers<minimum?{suppressed:true,minimumParticipants:minimum,participants:behavioralUsers}:{suppressed:false,participants:behavioralUsers,applications:behavioral.length,versions:[...new Set(behavioral.map(x=>x.instrumentVersion))],legacyUnverified:behavioral.filter(x=>x.versionVerification!=='VERIFIED').length,dimensions:(['decision','organization','time','humanization','psychocomportamental']).map(id=>{const vals=behavioral.flatMap(x=>(x.dimensions as Array<any>).filter(d=>d.id===id).map(d=>Number(d.score)));return{id,mean:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null,n:vals.length};})}
   };
 }));
 res.json({minimumParticipants:5,methodology:'Comparação descritiva por estudo. Instrumentos e escalas permanecem separados. Grupos com menos de cinco participantes distintos são suprimidos. Aplicações legadas não verificadas são identificadas e não se presume equivalência entre versões.',studies:results});
}));

app.get('/api/science/audit',authenticate,allow(UserRole.ADMIN,UserRole.ANALYST),asyncRoute(async(_req,res)=>{
 const rows=await prisma.auditLog.findMany({where:{targetType:{in:['INSTRUMENT_VERSION','STUDY_PROTOCOL','SCIENTIFIC_STUDY','STUDY_GROUP']}},orderBy:{createdAt:'desc'},take:150,select:{id:true,action:true,targetType:true,targetId:true,metadata:true,createdAt:true}});
 res.json({events:rows});
}));

/* LGPD governance: data subject requests, privacy controls and auditable access. */
const privacyRequestSchema=z.object({
 requestType:z.enum(['ACCESS','CORRECTION','ANONYMIZATION','BLOCKING','DELETION','PORTABILITY','CONSENT_WITHDRAWAL','INFORMATION']),
 description:z.string().trim().max(2000).optional()
}).strict();
app.post('/api/privacy/requests',authenticate,asyncRoute(async(req,res)=>{
 const parsed=privacyRequestSchema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Tipo de solicitação inválido.'});
 const request=await prisma.privacyRequest.create({data:{userId:req.authUser!.id,...parsed.data}});
 await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'DATA_SUBJECT_REQUEST_OPENED',targetType:'PRIVACY_REQUEST',targetId:request.id,metadata:{requestType:request.requestType}}});
 res.status(201).json({request:{id:request.id,requestType:request.requestType,status:request.status,createdAt:request.createdAt}});
}));
app.get('/api/privacy/requests',authenticate,asyncRoute(async(req,res)=>{
 const rows=await prisma.privacyRequest.findMany({where:{userId:req.authUser!.id},orderBy:{createdAt:'desc'},select:{id:true,requestType:true,description:true,status:true,resolutionNote:true,createdAt:true,updatedAt:true}});
 res.json({requests:rows});
}));
app.get('/api/privacy/my-data',authenticate,asyncRoute(async(req,res)=>{
 const userId=req.authUser!.id;
 const [user,cognitive,behavioral,consents,requests]=await Promise.all([
  prisma.user.findUnique({where:{id:userId},select:{id:true,name:true,email:true,participantCode:true,publicAccess:true,birthDate:true,sex:true,city:true,state:true,licenseCategory:true,institutionType:true,institutionName:true,groupSector:true,privacyNoticeVersion:true,privacyAcknowledgedAt:true,researchConsentVersion:true,researchConsentedAt:true,researchConsentGranted:true,createdAt:true,updatedAt:true}}),
  prisma.assessmentResult.findMany({where:{userId},orderBy:{completedAt:'desc'}}),
  prisma.instrumentAssessment.findMany({where:{userId},orderBy:{completedAt:'desc'}}),
  prisma.consentEvent.findMany({where:{userId},orderBy:{createdAt:'desc'}}),
  prisma.privacyRequest.findMany({where:{userId},orderBy:{createdAt:'desc'}})
 ]);
 await prisma.auditLog.create({data:{actorId:userId,action:'PERSONAL_DATA_EXPORT',targetType:'USER',targetId:userId,metadata:{cognitiveResults:cognitive.length,behavioralResults:behavioral.length}}});
 res.json({generatedAt:new Date().toISOString(),user,cognitiveResults:cognitive,behavioralResults:behavioral,consentHistory:consents,privacyRequests:requests});
}));
app.get('/api/admin/privacy/requests',authenticate,allow(UserRole.ADMIN),asyncRoute(async(_req,res)=>{
 const requests=await prisma.privacyRequest.findMany({include:{user:{select:{id:true,name:true,email:true,participantCode:true,publicAccess:true}}},orderBy:{createdAt:'asc'},take:300});
 res.json({requests:requests.map(r=>({...r,user:{...r.user,name:r.user.publicAccess?'Participante público':r.user.name,email:r.user.publicAccess?null:r.user.email}}))});
}));
app.patch('/api/admin/privacy/requests/:id',authenticate,allow(UserRole.ADMIN),asyncRoute(async(req,res)=>{
 const parsed=z.object({status:z.enum(['IN_REVIEW','WAITING_FOR_USER','COMPLETED','REJECTED']),resolutionNote:z.string().trim().max(2000).optional()}).strict().safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Atualização inválida.'});
 const request=await prisma.privacyRequest.update({where:{id:String(req.params.id)},data:parsed.data});
 await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'DATA_SUBJECT_REQUEST_UPDATED',targetType:'PRIVACY_REQUEST',targetId:request.id,metadata:{status:request.status,requestType:request.requestType}}});
 res.json({request});
}));
app.get('/api/admin/audit',authenticate,allow(UserRole.ADMIN),asyncRoute(async(req,res)=>{
 const rows=await prisma.auditLog.findMany({orderBy:{createdAt:'desc'},take:Math.min(500,Math.max(1,Number(req.query.limit)||200)),select:{id:true,actorId:true,action:true,targetType:true,targetId:true,metadata:true,createdAt:true}});
 res.json({events:rows});
}));
app.get('/api/admin/retention',authenticate,allow(UserRole.ADMIN),asyncRoute(async(_req,res)=>{
 const policies=await prisma.retentionPolicy.findMany({orderBy:{recordType:'asc'}});
 res.json({policies});
}));
app.put('/api/admin/retention/:recordType',authenticate,allow(UserRole.ADMIN),asyncRoute(async(req,res)=>{
 const parsed=z.object({retentionMonths:z.number().int().min(1).max(240),rationale:z.string().trim().min(10).max(1000),active:z.boolean().default(true)}).strict().safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Política de retenção inválida.'});
 const recordType=String(req.params.recordType);
 if(!['ACCOUNT_DATA','ASSESSMENT_RESULTS','CONSENT_EVIDENCE','AUDIT_LOGS','PRIVACY_REQUESTS','BACKUP_COPIES'].includes(recordType))return res.status(400).json({error:'Categoria de dados não reconhecida.'});
 const policy=await prisma.retentionPolicy.upsert({where:{recordType},create:{recordType,...parsed.data,updatedBy:req.authUser!.id},update:{...parsed.data,updatedBy:req.authUser!.id}});
 await prisma.auditLog.create({data:{actorId:req.authUser!.id,action:'RETENTION_POLICY_UPDATED',targetType:'RETENTION_POLICY',targetId:policy.id,metadata:{recordType,retentionMonths:policy.retentionMonths,active:policy.active}}});
 res.json({policy,message:'Política registrada. A execução de descarte depende de validação jurídica e rotina operacional aprovada; nenhum dado foi excluído por esta operação.'});
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
