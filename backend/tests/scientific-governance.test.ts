import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDothp, dothpDimensions, dothpItems } from '../src/instrument-scoring.js';

test('HSI-DOTH-P aplica critérios de reversão e faixa de pontuação definidos pela versão',()=>{
 const answers=Array(25).fill(5);
 const baseline=scoreDothp(answers,'cotidiano');
 assert.equal(baseline.dimensions.length,5);
 assert.ok(baseline.dimensions.every(d=>d.score===80));
 const custom=scoreDothp(answers,'cotidiano',dothpItems.map(([dimension,prompt])=>({dimension,prompt})),{
  reverseItems:[],
  dimensions:dothpDimensions,
  scale:{min:1,max:5},
  scoreRange:{min:10,max:90},
  bands:{low:{maxExclusive:30},high:{min:70}}
 });
 assert.ok(custom.dimensions.every(d=>d.score===90));
});

test('alterações no banco versionado preservam ordem e dimensão das respostas',()=>{
 const questions=dothpItems.map(([dimension,prompt],index)=>({id:'q'+(index+1),dimension,prompt:'Versão revisada: '+prompt}));
 const result=scoreDothp(Array(25).fill(3),'trabalho',questions,{reverseItems:[],dimensions:dothpDimensions,scale:{min:1,max:5},scoreRange:{min:0,max:100}});
 assert.equal(result.answers.length,25);
 assert.equal(result.answers[0].statement.includes('trabalho'),true);
 assert.equal(result.answers[0].dimensionId,'decision');
 assert.equal(result.dimensions.length,5);
});
