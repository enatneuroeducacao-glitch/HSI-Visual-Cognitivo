import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './lib/api';
import ReportsCenter from './ReportsCenter';

type Props = { role: 'ADMIN' | 'ANALYST' | 'PARTICIPANT' };
type Person = { id:string; name:string; email:string; role:string; status:string; participantCode:string|null; groupId:string|null; group?:{name:string}|null };
type Group = { id:string; name:string; _count?:{users:number} };
type Analytics = { summary:{assessments:number;participants:number;totalQuestions:number;correct:number;accuracy:number;completeAssessments?:number;axisAssessments?:number}; axes:Array<{axisId:string;title:string;correct:number;total:number;accuracy:number;averageSeconds:number;fastErrors?:number;slowCorrect?:number}>; responseTimes?:{under3:number;from3to5:number;from6to10:number;over10:number}; timeline?:Array<{period:string;assessments:number;questions:number;accuracy:number}> };
type Behavior = { totals:{cognitiveAssessments:number;cognitiveQuestions:number;cognitiveCorrect:number;cognitiveAccuracy:number;dothpAssessments:number}; dothp:{dimensions:Array<{id:string;name:string;mean:number;score:number;applications:number;low:number;medium:number;high:number}>;contexts:Array<{context:string;count:number}>;likertDistribution:Array<{value:number;count:number}>} };


