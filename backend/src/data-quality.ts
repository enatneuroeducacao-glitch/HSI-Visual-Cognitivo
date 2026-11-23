export type QualityFlag = {
  code: string; title: string; severity: 'info'|'review'|'attention';
  applications: number; confidence: 'baixa'|'moderada'|'alta';
  criterion: string; explanation: string; recommendation: string;
};
type CognitiveRow = { userId:string; durationSeconds:number; totalQuestions:number; answerDetails:unknown; completedAt:Date; instrumentVersion?:string; mode?:string; accuracy?:number };
type BehavioralRow = { userId:string; answers:unknown; dimensions:unknown; completedAt:Date; context?:string; contextVersion?:string; instrumentVersion?:string; state?:string|null; city?:string|null; institutionType?:string|null };
const numeric = (value:unknown): number[] => Array.isArray(value) ? value.map(v => typeof v==='number'?v:typeof v==='object'&&v!==null&&'response' in v?Number((v as any).response):typeof v==='object'&&v!==null&&'selected' in v?Number((v as any).selected):NaN).filter(Number.isFinite) : [];
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const variance=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+(x-mean(xs))**2,0)/xs.length:0;
const median=(xs:number[])=>{if(!xs.length)return 0;const a=[...xs].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const makeFlag=(code:string,title:string,severity:QualityFlag['severity'],applications:number,confidence:QualityFlag['confidence'],criterion:string,explanation:string,recommendation:string):QualityFlag=>({code,title,severity,applications,confidence,criterion,explanation,recommendation});
export function analyzeDataQuality(cognitive:CognitiveRow[],behavioral:BehavioralRow[],minimumGroupSize=5){
 const cParticipants=new Set(cognitive.map(r=>r.userId)).size, bParticipants=new Set(behavioral.map(r=>r.userId)).size;
 const cAnswers=cognitive.flatMap(r=>Array.isArray(r.answerDetails)?r.answerDetails as any[]:[]);
 const seconds=cAnswers.map(a=>Number(a?.seconds)).filter(Number.isFinite).filter(x=>x>=0);
 const underTwo=seconds.filter(x=>x<2).length, underThree=seconds.filter(x=>x<3).length;
 const repeatedCognitive=cognitive.filter(r=>{const a=Array.isArray(r.answerDetails)?r.answerDetails as any[]:[];return a.length>=10&&a.every(x=>Number(x?.selected)===Number(a[0]?.selected));}).length;
 const behavioralRows=behavioral.map(r=>({row:r,values:numeric(r.answers)}));
 const uniformBehavioral=behavioralRows.filter(x=>{const v=x.values;return v.length>=20&&(new Set(v).size===1||Math.max(...[1,2,3,4,5].map(k=>v.filter(x=>x===k).length))/v.length>=0.9);}).length;
 const lowVarianceBehavioral=behavioralRows.filter(x=>x.values.length>=20&&variance(x.values)<0.25).length;
 const durations=cognitive.map(r=>r.durationSeconds).filter(x=>Number.isFinite(x)&&x>0);
 const durationMedian=median(durations), deviations=durations.map(x=>Math.abs(x-durationMedian)), mad=median(deviations);
 const extremeDuration=durations.filter(x=>mad>0&&Math.abs(x-durationMedian)>3*1.4826*mad).length;
 const cognitivePairs=new Map<string,CognitiveRow[]>();
 for(const row of cognitive){const key=[row.userId,row.instrumentVersion||'1.0',row.mode||'full'].join('|');const list=cognitivePairs.get(key)||[];list.push(row);cognitivePairs.set(key,list);}
 const cognitiveDifferences=[...cognitivePairs.values()].flatMap(rows=>rows.sort((a,b)=>a.completedAt.getTime()-b.completedAt.getTime()).slice(1).map((row,i)=>Math.abs(Number(row.accuracy||0)-Number(rows[i].accuracy||0)))).filter(delta=>delta>=25).length;
 const behavioralPairs=new Map<string,BehavioralRow[]>();
 for(const row of behavioral){const key=[row.userId,row.instrumentVersion||'1.0',row.context||'unknown',row.contextVersion||'1.0'].join('|');const list=behavioralPairs.get(key)||[];list.push(row);behavioralPairs.set(key,list);}
 const behavioralDifferences=[...behavioralPairs.values()].flatMap(rows=>rows.sort((a,b)=>a.completedAt.getTime()-b.completedAt.getTime()).slice(1).map((row,i)=>{
   const before=Array.isArray(rows[i].dimensions)?rows[i].dimensions as any[]:[],after=Array.isArray(row.dimensions)?row.dimensions as any[]:[];
   const deltas=after.map(d=>{const old=before.find(x=>x?.id===d?.id);return old?Math.abs(Number(d?.score)-Number(old?.score)):0;}).filter(Number.isFinite);
   return deltas.length?mean(deltas):0;
 })).filter(delta=>delta>=20).length;
 const composition=(field:'state'|'city'|'institutionType')=>{
   const groups=new Map<string,{users:Set<string>;applications:number}>();
   for(const row of behavioral){const label=String(row[field]||'').trim();if(!label)continue;const g=groups.get(label)||{users:new Set<string>(),applications:0};g.users.add(row.userId);g.applications++;groups.set(label,g);}
   const visible=[...groups.entries()].filter(([,g])=>g.users.size>=minimumGroupSize).map(([label,g])=>({label,participants:g.users.size,applications:g.applications})).sort((a,b)=>b.participants-a.participants);
   return {groups:visible,suppressedCategories:[...groups.values()].some(g=>g.users.size<minimumGroupSize)};
 };
 const flags:QualityFlag[]=[];
 if(cognitive.length&&cParticipants>=minimumGroupSize){
  if(underTwo>0)flags.push(makeFlag('very_fast_items','Respostas em intervalo muito curto','review',underTwo,underTwo>=Math.max(5,seconds.length*.1)?'moderada':'baixa','Tempo por item inferior a 2 segundos.','Pode refletir leitura rápida, familiaridade, acessibilidade ou limitações do registro temporal; não comprova desatenção.','Examinar a distribuição por questão, dispositivo e complexidade antes de qualquer interpretação.'));
  if(repeatedCognitive>0)flags.push(makeFlag('identical_pattern_cognitive','Sequência uniforme de marcações','review',repeatedCognitive,repeatedCognitive>=3?'moderada':'baixa','Todas as respostas registradas em uma aplicação possuem a mesma alternativa.','Pode refletir preferência legítima, desenho do item ou padrão de preenchimento.','Verificar a redação, a ordem dos itens e a distribuição agregada por questão.'));
  if(extremeDuration>0)flags.push(makeFlag('duration_outliers','Durações atípicas','info',extremeDuration,'moderada','Distância superior a 3 × 1,4826 × MAD em relação à mediana do grupo.','Valores extremos podem decorrer de interrupções, pausas, conectividade ou condições de aplicação.','Revisar contexto e distribuição; não excluir registros automaticamente.'));
 }
 if(cognitive.length&&cParticipants>=minimumGroupSize&&cognitiveDifferences>0)flags.push(makeFlag('longitudinal_cognitive_difference','Diferenças entre aplicações cognitivas','info',cognitiveDifferences,'baixa','Diferença absoluta de pelo menos 25 pontos percentuais entre aplicações consecutivas do mesmo participante, modalidade e versão.','Pode refletir aprendizagem, familiaridade, condições distintas de aplicação ou variação de desempenho; não caracteriza inconsistência.','Verificar comparabilidade das versões, intervalo entre aplicações e condições de realização.'));
 if(behavioral.length&&bParticipants>=minimumGroupSize){
  if(uniformBehavioral>0)flags.push(makeFlag('uniform_likert','Padrão concentrado na escala Likert','review',uniformBehavioral,uniformBehavioral>=3?'moderada':'baixa','Uma alternativa representa pelo menos 90% das 25 respostas, ou todas são iguais.','Pode expressar uma posição consistente do participante; também pode decorrer de itens pouco discriminativos.','Analisar item a item, itens invertidos e adequação contextual do instrumento.'));
  if(lowVarianceBehavioral>0)flags.push(makeFlag('low_variability','Baixa variabilidade das respostas','info',lowVarianceBehavioral,'baixa','Variância populacional das 25 respostas inferior a 0,25.','A baixa dispersão não indica, isoladamente, baixa qualidade ou falta de atenção.','Comparar distribuição por dimensão e revisar possíveis efeitos de teto ou piso.'));
 }
 if(behavioral.length&&bParticipants>=minimumGroupSize&&behavioralDifferences>0)flags.push(makeFlag('longitudinal_behavioral_difference','Diferenças entre aplicações HSI-DOTH-P','info',behavioralDifferences,'baixa','Diferença média absoluta de pelo menos 20 pontos na escala 0–100 entre aplicações consecutivas do mesmo contexto e versões.','Mudanças autorreferidas podem decorrer de contexto, reflexão, experiência ou variação de resposta; não são prova de inconsistência.','Revisar contexto, intervalo, versão do instrumento e condições de aplicação antes de interpretar.'));
 const cognitiveSuppressed=cognitive.length>0&&cParticipants<minimumGroupSize;
 const behavioralSuppressed=behavioral.length>0&&bParticipants<minimumGroupSize;
 return {
  generatedAt:new Date().toISOString(),minimumGroupSize,
  privacy:{cognitiveSuppressed,behavioralSuppressed},
  summary:{cognitiveApplications:cognitiveSuppressed?null:cognitive.length,cognitiveParticipants:cognitiveSuppressed?null:cParticipants,behavioralApplications:behavioralSuppressed?null:behavioral.length,behavioralParticipants:behavioralSuppressed?null:bParticipants,signals:flags.length,analyzedItemTimes:cognitiveSuppressed?null:seconds.length,underTwoSeconds:cognitiveSuppressed?null:underTwo,underThreeSeconds:cognitiveSuppressed?null:underThree},
  flags:flags.filter(f=>f.code.startsWith('very_fast')||f.code.startsWith('identical')||f.code.startsWith('duration')?!cognitiveSuppressed:!behavioralSuppressed),
  sample:{cognitive:{applications:cognitiveSuppressed?null:cognitive.length,participants:cognitiveSuppressed?null:cParticipants,minimumReached:!cognitiveSuppressed},behavioral:{applications:behavioralSuppressed?null:behavioral.length,participants:behavioralSuppressed?null:bParticipants,minimumReached:!behavioralSuppressed},composition:behavioralSuppressed?{states:[],cities:[],institutionTypes:[],suppressed:true}:{states:composition('state').groups,cities:composition('city').groups,institutionTypes:composition('institutionType').groups,suppressed:composition('state').suppressedCategories||composition('city').suppressedCategories||composition('institutionType').suppressedCategories}},
  methodology:{note:'Sinalizações exploratórias agregadas. Não classificam pessoas, não constituem diagnóstico e não determinam exclusão de respostas.',durationOutlierMethod:'Mediana e desvio absoluto mediano (MAD), limiar exploratório de 3 × 1,4826 × MAD.',confidence:'Indica a força operacional do padrão agregado observado, não a probabilidade de erro individual.'}
 };
}
