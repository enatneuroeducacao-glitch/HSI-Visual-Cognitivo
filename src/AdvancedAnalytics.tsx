import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';

type GroupRow={id:string;label:string;state:string;city:string;applications:number;participants:number;accuracy:number|null;dimensions:Array<{dimensionId:string;name:string;score:number}>};
type Monthly={period:string;applications:number;participants:number;accuracy:number|null;cognitiveApplications?:number;behavioralApplications?:number;totalApplications?:number};
type InstrumentData={
 privacy:{suppressed:boolean;minimumGroupSize:number;distinctParticipants:number};
 summary:{participants:number;applications:number;correct:number|null;totalQuestions:number|null;accuracy:number|null};
 monthly:Monthly[];states:GroupRow[];cities:GroupRow[];institutions:GroupRow[];
 axes:Array<{id:string;title:string;correct:number;total:number;accuracy:number;averageSeconds:number;fastErrors:number;slowCorrect:number}>;
 dimensions:Array<{id:string;name:string;score:number;applications:number;low:number;medium:number;high:number}>;
 contexts:Array<{context:string;applications:number;participants:number}>;
 likert:Array<{value:number;count:number}>;
 quality:{uniformResponseApplications:number;concentratedResponseApplications:number};
 responseTimes:{under3:number;from3to5:number;from6to10:number;over10:number};
};
type Data={
 generatedAt:string;period:{from:string;to:string};
 privacy:{minimumGroupSize:number;executiveSuppressed:boolean};
 executive:{participants:number;participantsRecurring:number;totalApplications:number;cognitiveApplications:number;behavioralApplications:number;monthly:Monthly[]};
 cognitive:InstrumentData;behavioral:InstrumentData;
};
const contextNames:Record<string,string>={cotidiano:'Vida cotidiana',trabalho:'Trabalho',educacao:'Educação',familia:'Família',social:'Comunidade',digital:'Ambientes digitais',transito:'Mobilidade e trânsito',integrado:'Contextos integrados'};
const monthName=(value:string)=>{const [year,month]=value.split('-');return new Date(Number(year),Number(month)-1,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});};
function Empty({text}:{text:string}){return <div className="advanced-empty">{text}</div>;}
function Bars({rows}:{rows:Array<{label:string;value:number;detail?:string}>}){
 const max=Math.max(1,...rows.map(x=>x.value));
 return <div className="advanced-bars">{rows.map(row=><div className="advanced-bar-row" key={row.label}><div><b>{row.label}</b><span>{row.detail||row.value.toLocaleString('pt-BR')}</span></div><div className="advanced-bar-track"><i style={{width:(row.value/max*100)+'%'}}/></div></div>)}</div>;
}
function Metric({label,value,detail}:{label:string;value:string|number;detail:string}){return <article className="advanced-metric"><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>;}
export default function AdvancedAnalytics(){
 const [tab,setTab]=useState<'executive'|'behavioral'|'cognitive'|'national'>('executive');
 const [data,setData]=useState<Data|null>(null);
 const [from,setFrom]=useState(()=>new Date(Date.now()-365*86400000).toISOString().slice(0,10));
 const [to,setTo]=useState(()=>new Date().toISOString().slice(0,10));
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const query=new URLSearchParams({from:new Date(from+'T00:00:00.000Z').toISOString(),to:new Date(to+'T23:59:59.999Z').toISOString()});
   const response=await api.get('/api/admin/national-analytics?'+query.toString());
   setData(response.data);
  }catch(e:any){setData(null);setError(e?.response?.data?.error||e?.message||'Não foi possível carregar a inteligência administrativa.');}
  finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[]);
 const growth=useMemo(()=>{
  const rows=data?.executive.monthly||[];
  if(rows.length<2)return null;
  const previous=rows[rows.length-2].totalApplications||0;
  const current=rows[rows.length-1].totalApplications||0;
  if(previous===0)return null;
  return Math.round((current-previous)/previous*100);
 },[data]);
 const tabs=[['executive','Painel executivo'],['behavioral','HSI-DOTH-P'],['cognitive','HSI Visual Cognitivo'],['national','Inteligência nacional']] as const;
 return <section className="advanced-analytics">
  <div className="advanced-heading"><div><span className="eyebrow">CENTRAL ADMINISTRATIVA · INTELIGÊNCIA</span><h2>Centro de comando da pesquisa</h2><p>Indicadores agregados, evolução da participação e qualidade metodológica dos instrumentos.</p></div><button className="primary" onClick={()=>void load()} disabled={loading}>{loading?'Atualizando…':'Atualizar dados'}</button></div>
  <div className="filters advanced-filters"><label>Período inicial<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Período final<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="primary" onClick={()=>void load()} disabled={loading}>Aplicar período</button><span className="advanced-generated">{data?.generatedAt?'Atualizado em '+new Date(data.generatedAt).toLocaleString('pt-BR'):''}</span></div>
  <nav className="advanced-tabs">{tabs.map(([key,label])=><button key={key} className={tab===key?'selected':''} onClick={()=>setTab(key)}>{label}</button>)}</nav>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {!data&&loading&&<Empty text="Carregando indicadores agregados…"/>}
  {data&&tab==='executive'&&<div className="advanced-content">
   {data.privacy.executiveSuppressed?<div className="method-warning">Painel executivo suprimido: são necessários pelo menos {data.privacy.minimumGroupSize} participantes distintos no conjunto da pesquisa.</div>:<>
    <div className="advanced-kpis">
     <Metric label="PARTICIPANTES" value={data.executive.participants} detail="Pessoas distintas nos instrumentos"/>
     <Metric label="APLICAÇÕES" value={data.executive.totalApplications} detail="Soma dos registros válidos"/>
     <Metric label="PARTICIPANTES RECORRENTES" value={data.executive.participantsRecurring} detail="Mais de uma aplicação no mesmo instrumento"/>
     <Metric label="CRESCIMENTO MENSAL" value={growth===null?'—':(growth>0?'+':'')+growth+'%'} detail="Variação de aplicações entre os dois últimos meses publicáveis"/>
    </div>
    <div className="advanced-kpis two">
     <Metric label="HSI-DOTH-P" value={data.executive.behavioralApplications} detail="Aplicações comportamentais com consentimento de pesquisa"/>
     <Metric label="HSI VISUAL COGNITIVO" value={data.executive.cognitiveApplications} detail="Aplicações em tarefas dos seis eixos cognitivos"/>
    </div>
    <div className="advanced-panel"><div className="advanced-panel-head"><div><span className="eyebrow">CRESCIMENTO DA PESQUISA</span><h3>Evolução mensal das aplicações</h3></div><small>Instrumentos apresentados separadamente</small></div>
     {data.executive.monthly.length?<div className="advanced-months">{data.executive.monthly.map(m=><div key={m.period}><b>{monthName(m.period)}</b><div className="advanced-stacked"><i className="behavior" style={{width:(m.totalApplications?m.behavioralApplications!/Math.max(...data.executive.monthly.map(x=>x.totalApplications||0))*100:0)+'%'}}/><i className="cognitive" style={{width:(m.totalApplications?m.cognitiveApplications!/Math.max(...data.executive.monthly.map(x=>x.totalApplications||0))*100:0)+'%'}}/></div><strong>{m.totalApplications}</strong><small>{m.participants} participantes</small></div>)}</div>:<Empty text="Ainda não há meses com amostra mínima para publicação."/>}
     <div className="advanced-legend"><span><i className="behavior"/> HSI-DOTH-P</span><span><i className="cognitive"/> HSI Visual Cognitivo</span></div>
    </div>
   </>}
  </div>}
  {data&&tab==='behavioral'&&<div className="advanced-content">
   <div className="advanced-instrument-title"><div><span className="eyebrow">INSTRUMENTO COMPORTAMENTAL</span><h3>HSI-DOTH-P</h3><p>Autorrelato em cinco dimensões. Não constitui diagnóstico psicológico ou medida de aptidão.</p></div><span className="instrument-chip">25 afirmações · Likert 1–5</span></div>
   {data.behavioral.privacy.suppressed?<div className="method-warning">Dados comportamentais suprimidos: {data.behavioral.privacy.distinctParticipants} participantes distintos; mínimo exigido: {data.behavioral.privacy.minimumGroupSize}.</div>:<>
    <div className="advanced-kpis"><Metric label="PARTICIPANTES" value={data.behavioral.summary.participants} detail="Participantes distintos com consentimento"/><Metric label="APLICAÇÕES" value={data.behavioral.summary.applications} detail="Questionários concluídos"/><Metric label="DIMENSÕES" value={data.behavioral.dimensions.length} detail="Dimensões previstas no instrumento"/><Metric label="CONTEXTOS PUBLICÁVEIS" value={data.behavioral.contexts.length} detail="Com cinco participantes distintos"/></div>
    <div className="advanced-panel"><div className="advanced-panel-head"><div><span className="eyebrow">CINCO DIMENSÕES</span><h3>Distribuição dos indicadores comportamentais</h3></div><small>Escala descritiva de 0 a 100</small></div>
     <div className="advanced-dimensions">{data.behavioral.dimensions.map(d=><article key={d.id}><div><b>{d.name}</b><strong>{d.score}<small>/100</small></strong></div><div className="advanced-bar-track"><i style={{width:d.score+'%'}}/></div><small>{d.applications} aplicações · faixas: {d.low} menor, {d.medium} intermediária, {d.high} maior</small></article>)}</div>
    </div>
    <div className="advanced-grid"><div className="advanced-panel"><h3>Distribuição das respostas Likert</h3><Bars rows={data.behavioral.likert.map(x=>({label:'Escala '+x.value,value:x.count,detail:x.count+' respostas'}))}/></div><div className="advanced-panel"><h3>Comparação entre contextos</h3>{data.behavioral.contexts.length?<div className="advanced-list">{data.behavioral.contexts.map(c=><article key={c.context}><b>{contextNames[c.context]||c.context}</b><span>{c.applications} aplicações · {c.participants} participantes</span></article>)}</div>:<Empty text="Nenhum contexto atingiu o mínimo de publicação."/>}</div></div>
    <div className="advanced-panel"><div className="advanced-panel-head"><div><span className="eyebrow">CONSISTÊNCIA DAS RESPOSTAS</span><h3>Indicadores para revisão metodológica</h3></div></div><div className="advanced-kpis two"><Metric label="RESPOSTA TOTALMENTE UNIFORME" value={data.behavioral.quality.uniformResponseApplications} detail="25 respostas iguais em uma aplicação"/><Metric label="ALTA CONCENTRAÇÃO EM UMA OPÇÃO" value={data.behavioral.quality.concentratedResponseApplications} detail="80% ou mais em uma única alternativa"/></div><p className="method-warning">Sinais exploratórios, não evidência de resposta inválida. Revisar contexto, compreensão dos itens, versão do instrumento e condições de aplicação antes de qualquer decisão.</p></div>
   </>}
  </div>}
  {data&&tab==='cognitive'&&<div className="advanced-content">
   <div className="advanced-instrument-title"><div><span className="eyebrow">INSTRUMENTO DE TAREFAS E EXERCÍCIOS VISUAIS</span><h3>HSI Visual Cognitivo</h3><p>Desempenho observado nas tarefas, com precisão e tempo de resposta por eixo.</p></div><span className="instrument-chip">6 eixos · 30 exercícios</span></div>
   {data.cognitive.privacy.suppressed?<div className="method-warning">Dados cognitivos suprimidos: {data.cognitive.privacy.distinctParticipants} participantes distintos; mínimo exigido: {data.cognitive.privacy.minimumGroupSize}.</div>:<>
    <div className="advanced-kpis"><Metric label="PARTICIPANTES" value={data.cognitive.summary.participants} detail="Participantes distintos"/><Metric label="APLICAÇÕES" value={data.cognitive.summary.applications} detail="Sessões concluídas"/><Metric label="PRECISÃO GERAL" value={(data.cognitive.summary.accuracy??0)+'%'} detail={data.cognitive.summary.correct+' acertos em '+data.cognitive.summary.totalQuestions+' respostas'}/><Metric label="EIXOS COM DADOS" value={data.cognitive.axes.length} detail="Dos seis eixos previstos"/></div>
    <div className="advanced-panel"><div className="advanced-panel-head"><div><span className="eyebrow">SEIS EIXOS COGNITIVOS</span><h3>Precisão, acertos e tempo médio</h3></div><small>Desempenho agregado</small></div>
     <div className="advanced-axis-list">{data.cognitive.axes.map(a=><article key={a.id}><div className="advanced-axis-title"><b>{a.title}</b><strong>{a.accuracy}%</strong></div><div className="advanced-bar-track"><i style={{width:a.accuracy+'%'}}/></div><small>{a.correct}/{a.total} acertos · {a.averageSeconds}s por questão · {a.fastErrors} erros até 5s · {a.slowCorrect} acertos a partir de 15s</small></article>)}</div>
    </div>
    <div className="advanced-grid"><div className="advanced-panel"><h3>Tempo de resposta</h3><Bars rows={[{label:'Até 2 segundos',value:data.cognitive.responseTimes.under3},{label:'3 a 5 segundos',value:data.cognitive.responseTimes.from3to5},{label:'6 a 10 segundos',value:data.cognitive.responseTimes.from6to10},{label:'Acima de 10 segundos',value:data.cognitive.responseTimes.over10}]}/></div><div className="advanced-panel"><h3>Variação mensal</h3>{data.cognitive.monthly.length?<div className="advanced-list">{data.cognitive.monthly.map(m=><article key={m.period}><b>{monthName(m.period)}</b><span>{m.applications} aplicações · {m.participants} participantes · {m.accuracy??'—'}% precisão</span></article>)}</div>:<Empty text="Ainda não há série mensal publicável."/>}</div></div>
    <p className="method-warning">Tempo e precisão são indicadores descritivos. Respostas rápidas ou lentas não devem ser interpretadas isoladamente como desatenção, impulsividade ou incapacidade.</p>
   </>}
  </div>}
  {data&&tab==='national'&&<div className="advanced-content">
   <div className="advanced-instrument-title"><div><span className="eyebrow">INTELIGÊNCIA NACIONAL</span><h3>Distribuição territorial e institucional</h3><p>Participação por UF, municípios e instituições, com séries independentes por instrumento.</p></div></div>
   <div className="advanced-national-section"><div className="advanced-panel"><h3>HSI-DOTH-P · distribuição territorial</h3>{data.behavioral.privacy.suppressed?<Empty text="Dados comportamentais suprimidos pelo limite mínimo de participantes."/>:<><p className="advanced-note">Ordenação por volume de participação, não por desempenho. Médias dimensionais permanecem separadas.</p><Territory rows={data.behavioral.states} label="UF"/><Territory rows={data.behavioral.cities} label="Município"/><Territory rows={data.behavioral.institutions} label="Instituição"/></>}</div>
   <div className="advanced-panel"><h3>HSI Visual Cognitivo · distribuição territorial</h3>{data.cognitive.privacy.suppressed?<Empty text="Dados cognitivos suprimidos pelo limite mínimo de participantes."/>:<><p className="advanced-note">Precisão média por grupo, sem combinação com dimensões comportamentais.</p><Territory rows={data.cognitive.states} label="UF"/><Territory rows={data.cognitive.cities} label="Município"/><Territory rows={data.cognitive.institutions} label="Instituição"/></>}</div></div>
   <p className="method-warning">Somente grupos com pelo menos cinco participantes distintos são exibidos. Quando a amostra não alcança o limite, o dado é suprimido. A ordenação territorial não representa ranking de qualidade, risco ou aptidão.</p>
  </div>}
 </section>;
}
function Territory({rows,label}:{rows:GroupRow[];label:string}){
 if(!rows.length)return <div className="advanced-territory-block"><h4>{label}</h4><Empty text="Sem grupos com amostra mínima neste recorte."/></div>;
 return <div className="advanced-territory-block"><h4>{label} · {rows.length}</h4><div className="advanced-list">{rows.map(row=><article key={row.id}><b>{row.label}</b><span>{row.participants} participantes · {row.applications} aplicações{row.accuracy===null?'':' · '+row.accuracy+'% precisão'}</span>{row.dimensions.length>0&&<small>{row.dimensions.map(d=>d.name+' '+d.score+'/100').join(' · ')}</small>}</article>)}</div></div>;
}
