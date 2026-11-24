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
const studyCode = suffix.toUpperCase().replace(/[^A-Z0-9_-]/g,'-');
let studyId = '';
let studyGroupId = '';
const token = () => jwt.sign({}, secret, { subject: userId, expiresIn: '10m', issuer: 'hsi-visual-cognitivo' });

before(async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL precisa apontar para PostgreSQL de testes');
  const user = await prisma.user.create({ data: { name: 'Instrument participant', email, passwordHash: await bcrypt.hash('Test-password-2026!', 4), role: UserRole.PARTICIPANT, status: UserStatus.ACTIVE } });
  userId = user.id;
  const study = await prisma.scientificStudy.create({data:{code:studyCode,title:'Study governance integration test',hypothesis:'A hipótese de teste verifica a associação das aplicações ao estudo.',targetPopulation:'Participantes adultos de teste',inclusionCriteria:'Conta ativa e consentimento aplicável',exclusionCriteria:'Nenhum para este teste',samplingPlan:'Amostra de conveniência para teste automatizado',analysisPlan:'Verificação de integridade referencial e versionamento',status:'ACTIVE'}});
  studyId = study.id;
  const group = await prisma.studyGroup.create({data:{studyId:study.id,code:'COORTE-A',name:'Coorte de teste',arm:'Comparação'}});
  studyGroupId = group.id;
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.scientificStudy.deleteMany({where:{id:studyId}});
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
  assert.equal(response.body.result.applicationNumber, 1);
  assert.equal(response.body.result.applicationType, 'BASELINE');
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


test('série longitudinal compara contextos e mantém instrumento cognitivo separado', async () => {
  const auth = 'Bearer ' + token();
  const submitted = await request(app).post('/api/instrument-results')
    .set('Authorization', auth)
    .send({ id: suffix + '-work', instrument: 'HSI-DOTH-P', context: 'trabalho', answers: Array(25).fill(4) });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.result.applicationNumber, 2);
  assert.equal(submitted.body.result.applicationType, 'REEVALUATION');
  const response = await request(app).get('/api/instrument-results/longitudinal').set('Authorization', auth);
  assert.equal(response.status, 200);
  assert.equal(response.body.methodology.scalesCombined, false);
  assert.equal(response.body.totals.behavioralApplications >= 2, true);
  assert.equal(response.body.contexts.some((item: any) => item.context === 'trabalho'), true);
  assert.equal(Array.isArray(response.body.behavioralTimeline), true);
  assert.equal(Array.isArray(response.body.cognitiveTimeline), true);
  assert.equal(response.body.behavioralTimeline.every((item: any) => item.comparisonWithPreviousSameContext.length === 5), true);
  assert.equal(response.body.behavioralTimeline[0].applicationNumber, 1);
  assert.equal(response.body.behavioralTimeline[1].applicationNumber, 2);
});

test('série longitudinal exige autenticação e restringe os dados à própria conta', async () => {
  assert.equal((await request(app).get('/api/instrument-results/longitudinal')).status, 401);
  const response = await request(app).get('/api/instrument-results/longitudinal').set('Authorization', 'Bearer ' + token());
  assert.equal(response.status, 200);
  assert.equal(response.body.behavioralTimeline.every((item: any) => item.id.startsWith(suffix)), true);
});

test('registra dados sociodemográficos e vínculo institucional declarado sem exigir cadastro prévio', async () => {
  const participantData = { birthDate:'1990-04-12', sex:'F', licenseCategory:'B', city:'Joinville', state:'SC', country:'BR', institutionType:'SCHOOL', institutionName:'Escola de Pesquisa ENAT', groupSector:'Ensino médio' };
  const response = await request(app).post('/api/instrument-results')
    .set('Authorization', 'Bearer ' + token())
    .send({ id:suffix+'-profile', instrument:'HSI-DOTH-P', context:'educacao', answers:Array(25).fill(3), studyCode, studyGroupCode:'COORTE-A', instrumentVersion:'1.2', participantData });
  assert.equal(response.status, 201);
  assert.equal(response.body.result.city, 'Joinville');
  assert.equal(response.body.result.state, 'SC');
  assert.equal(response.body.result.sex, 'F');
  assert.equal(response.body.result.licenseCategory, 'B');
  assert.equal(response.body.result.institutionType, 'SCHOOL');
  assert.equal(response.body.result.institutionName, 'Escola de Pesquisa ENAT');
  assert.equal(response.body.result.institutionId, null);
  assert.equal(response.body.result.applicationType, 'EXPERIMENTAL');
  assert.equal(response.body.result.studyCode, studyCode);
  assert.equal(response.body.result.studyId, studyId);
  assert.equal(response.body.result.studyGroupId, studyGroupId);
  assert.equal(response.body.result.instrumentVersion, '1.0');
  assert.equal(response.body.result.versionVerification, 'VERIFIED');
  assert.ok(response.body.result.scoringSnapshot);
});

test('rejeita sexo fora de M/F e UF inválida nos dados do respondente', async () => {
  const auth = 'Bearer ' + token();
  const base = { birthDate:'1990-04-12', sex:'X', city:'Joinville', state:'SC', institutionType:'INDEPENDENT' };
  const badSex = await request(app).post('/api/instrument-results').set('Authorization',auth)
    .send({id:suffix+'-bad-sex',instrument:'HSI-DOTH-P',context:'cotidiano',answers:Array(25).fill(3),participantData:base});
  assert.equal(badSex.status,400);
  const badState = await request(app).post('/api/instrument-results').set('Authorization',auth)
    .send({id:suffix+'-bad-state',instrument:'HSI-DOTH-P',context:'cotidiano',answers:Array(25).fill(3),participantData:{...base,sex:'M',state:'Santa Catarina'}});
  assert.equal(badState.status,400);
});
