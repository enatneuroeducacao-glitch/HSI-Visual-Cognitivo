import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRole, validateAssessmentMode } from '../src/security.js';

test('controle de acesso: ADMIN pode acessar funções administrativas', () => {
  assert.equal(hasRole('ADMIN', ['ADMIN']), true);
  assert.equal(hasRole('ANALYST', ['ADMIN']), false);
  assert.equal(hasRole('PARTICIPANT', ['ADMIN']), false);
});

test('controle de acesso: analista só recebe funções explicitamente permitidas', () => {
  assert.equal(hasRole('ANALYST', ['ADMIN', 'ANALYST']), true);
  assert.equal(hasRole('ANALYST', ['PARTICIPANT']), false);
  assert.equal(hasRole(undefined, ['ADMIN', 'ANALYST']), false);
});

test('avaliação completa exige os 30 exercícios', () => {
  assert.equal(validateAssessmentMode('Avaliação completa', 30, ['logic','attention'], 30), null);
  assert.match(validateAssessmentMode('Avaliação completa', 29, ['logic','attention'], 30) || '', /30 exercícios/);
});

test('eixo individual exige cinco questões do mesmo eixo', () => {
  assert.equal(validateAssessmentMode('Eixo individual', 5, ['risk','risk','risk','risk','risk'], 30), null);
  assert.match(validateAssessmentMode('Eixo individual', 4, ['risk','risk','risk','risk'], 30) || '', /cinco exercícios/);
  assert.match(validateAssessmentMode('Eixo individual', 5, ['risk','risk','risk','risk','logic'], 30) || '', /único eixo/);
});

test('modalidade desconhecida é recusada', () => {
  assert.match(validateAssessmentMode('modo livre', 5, ['risk'], 30) || '', /inválida/);
});
