import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { app } from '../src/server.js';

const prisma = new PrismaClient();
const secret = process.env.JWT_SECRET!;
const suffix = 'security-test-' + process.pid;
const ids: Record<string, string> = {};
const emails = {
  admin: suffix + '-admin@example.test',
  analyst: suffix + '-analyst@example.test',
  participant: suffix + '-participant@example.test',
  other: suffix + '-other@example.test',
  disabled: suffix + '-disabled@example.test',
};
const tokenFor = (id: string) => jwt.sign({}, secret, { subject: id, expiresIn: '10m', issuer: 'hsi-visual-cognitivo' });

before(async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL precisa apontar para o PostgreSQL efêmero de testes');
  const passwordHash = await bcrypt.hash('Test-password-2026!', 4);
  for (const [key, email] of Object.entries(emails)) {
    const role = key === 'admin' ? UserRole.ADMIN : key === 'analyst' ? UserRole.ANALYST : UserRole.PARTICIPANT;
    const status = key === 'disabled' ? UserStatus.DISABLED : UserStatus.ACTIVE;
    const user = await prisma.user.create({ data: { name: key, email, passwordHash, role, status, participantCode: key === 'participant' ? suffix + '-code' : null } });
    ids[key] = user.id;
  }
  await prisma.assessmentResult.createMany({ data: [
    { id: suffix + '-result-a', userId: ids.participant, participantCode: suffix + '-code', mode: 'Eixo individual', completedAt: new Date(), totalQuestions: 5, correct: 4, accuracy: 80, durationSeconds: 90, axes: [], answerDetails: [] },
    { id: suffix + '-result-b', userId: ids.other, participantCode: 'OTHER', mode: 'Eixo individual', completedAt: new Date(), totalQuestions: 5, correct: 2, accuracy: 40, durationSeconds: 100, axes: [], answerDetails: [] },
  ] });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  await prisma.$disconnect();
});

test('health check confirma conexão real com PostgreSQL', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.database, 'connected');
});

test('login autentica credenciais corretas e rejeita senha incorreta', async () => {
  const ok = await request(app).post('/api/auth/login').send({ email: emails.participant, password: 'Test-password-2026!' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const denied = await request(app).post('/api/auth/login').send({ email: emails.participant, password: 'wrong-password' });
  assert.equal(denied.status, 401);
});

test('usuário desativado não consegue autenticar nem reutilizar sessão', async () => {
  const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + tokenFor(ids.disabled));
  assert.equal(response.status, 401);
});

test('participante não acessa administração, usuários ou analytics', async () => {
  const token = tokenFor(ids.participant);
  assert.equal((await request(app).get('/api/users').set('Authorization', 'Bearer ' + token)).status, 403);
  assert.equal((await request(app).get('/api/analytics').set('Authorization', 'Bearer ' + token)).status, 403);
  assert.equal((await request(app).post('/api/groups').set('Authorization', 'Bearer ' + token).send({ name: 'Grupo indevido' })).status, 403);
});

test('analista consulta somente participantes, sem receber contas administrativas', async () => {
  const response = await request(app).get('/api/users').set('Authorization', 'Bearer ' + tokenFor(ids.analyst));
  assert.equal(response.status, 200);
  const returned = response.body.users.map((u: { email: string }) => u.email);
  assert.ok(returned.includes(emails.participant));
  assert.ok(!returned.includes(emails.admin));
  assert.ok(!returned.includes(emails.analyst));
});

test('participante consulta exclusivamente os próprios resultados', async () => {
  const response = await request(app).get('/api/results').set('Authorization', 'Bearer ' + tokenFor(ids.participant));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.results.map((r: { id: string }) => r.id), [suffix + '-result-a']);
});

test('recuperação de senha falha explicitamente quando SMTP não está configurado', async () => {
  const response = await request(app).post('/api/auth/forgot-password').send({ email: emails.participant });
  assert.equal(response.status, 503);
});
