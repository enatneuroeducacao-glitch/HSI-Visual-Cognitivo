import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { app } from '../src/server.js';

const prisma = new PrismaClient();
const secret = process.env.JWT_SECRET!;
const suffix = 'instrument-test-' + process.pid;
let userId = '';
const email = suffix + '@example.test';
const token = () => jwt.sign({}, secret, { subject: userId, expiresIn: '10m', issuer: 'hsi-visual-cognitivo' });

before(async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL precisa apontar para PostgreSQL de testes');
  const user = await prisma.user.create({ data: { name: 'Instrument participant', email, passwordHash: await bcrypt.hash('Test-password-2026!', 4), role: UserRole.PARTICIPANT, status: UserStatus.ACTIVE } });
  userId = user.id;
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test('salva respostas completas do HSI-DOTH-P e calcula dimensões no servidor', async () => {
  const answers = Array.from({ length: 25 }, (_, i) => i === 3 || i === 8 || i === 13 || i === 18 || i === 23 ? 1 : 5);
  const response = await request(app).post('/api/instrument-results')
    .set('Authorization', 'Bearer ' + token())
    .send({ id: suffix + '-result', instrument: 'HSI-DOTH-P', context: 'cotidiano', answers });
  assert.equal(response.status, 201);
  assert.equal(response.body.result.instrument, 'HSI-DOTH-P');
  assert.equal(response.body.result.answers.length, 25);
  assert.equal(response.body.result.dimensions.length, 5);
  assert.equal(response.body.result.dimensions.every((d: any) => d.score === 100), true);
});

test('histórico comportamental retorna apenas avaliações da própria conta', async () => {
  const response = await request(app).get('/api/instrument-results').set('Authorization', 'Bearer ' + token());
  assert.equal(response.status, 200);
  assert.ok(response.body.results.some((r: any) => r.id === suffix + '-result'));
});

test('recusa questionário incompleto, contexto inválido e acesso sem autenticação', async () => {
  const auth = 'Bearer ' + token();
  assert.equal((await request(app).post('/api/instrument-results').set('Authorization', auth).send({ id: suffix + '-short', instrument: 'HSI-DOTH-P', context: 'cotidiano', answers: [1,2] })).status, 400);
  assert.equal((await request(app).post('/api/instrument-results').set('Authorization', auth).send({ id: suffix + '-context', instrument: 'HSI-DOTH-P', context: 'unknown', answers: Array(25).fill(3) })).status, 400);
  assert.equal((await request(app).get('/api/instrument-results')).status, 401);
});

test('não permite reutilizar o identificador de uma avaliação', async () => {
  const response = await request(app).post('/api/instrument-results')
    .set('Authorization', 'Bearer ' + token())
    .send({ id: suffix + '-result', instrument: 'HSI-DOTH-P', context: 'cotidiano', answers: Array(25).fill(3) });
  assert.equal(response.status, 409);
});
