import { useEffect, useState } from 'react';
import { api } from './lib/api';

type Axis={axisId:string;title:string;correct:number;total:number;accuracy:number;averageSeconds:number;fastErrors:number;slowCorrect:number};
type Analytics={summary:{assessments:number;participants:number;totalQuestions:number;correct:number;accuracy:number;completeAssessments:number;axisAssessments:number};axes:Axis[];responseTimes:{under3:number;from3to5:number;from6to10:number;over10:number};timeline:Array<{period:string;assessments:number;questions:number;correct:number;accuracy:number}>};
type Behavior={totals:{cognitiveAssessments:number;cognitiveQuestions:number;cognitiveCorrect:number;cognitiveAccuracy:number;dothpAssessments:number};dothp:{dimensions:Array<{id:string;name:string;mean:number;score:number;applications:number;low:number;medium:number;high:number}>;contexts:Array<{context:string;count:number}>;likertDistribution:Array<{value:number;count:number}>}};
const cell=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
export default function ReportsCenter(){
 const [from,setFrom]=useState(new Date(Date.now()-365*86400000).toISOString().slice(0,10));
 const [to,setTo]=useState(new Date().toISOString().slice(0,10));
 const [groupId,setGroupId]=useState('');
 const [groups,setGroups]=useState<Array<{id:string;name:string}>>([]);
 const [analytics,setAnalytics]=useState<Analytics|null>(null);
 const [behavior,setBehavior]=useState<Behavior|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [generatedAt,setGeneratedAt]=useState('');
 const load=async()=>{setLoading(true);setError('');try{
  const q=new URLSearchParams({from:new Date(from+'T00:00:00').toISOString(),to:new Date(to+'T23:59:59').toISOString(),...(groupId?{groupId}:{})});
  const [a,b,g]=await Promise.all([api.get('/api/analytics?'+q.toString()),api.get('/api/admin/behavior?'+q.toString()),api.get('/api/groups')]);
  setAnalytics(a.data);setBehavior(b.data);setGroups(g.data.groups||[]);setGeneratedAt(new Date().toISOString());
 }catch(e:any){setAnalytics(null);setBehavior(null);setError(e?.response?.data?.error||'Não foi possível gerar os relatórios agregados.');}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const exportCsv=()=>{
  if(!analytics||!behavior)return;
  const rows:string[][]=[['Indicador','Categoria','Valor'],['Avaliações cognitivas','Total',String(analytics.summary.assessments)],['Participantes no conjunto','Total',String(analytics.summary.participants)],['Questões respondidas','Total',String(analytics.summary.totalQuestions)],['Precisão cognitiva','Total',analytics.summary.accuracy+'%'],...analytics.axes.map(a=>['Eixo cognitivo',a.title,a.accuracy+'%']),...behavior.dothp.dimensions.map(d=>['Dimensão HSI-DOTH-P',d.name,d.score+'/100']),...behavior.dothp.contexts.map(c=>['Contexto HSI-DOTH-P',c.context,String(c.count)+' aplicações']),...Object.entries(analytics.responseTimes).map(([k,v])=>['Faixa de tempo',k,String(v)])];
  const csv=rows.map(row=>row.map(cell).join(';')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hsi-relatorio-comportamental-agregado-'+from+'-'+to+'.csv';a.click();URL.revokeObjectURL(url);
 };
 return <section className="reports-center"><header className="reports-head"><div><span className="eyebrow">INTELIGÊNCIA E EVIDÊNCIAS</span><h2>Relatórios comportamentais agregados</h2><p>Somente estatísticas coletivas. Nenhum dado individual ou identificador de participante é disponibilizado nesta central.</p></div><button className="primary" onClick={()=>void load()} disabled={loading}>{loading?'Atualizando…':'Atualizar análise'}</button></header>
 <div className="reports-filters"><label>Data inicial<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Data final<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Grupo<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Todos os grupos</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><button className="primary" onClick={()=>void load()} disabled={loading}>Aplicar filtros</button><button className="secondary" onClick={exportCsv} disabled={!analytics||!behavior}>Exportar dados agregados CSV</button><button className="secondary" onClick={()=>window.print()}>Imprimir / PDF</button></div>
 {error&&<div className="notice error">{error}</div>}
 {analytics&&behavior&&<><div className="reports-kpis"><article><small>AVALIAÇÕES COGNITIVAS</small><strong>{analytics.summary.assessments}</strong></article><article><small>PARTICIPANTES NO CONJUNTO</small><strong>{analytics.summary.participants}</strong></article><article><small>RESPOSTAS COGNITIVAS</small><strong>{analytics.summary.totalQuestions}</strong></article><article><small>PRECISÃO COGNITIVA</small><strong>{analytics.summary.accuracy}%</strong></article><article><small>APLICAÇÕES HSI-DOTH-P</small><strong>{behavior.totals.dothpAssessments}</strong></article></div>
 <div className="reports-layout"><main className="reports-preview"><div className="reports-preview-head"><div><span className="eyebrow">VISÃO COLETIVA</span><h3>Desempenho nos seis eixos cognitivos</h3><p>Acertos, precisão e tempo médio de resposta consolidados no período selecionado.</p></div></div>
 <div className="reports-axis-visual">{analytics.axes.map(a=><div key={a.axisId}><div><b>{a.title}</b><strong>{a.accuracy}%</strong></div><div className="reports-track"><i style={{width:a.accuracy+'%'}}/></div><small>{a.correct} acertos de {a.total} respostas · {a.averageSeconds}s por questão · {a.fastErrors} erros rápidos · {a.slowCorrect} acertos com maior latência</small></div>)}</div>
 <div className="admin-section"><h3>HSI-DOTH-P · dimensões comportamentais</h3><p>Indicadores derivados das respostas autorreferidas, com pontuação ajustada para itens invertidos. Não representam diagnóstico ou classificação individual.</p><div className="reports-axis-visual">{behavior.dothp.dimensions.map(d=><div key={d.id}><div><b>{d.name}</b><strong>{d.score}/100</strong></div><div className="reports-track"><i style={{width:d.score+'%'}}/></div><small>Média {d.mean}/5 · {d.applications} aplicações · menor frequência: {d.low} · intermediária: {d.medium} · maior frequência: {d.high}</small></div>)}</div></div>
 <div className="admin-section"><h3>Contextos das aplicações</h3><div className="group-list">{behavior.dothp.contexts.map(c=><article key={c.context}><b>{c.context}</b><span>{c.count} aplicações</span></article>)}</div></div>
 <div className="admin-section"><h3>Distribuição temporal das respostas cognitivas</h3><div className="group-list">{Object.entries(analytics.responseTimes).map(([k,v])=><article key={k}><b>{k==='under3'?'Até 2 segundos':k==='from3to5'?'3 a 5 segundos':k==='from6to10'?'6 a 10 segundos':'Acima de 10 segundos'}</b><span>{v} respostas</span></article>)}</div></div>
 <div className="admin-section"><h3>Evolução mensal consolidada</h3><div className="table-scroll"><table><thead><tr><th>Mês</th><th>Avaliações</th><th>Questões</th><th>Precisão</th></tr></thead><tbody>{analytics.timeline.map(t=><tr key={t.period}><td>{t.period}</td><td>{t.assessments}</td><td>{t.questions}</td><td>{t.accuracy}%</td></tr>)}</tbody></table>{!analytics.timeline.length&&<p className="reports-empty">Sem registros no período selecionado.</p>}</div></div>
 <footer className="reports-foot">Gerado em {generatedAt?new Date(generatedAt).toLocaleString('pt-BR'):'—'} · Dados consolidados · Sem listagem, perfil ou histórico individual.</footer></main></div></>}
 </section>;
}