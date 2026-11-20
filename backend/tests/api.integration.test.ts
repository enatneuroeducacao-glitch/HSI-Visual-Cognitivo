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

test('analista não recebe dados cadastrais pessoais pela rota de usuários', async () => {
  const response = await request(app).get('/api/users').set('Authorization', 'Bearer ' + tokenFor(ids.analyst));
  assert.equal(response.status, 403);
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

test('API recalcula pontuação, valida modalidade e ignora código de participante enviado pelo cliente', async () => {
  const { questions } = await import('../src/question-bank.js');
  const token = tokenFor(ids.participant);
  const answers = questions.map((q: any) => ({ questionId: q.id, axisId: q.axis, selected: q.answer, seconds: 12 }));
  const payload = {
    id: suffix + '-verified-result',
    mode: 'Avaliação completa',
    completedAt: new Date().toISOString(),
    totalQuestions: answers.length,
    durationSeconds: answers.length * 12,
    answerDetails: answers,
  };
  const valid = await request(app).post('/api/results').set('Authorization', 'Bearer ' + token).send(payload);
  assert.equal(valid.status, 201);
  assert.equal(valid.body.result.participantCode, suffix + '-code');
  assert.equal(valid.body.result.accuracy, 100);

  const tampered = await request(app).post('/api/results').set('Authorization', 'Bearer ' + token).send({
    ...payload,
    id: suffix + '-tampered-result',
    answerDetails: [{ ...answers[0], selected: 99 }, ...answers.slice(1)],
  });
  assert.equal(tampered.status, 400);

  const incomplete = await request(app).post('/api/results').set('Authorization', 'Bearer ' + token).send({
    ...payload,
    id: suffix + '-incomplete-result',
    totalQuestions: 5,
    durationSeconds: 60,
    answerDetails: answers.slice(0, 5),
  });
  assert.equal(incomplete.status, 400);
});

test('token assinado com emissor diferente é recusado', async () => {
  const wrongIssuer = jwt.sign({}, secret, { subject: ids.participant, expiresIn: '10m', issuer: 'outro-servico' });
  const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + wrongIssuer);
  assert.equal(response.status, 401);
});

test('API não entrega gabarito nem explicações no endpoint de questões', async () => {
  const response = await request(app).get('/api/questions?mode=full').set('Authorization', 'Bearer ' + tokenFor(ids.participant));
  assert.equal(response.status, 200);
  assert.equal(response.body.questions.length, 30);
  for (const question of response.body.questions) {
    assert.equal('answer' in question, false);
    assert.equal('explanation' in question, false);
  }
});

test('resultado não pode ser reenviado com o mesmo identificador', async () => {
  const { questions } = await import('../src/question-bank.js');
  const answers = questions.map((q: any) => ({ questionId: q.id, axisId: q.axis, selected: q.answer, seconds: 10 }));
  const payload = { id: suffix + '-duplicate', mode: 'Avaliação completa', completedAt: new Date().toISOString(), totalQuestions: 30, durationSeconds: 300, answerDetails: answers };
  assert.equal((await request(app).post('/api/results').set('Authorization', 'Bearer ' + tokenFor(ids.participant)).send(payload)).status, 201);
  assert.equal((await request(app).post('/api/results').set('Authorization', 'Bearer ' + tokenFor(ids.participant)).send(payload)).status, 409);
});