function TrendChart({data}:{data:NonNullable<Analytics['timeline']>}) {
 const rows=data.slice(-8); const max=Math.max(100,...rows.map(x=>x.accuracy));
 if(!rows.length)return <div className="chart-empty">Ainda não há série histórica suficiente para este período.</div>;
 const points=rows.map((x,i)=>({x:42+i*(616/Math.max(1,rows.length-1)),y:190-(x.accuracy/max)*145}));
 const path=points.map((p,i)=>(i?'L':'M')+`${p.x},${p.y}`).join(' ');
 return <div className="pro-chart"><svg viewBox="0 0 700 235" role="img" aria-label="Evolução da precisão agregada por mês"><line x1="42" y1="190" x2="658" y2="190" stroke="#dce5ef"/><line x1="42" y1="118" x2="658" y2="118" stroke="#e8eef5" strokeDasharray="4 5"/><line x1="42" y1="45" x2="658" y2="45" stroke="#e8eef5" strokeDasharray="4 5"/><path d={path} fill="none" stroke="#477eb8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>{points.map((p,i)=><g key={rows[i].period}><circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#477eb8" strokeWidth="3"/><text x={p.x} y="216" textAnchor="middle" fontSize="10" fill="#74849a">{rows[i].period.slice(5)}</text><text x={p.x} y={p.y-12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#284d73">{rows[i].accuracy}%</text></g>)}</svg><div className="chart-caption">Precisão agregada mensal · últimos {rows.length} períodos disponíveis</div></div>;
}
function ResponseBars({data}:{data:NonNullable<Analytics['responseTimes']>}) {
 const rows=[['Até 2 s',data.under3],['3–5 s',data.from3to5],['6–10 s',data.from6to10],['Acima de 10 s',data.over10]] as const;
 const max=Math.max(1,...rows.map(x=>x[1]));
 return <div className="response-chart">{rows.map(([label,value])=><div className="response-row" key={label}><span>{label}</span><div><i style={{width:(value/max*100)+'%'}}/></div><b>{value}</b></div>)}</div>;
}

export default function AdminPanel({role}:Props) {
 const [tab,setTab]=useState<'command'|'overview'|'participants'|'groups'|'reports'>('command');
 const [commandData,setCommandData]=useState<any>(null);
 const [from,setFrom]=useState(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
 const [to,setTo]=useState(new Date().toISOString().slice(0,10));
 const [groupId,setGroupId]=useState('');
 const [analytics,setAnalytics]=useState<Analytics|null>(null);
 const [behavior,setBehavior]=useState<Behavior|null>(null);
 const [people,setPeople]=useState<Person[]>([]);
 const [groups,setGroups]=useState<Group[]>([]);
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [code,setCode]=useState('');
 const [roleToCreate,setRoleToCreate]=useState<'PARTICIPANT'|'ANALYST'>('PARTICIPANT');
 const [groupToAssign,setGroupToAssign]=useState('');
 const [newGroup,setNewGroup]=useState('');
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const load=async()=>{
  setLoading(true);setError('');
  const q=new URLSearchParams({from:new Date(from+'T00:00:00').toISOString(),to:new Date(to+'T23:59:59').toISOString(),...(groupId?{groupId}:{})});
  const failures:string[]=[];
  const [a,b]=await Promise.allSettled([api.get('/api/analytics?'+q.toString()),api.get('/api/admin/behavior?'+q.toString())]);
  if(a.status==='fulfilled')setAnalytics(a.value.data);
  else{setAnalytics(null);failures.push(a.reason?.response?.data?.error||a.reason?.message||'Indicadores cognitivos indisponíveis.');}
  if(b.status==='fulfilled')setBehavior(b.value.data);
  else{setBehavior(null);failures.push(b.reason?.response?.data?.error||b.reason?.message||'Indicadores comportamentais indisponíveis.');}
  if(role==='ADMIN'){
   try{const c=await api.get('/api/admin/overview');setCommandData(c.data);}
   catch(e:any){setCommandData(null);failures.push(e?.response?.data?.error||'Não foi possível carregar os indicadores administrativos.');}
  }
  try{const g=await api.get('/api/groups');setGroups(g.data.groups);}
  catch(e:any){setGroups([]);failures.push(e?.response?.data?.error||'Não foi possível carregar os grupos.');}
  if(role==='ADMIN'){
   try{const p=await api.get('/api/users');setPeople(p.data.users);}
   catch(e:any){setPeople([]);failures.push(e?.response?.data?.error||'Não foi possível carregar os participantes.');}
  }
  setError([...new Set(failures)].join(' '));
  setLoading(false);
 };
 useEffect(()=>{void load();},[]);
 const createPerson=async(e:FormEvent)=>{
  e.preventDefault();setError('');setNotice('');
  try{
   const r=await api.post('/api/users',{name,email,password:password||undefined,participantCode:code||undefined,role:roleToCreate,groupId:groupToAssign||undefined});
   setNotice(r.data.temporaryPassword?'Participante criado. Senha temporária: '+r.data.temporaryPassword:'Participante criado com sucesso.');
   setName('');setEmail('');setPassword('');setCode('');setRoleToCreate('PARTICIPANT');setGroupToAssign('');await load();
  }catch(e:any){setError(e?.response?.data?.error||'Falha ao cadastrar participante.');}
 };
 const createGroup=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');setNotice('');
  try{await api.post('/api/groups',{name:newGroup});setNewGroup('');setNotice('Grupo criado.');await load();}
  catch(e:any){setError(e?.response?.data?.error||'Falha ao criar grupo.');}
 };
 const updateStatus=async(p:Person)=>{
  try{await api.patch('/api/users/'+p.id,{status:p.status==='ACTIVE'?'DISABLED':'ACTIVE'});await load();}
  catch(e:any){setError(e?.response?.data?.error||'Não foi possível atualizar o participante.');}
 };
 return <section className="admin-workspace">
  <div className="admin-heading"><div><span className="eyebrow">GESTÃO E INTELIGÊNCIA</span><h2>{role==='ADMIN'?'Central administrativa':'Painel de análise'}</h2><p>Indicadores coletivos e anônimos de todas as avaliações e respostas comportamentais.</p></div><button className="primary" onClick={()=>void load()} disabled={loading}>{loading?'Atualizando…':'Atualizar dados'}</button></div>
  <nav className="admin-tabs">
   {role==='ADMIN'&&<button className={tab==='command'?'selected':''} onClick={()=>setTab('command')}>Central de comando</button>}
   <button className={tab==='overview'?'selected':''} onClick={()=>setTab('overview')}>Visão coletiva</button>
   {role==='ADMIN'&&<button className={tab==='participants'?'selected':''} onClick={()=>setTab('participants')}>Participantes</button>}
   {role==='ADMIN'&&<button className={tab==='groups'?'selected':''} onClick={()=>setTab('groups')}>Grupos</button>}
   <button className={tab==='reports'?'selected':''} onClick={()=>setTab('reports')}>Relatórios</button>
  </nav>
  {notice&&<div className="notice success">{notice}</div>}{error&&<div className="notice error">{error}</div>}

  {tab==='command'&&role==='ADMIN'&&<div className="admin-content command-center">
   <div className="command-welcome"><div><span className="eyebrow">PAINEL DE CONTROLE DO HSI</span><h3>Central de comando</h3><p>Visão operacional, dados recebidos, atividade administrativa e acesso aos módulos de gestão.</p></div><div className="command-status"><i style={{background:commandData?.system?.api==='operational'&&commandData?.system?.database==='connected'?'#55d69b':'#e7b45a'}}/> {commandData?.system?.api==='operational'&&commandData?.system?.database==='connected'?'API e banco conectados':commandData?'Conexão indisponível':'Verificando conexão'} <small>{commandData?.generatedAt?new Date(commandData.generatedAt).toLocaleString('pt-BR'):'Aguardando resposta da API'}</small></div></div>
   {commandData&&<><div className="command-metrics"><article><small>CONTAS CADASTRADAS</small><strong>{commandData.counts.users}</strong><span>{commandData.counts.activeUsers} ativas</span></article><article><small>PARTICIPANTES</small><strong>{commandData.counts.participants}</strong><span>Contas de participantes</span></article><article><small>AVALIAÇÕES RECEBIDAS</small><strong>{commandData.counts.assessments}</strong><span>Registros persistidos</span></article><article><small>GRUPOS</small><strong>{commandData.counts.groups}</strong><span>{commandData.counts.analysts} analistas · {commandData.counts.admins} administradores</span></article></div>
   <div className="command-shortcuts"><button onClick={()=>setTab('participants')}>Gerenciar usuários <span>Contas, perfis e acessos →</span></button><button onClick={()=>setTab('groups')}>Gerenciar grupos <span>Organização dos participantes →</span></button><button onClick={()=>setTab('reports')}>Central de relatórios <span>Análises e exportações →</span></button><button onClick={()=>setTab('overview')}>Dados das avaliações <span>Indicadores e desempenho →</span></button></div>
   <div className="admin-section"><h3>Privacidade e governança</h3><p>Esta central apresenta somente indicadores estatísticos consolidados. Não exibe nomes, e-mails, códigos, identificadores, respostas individuais ou histórico individual.</p></div></>}
  </div>}
  {tab==='overview'&&<div className="admin-content">
   <div className="filters"><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Grupo<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Todos os grupos</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><button className="primary" onClick={()=>void load()}>Aplicar filtros</button><button className="secondary" onClick={()=>window.print()}>Imprimir relatório</button></div>
   {analytics&&<><div className="metric-grid"><article><small>AVALIAÇÕES</small><strong>{analytics.summary.assessments}</strong></article><article><small>PARTICIPANTES</small><strong>{analytics.summary.participants}</strong></article><article><small>QUESTÕES RESPONDIDAS</small><strong>{analytics.summary.totalQuestions}</strong></article><article><small>PRECISÃO AGREGADA</small><strong>{analytics.summary.accuracy}%</strong></article></div>
   <div className="pro-grid">
    <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">DESEMPENHO</span><h3>Precisão por eixo cognitivo</h3></div><small>Acertos / respostas</small></div><div className="axis-results">{analytics.axes.map(a=><div className="axis-result" key={a.axisId}><div><b>{a.title}</b><strong>{a.accuracy}%</strong></div><div className="bar"><span style={{width:a.accuracy+'%'}}/></div><small>{a.correct} de {a.total} respostas · tempo médio {a.averageSeconds}s</small></div>)}</div></div>
    <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">SÉRIE HISTÓRICA</span><h3>Evolução mensal</h3></div></div><TrendChart data={analytics.timeline||[]}/></div>
   </div>
   <div className="pro-grid">
    <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">FLUIDEZ DE RESPOSTA</span><h3>Distribuição temporal</h3></div></div><ResponseBars data={analytics.responseTimes||{under3:0,from3to5:0,from6to10:0,over10:0}}/></div>
    <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">CONTROLE DE QUALIDADE</span><h3>Sinais para revisão metodológica</h3></div></div>
     {analytics.axes.some(x=>(x.fastErrors||0)>0||(x.slowCorrect||0)>0)?<div className="quality-list">{analytics.axes.filter(x=>(x.fastErrors||0)>0||(x.slowCorrect||0)>0).map(x=><article key={x.axisId}><b>{x.title}</b><span>{x.fastErrors||0} respostas incorretas em até 5 s · {x.slowCorrect||0} acertos com latência de 15 s ou mais</span><small>Indício exploratório. Verificar compreensão do item, acessibilidade, dispositivo e contexto antes de qualquer conclusão.</small></article>)}</div>:<p className="quality-neutral">Nenhum padrão temporal de atenção prioritária foi identificado nos dados agregados deste recorte. Isso não comprova validade nem ausência de inconsistências.</p>}
    </div>
   </div>
   <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">PROCEDÊNCIA E CONFIABILIDADE</span><h3>Como interpretar resultados duvidosos</h3></div></div><div className="provenance-grid"><article><b>1. Conferir origem</b><p>Validar instrumento, versão, eixo, contexto de aplicação, período e integridade do registro.</p></article><article><b>2. Examinar condições</b><p>Considerar dispositivo, tamanho de tela, conectividade, acessibilidade, interrupções e familiaridade com a tarefa.</p></article><article><b>3. Revisar padrões</b><p>Observar latências extremas, respostas invariáveis, concentração incomum e divergências entre medidas agregadas.</p></article><article><b>4. Registrar decisão</b><p>Documentar hipótese, evidências, limitações e encaminhamento. Não excluir ou rotular resultados automaticamente.</p></article></div><p className="method-warning">Os alertas são triagem estatística, não prova de fraude, desatenção, condição psicológica ou incapacidade para dirigir. Resultados devem ser interpretados com tamanho amostral, qualidade do instrumento e contexto de aplicação.</p></div>
   {behavior&&<div className="admin-section"><h3>HSI-DOTH-P · indicadores comportamentais coletivos</h3><p>{behavior.totals.dothpAssessments} aplicações consolidadas · respostas autorreferidas, não diagnósticas.</p><div className="behavior-grid">{behavior.dothp.dimensions.map(d=><article className="behavior-card" key={d.id}><div><b>{d.name}</b><strong>{d.score}<small>/100</small></strong></div><div className="behavior-track"><i style={{width:d.score+'%'}}/></div><small>Média {d.mean}/5 · {d.applications} aplicações</small><div className="distribution-stack"><i style={{width:(d.applications?d.low/d.applications*100:0)+'%'}}/><i style={{width:(d.applications?d.medium/d.applications*100:0)+'%'}}/><i style={{width:(d.applications?d.high/d.applications*100:0)+'%'}}/></div><small>Faixas: menor {d.low} · intermediária {d.medium} · maior {d.high}</small></article>)}</div><div className="pro-grid"><div><h4>Contextos de aplicação</h4><div className="group-list">{behavior.dothp.contexts.map(c=><article key={c.context}><b>{c.context}</b><span>{c.count} aplicações</span></article>)}</div></div><div><h4>Distribuição Likert agregada</h4><div className="group-list">{behavior.dothp.likertDistribution.map(x=><article key={x.value}><b>Escala {x.value}</b><span>{x.count} respostas</span></article>)}</div></div></div></div>}</>}
  </div>}
  {tab==='participants'&&role==='ADMIN'&&<div className="admin-content"><div className="admin-section"><h3>Novo participante</h3><form className="participant-form" onSubmit={createPerson}><label>Nome completo<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do participante"/></label><label>E-mail de acesso<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@exemplo.com"/></label><label>Código de identificação<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Opcional"/></label><label>Senha inicial<input type="password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Deixe vazio para gerar senha temporária"/></label><label>Perfil<select value={roleToCreate} onChange={e=>setRoleToCreate(e.target.value as 'PARTICIPANT'|'ANALYST')}><option value="PARTICIPANT">Participante</option><option value="ANALYST">Analista</option></select></label><label>Grupo<select value={groupToAssign} onChange={e=>setGroupToAssign(e.target.value)}><option value="">Sem grupo</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><button className="primary">Cadastrar acesso</button></form></div><div className="admin-section"><h3>Contas cadastradas</h3><div className="table-scroll"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ação</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.email}</td><td>{p.role}</td><td>{p.status}</td><td><button className="table-action" onClick={()=>void updateStatus(p)}>{p.status==='ACTIVE'?'Desativar':'Ativar'}</button></td></tr>)}</tbody></table></div></div></div>}
  {tab==='reports'&&<ReportsCenter/>}
  {tab==='groups'&&role==='ADMIN'&&<div className="admin-content"><div className="admin-section"><h3>Criar grupo de avaliação</h3><form className="group-form" onSubmit={createGroup}><input required value={newGroup} onChange={e=>setNewGroup(e.target.value)} placeholder="Nome do grupo"/><button className="primary">Criar grupo</button></form></div><div className="admin-section"><h3>Grupos cadastrados</h3><div className="group-list">{groups.map(g=><article key={g.id}><b>{g.name}</b><span>{g._count?.users||0} participantes</span></article>)}</div></div></div>}
 </section>;
}
