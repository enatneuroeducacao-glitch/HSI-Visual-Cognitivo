import { useEffect, useState } from 'react';
import { api } from './lib/api';

type Dimension={id:string;name:string;score:number;meanAcrossApplications?:number|null;observations?:number};
type ContextRow={context:string;label:string;applications:number;firstCompletedAt:string;latestCompletedAt:string;dimensions:Dimension[]};
type BehavioralRow={id:string;context:string;contextLabel:string;contextVersion:string;completedAt:string;dimensions:Dimension[];comparisonWithPreviousSameContext:Array<{dimensionId:string;score:number;previousScore:number|null;difference:number|null}>};
type CognitiveRow={id:string;mode:string;completedAt:string;accuracy:number;correct:number;totalQuestions:number;axes:Array<{axisId:string;title:string;accuracy:number;correct:number;total:number}>};
type Payload={generatedAt:string;methodology:{note:string};totals:{behavioralApplications:number;cognitiveApplications:number};contexts:ContextRow[];behavioralTimeline:BehavioralRow[];cognitiveTimeline:CognitiveRow[]};

const date=(value:string)=>new Date(value).toLocaleString('pt-BR');
const delta=(value:number|null)=>value===null?'Sem aplicação anterior':value===0?'Sem variação':(value>0?'+':'')+value+' pontos';

export default function ParticipantLongitudinal(){
 const [data,setData]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;api.get('/api/instrument-results/longitudinal').then(r=>{if(active)setData(r.data)}).catch(e=>{if(active)setError(e?.response?.data?.error||'Não foi possível carregar a análise longitudinal.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <section className="instrument-longitudinal-center">
  <div className="instrument-history-heading"><div><span className="eyebrow">ACOMPANHAMENTO DO PARTICIPANTE</span><h3>Análise longitudinal e comparação entre contextos</h3><p>Histórico pessoal de aplicações HSI-DOTH-P e HSI Visual Cognitivo, mantendo as duas fontes independentes.</p></div></div>
  {loading?<p>Organizando séries históricas…</p>:error?<div className="instrument-error" role="alert">{error}</div>:data&&<>
   <div className="instrument-cognitive-snapshot">
    <div><small>Aplicações HSI-DOTH-P</small><strong>{data.totals.behavioralApplications}</strong><span>Autorrelato comportamental</span></div>
    <div><small>Aplicações HSI Visual Cognitivo</small><strong>{data.totals.cognitiveApplications}</strong><span>Desempenho em tarefas estruturadas</span></div>
   </div>
   <section className="instrument-deep-reading"><h4>Leitura entre contextos</h4><p>Compare as dimensões do HSI-DOTH-P nos diferentes ambientes declarados. Diferenças entre contextos podem sugerir variação situacional percebida pelo participante; não demonstram, isoladamente, incoerência, intenção ou comportamento observado.</p></section>
   {data.contexts.length?<div className="instrument-deep-dimensions">{data.contexts.map(context=><article className="instrument-deep-dimension" key={context.context}>
    <div className="instrument-deep-head"><div><h4>{context.label}</h4><p>{context.applications} aplicação(ões) · última em {date(context.latestCompletedAt)}</p></div></div>
    <div className="instrument-longitudinal-grid">{context.dimensions.map(d=><div key={d.id}><span>{d.name}</span><strong>{d.latestScore}/100</strong><small>Média histórica: {d.meanAcrossApplications??'—'} · {d.observations} registro(s)</small></div>)}</div>
   </article>)}</div>:<p className="instrument-empty">Ainda não há aplicações comportamentais registradas.</p>}
   <section className="instrument-longitudinal"><h4>Evolução por aplicação — HSI-DOTH-P</h4>{data.behavioralTimeline.length?<div className="group-list">{[...data.behavioralTimeline].reverse().map(row=><article key={row.id}><b>{date(row.completedAt)} · {row.contextLabel}</b><span>{row.dimensions.map(d=>d.name+': '+d.score+'/100').join(' · ')}</span><small>{row.comparisonWithPreviousSameContext.map(d=>d.dimensionId+': '+delta(d.difference)).join(' | ')}</small></article>)}</div>:<p>Nenhum registro disponível.</p>}</section>
   <section className="instrument-longitudinal"><h4>Série cognitiva independente — HSI Visual Cognitivo</h4><p>Os percentuais abaixo pertencem exclusivamente às tarefas cognitivas. Não são convertidos em pontuação comportamental.</p>{data.cognitiveTimeline.length?<div className="group-list">{[...data.cognitiveTimeline].reverse().map(row=><article key={row.id}><b>{date(row.completedAt)} · {row.mode}</b><span>{row.accuracy}% · {row.correct}/{row.totalQuestions} acertos</span><small>{row.axes.map(axis=>axis.title+': '+axis.accuracy+'%').join(' · ')}</small></article>)}</div>:<p>Nenhuma avaliação cognitiva registrada.</p>}</section>
   <p className="instrument-method-note">{data.methodology.note}</p>
  </>}
 </section>;
}
