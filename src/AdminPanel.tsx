import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './lib/api';

type Props = { role: 'ADMIN' | 'ANALYST' | 'PARTICIPANT' };
type Person = { id:string; name:string; email:string; role:string; status:string; participantCode:string|null; groupId:string|null; group?:{name:string}|null };
type Group = { id:string; name:string; _count?:{users:number} };
type Analytics = { summary:{assessments:number;participants:number;totalQuestions:number;correct:number;accuracy:number}; axes:Array<{axisId:string;title:string;correct:number;total:number;accuracy:number;averageSeconds:number}>; results:Array<{id:string;participant:string;participantCode:string|null;group:string;completedAt:string;mode:string;accuracy:number;totalQuestions:number;correct:number}> };

export default function AdminPanel({role}:Props) {
 const [tab,setTab]=useState<'overview'|'participants'|'groups'>('overview');
 const [from,setFrom]=useState(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
 const [to,setTo]=useState(new Date().toISOString().slice(0,10));
 const [groupId,setGroupId]=useState('');
 const [analytics,setAnalytics]=useState<Analytics|null>(null);
 const [people,setPeople]=useState<Person[]>([]);
 const [groups,setGroups]=useState<Group[]>([]);
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [code,setCode]=useState('');
 const [newGroup,setNewGroup]=useState('');
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const load=async()=>{
  setLoading(true);setError('');
  try {
   const q=new URLSearchParams({from:new Date(from+'T00:00:00').toISOString(),to:new Date(to+'T23:59:59').toISOString(),...(groupId?{groupId}:{})});
   const a=await api.get('/api/analytics?'+q.toString());setAnalytics(a.data);
   const g=await api.get('/api/groups');setGroups(g.data.groups);
   if(role==='ADMIN'){const p=await api.get('/api/users');setPeople(p.data.users);}
  } catch(e:any){setError(e?.response?.data?.error || e.message || 'Não foi possível carregar os dados.');}
  finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[]);
 const createPerson=async(e:FormEvent)=>{
  e.preventDefault();setError('');setNotice('');
  try{
   const r=await api.post('/api/users',{name,email,password:password||undefined,participantCode:code||undefined,role:'PARTICIPANT'});
   setNotice(r.data.temporaryPassword?'Participante criado. Senha temporária: '+r.data.temporaryPassword:'Participante criado com sucesso.');
   setName('');setEmail('');setPassword('');setCode('');await load();
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
  <div className="admin-heading"><div><span className="eyebrow">GESTÃO E INTELIGÊNCIA</span><h2>{role==='ADMIN'?'Central administrativa':'Painel de análise'}</h2><p>Indicadores descritivos de avaliações registradas na plataforma.</p></div><button className="primary" onClick={()=>void load()} disabled={loading}>{loading?'Atualizando…':'Atualizar dados'}</button></div>
  <nav className="admin-tabs">
   <button className={tab==='overview'?'selected':''} onClick={()=>setTab('overview')}>Visão coletiva</button>
   {role==='ADMIN'&&<button className={tab==='participants'?'selected':''} onClick={()=>setTab('participants')}>Participantes</button>}
   {role==='ADMIN'&&<button className={tab==='groups'?'selected':''} onClick={()=>setTab('groups')}>Grupos</button>}
  </nav>
  {notice&&<div className="notice success">{notice}</div>}{error&&<div className="notice error">{error}</div>}
  {tab==='overview'&&<div className="admin-content">
   <div className="filters"><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Grupo<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Todos os grupos</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><button className="primary" onClick={()=>void load()}>Aplicar filtros</button><button className="secondary" onClick={()=>window.print()}>Imprimir relatório</button></div>
   {analytics&&<><div className="metric-grid"><article><small>AVALIAÇÕES</small><strong>{analytics.summary.assessments}</strong></article><article><small>PARTICIPANTES</small><strong>{analytics.summary.participants}</strong></article><article><small>QUESTÕES RESPONDIDAS</small><strong>{analytics.summary.totalQuestions}</strong></article><article><small>PRECISÃO AGREGADA</small><strong>{analytics.summary.accuracy}%</strong></article></div>
   <div className="admin-section"><h3>Desempenho por eixo</h3><div className="axis-results">{analytics.axes.map(a=><div className="axis-result" key={a.axisId}><div><b>{a.title}</b><strong>{a.accuracy}%</strong></div><div className="bar"><span style={{width:a.accuracy+'%'}}/></div><small>{a.correct} acertos de {a.total} respostas · média {a.averageSeconds}s por questão</small></div>)}</div></div>
   <div className="admin-section"><div className="admin-section-head"><h3>Registros incluídos</h3><span>{analytics.results.length} resultados</span></div><div className="table-scroll"><table><thead><tr><th>Participante</th><th>Grupo</th><th>Data</th><th>Tipo</th><th>Precisão</th></tr></thead><tbody>{analytics.results.map(r=><tr key={r.id}><td>{r.participant}<small>{r.participantCode||'Sem código'}</small></td><td>{r.group}</td><td>{new Date(r.completedAt).toLocaleDateString('pt-BR')}</td><td>{r.mode}</td><td><b>{r.accuracy}%</b></td></tr>)}</tbody></table></div></div></>}
  </div>}
  {tab==='participants'&&role==='ADMIN'&&<div className="admin-content"><div className="admin-section"><h3>Novo participante</h3><form className="participant-form" onSubmit={createPerson}><label>Nome completo<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do participante"/></label><label>E-mail de acesso<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@exemplo.com"/></label><label>Código de identificação<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Opcional"/></label><label>Senha inicial<input type="password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Deixe vazio para gerar senha temporária"/></label><button className="primary">Cadastrar participante</button></form></div><div className="admin-section"><h3>Contas cadastradas</h3><div className="table-scroll"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ação</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.email}</td><td>{p.role}</td><td>{p.status}</td><td><button className="table-action" onClick={()=>void updateStatus(p)}>{p.status==='ACTIVE'?'Desativar':'Ativar'}</button></td></tr>)}</tbody></table></div></div></div>}
  {tab==='groups'&&role==='ADMIN'&&<div className="admin-content"><div className="admin-section"><h3>Criar grupo de avaliação</h3><form className="group-form" onSubmit={createGroup}><input required value={newGroup} onChange={e=>setNewGroup(e.target.value)} placeholder="Nome do grupo"/><button className="primary">Criar grupo</button></form></div><div className="admin-section"><h3>Grupos cadastrados</h3><div className="group-list">{groups.map(g=><article key={g.id}><b>{g.name}</b><span>{g._count?.users||0} participantes</span></article>)}</div></div></div>}
 </section>;
}
