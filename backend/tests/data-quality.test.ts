import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDataQuality } from '../src/data-quality.js';
const cognitive=Array.from({length:6},(_,i)=>({userId:'c'+i,durationSeconds:300,totalQuestions:10,completedAt:new Date(),answerDetails:Array.from({length:10},(_,j)=>({selected:1,seconds:j===0?1:8}))}));
const behavioral=Array.from({length:6},(_,i)=>({userId:'b'+i,completedAt:new Date(),answers:Array(25).fill(4),dimensions:[]}));
test('sinaliza padrões agregados sem expor identificadores individuais',()=>{
 const result=analyzeDataQuality(cognitive,behavioral);
 assert.ok(result.flags.some(f=>f.code==='very_fast_items'));
 assert.ok(result.flags.some(f=>f.code==='uniform_likert'));
 assert.equal(JSON.stringify(result).includes('c0'),false);
});
test('suprime estatísticas de coortes abaixo do mínimo',()=>{
 const result=analyzeDataQuality(cognitive.slice(0,2),behavioral.slice(0,2));
 assert.equal(result.privacy.cognitiveSuppressed,true);
 assert.equal(result.summary.cognitiveApplications,null);
 assert.equal(result.privacy.behavioralSuppressed,true);
 assert.equal(result.summary.behavioralApplications,null);
});
test('não gera alerta quando não há aplicações',()=>{
 const result=analyzeDataQuality([],[]);
 assert.equal(result.flags.length,0);
});
