import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';

type Evidence={
 id:string;instrument:string;evidenceType:string;title:string;versionScope:string;studyCode?:string|null;
 protocolReference?:string|null;methodDescription:string;population:string;sampleSize:number;sampleDescription:string;
 findings:string;interpretation:string;limitations:string;ethicalStatus:string;ethicsReference?:string|null;
 status:string;reviewer?:string|null;reviewedAt?:string|null;createdAt:string
};
const kinds=[
 ['RELIABILITY','Confiabilidade'],
 ['INTERNAL_CONSISTENCY','Consistência interna'],
 ['CONTENT_VALIDITY','Validade de conteúdo'],
 ['CONSTRUCT_VALIDITY','Validade de construto'],
 ['INDICATOR_VALIDITY','Validade dos indicadores'],
 ['GROUP_BIAS','Viés entre grupos'],
 ['COGNITIVE_TASK_ADEQUACY','Adequação das tarefas cognitivas'],
 ['TEST_RETEST','Estabilidade temporal (teste-reteste)'],
 ['SAMPLE_REPRESENTATIVENESS','Representatividade amostral'],
 ['ETHICS_REVIEW','Revisão ética']
];
const blank={
 instrument:'HSI-DOTH-P',evidenceType:'RELIABILITY',title:'',versionScope:'1.0',studyCode:'',
 protocolReference:'',methodDescription:'',population:'',sampleSize:0,sampleDescription:'',
 findings:'',interpretation:'',limitations:'',ethicalStatus:'NOT_ASSESSED',ethicsReference:'',status:'PLANNED'
};
const statusLabel=(s:string)=>({PLANNED:'Planejada',IN_PROGRESS:'Em andamento',COMPLETED:'Concluída',UNDER_REVIEW:'Em revisão',ACCEPTED:'Evidência aceita na revisão',INCONCLUSIVE:'Inconclusiva',REJECTED:'Não aceita'} as Record<string,string>)[s]||s;
const ethicalLabel=(s:string)=>({NOT_ASSESSED:'Não avaliada',PENDING:'Pendente',APPROVED:'Aprovada',WAIVED:'Dispensada formalmente',NOT_APPLICABLE:'Não aplicável'} as Record<string,string>)[s]||s;
export default function ScientificValidation(){
 const [rows,setRows]=useState<Evidence[]>([]);const [form,setForm]=useState<any>(blank);const [filter,setFilter]=useState('ALL');
 const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const load=async()=>{setLoading(true);try{const r=await api.get('/api/science/validation-evidence');setRows(r.data.evidence||[]);}catch(e:any){setError(e?.response?.data?.error||'Não foi possível carregar as evidências.');}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const visible=useMemo(()=>rows.filter(x=>filter==='ALL'||x.instrument===filter),[rows,filter]);
 const counts=useMemo(()=>kinds.map(([key,label])=>({key,label,count:rows.filter(x=>x.evidenceType===key).length,accepted:rows.filter(x=>x.evidenceType===key&&x.status==='ACCEPTED').length})),[rows]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError('');setNotice('');try{await api.post('/api/science/validation-evidence',{...form,sampleSize:Number(form.sampleSize)});setForm({...blank,instrument:form.instrument,versionScope:form.versionScope});setNotice('Evidência registrada. O registro não altera o status científico do instrumento.');await load();}catch(e:any){setError(e?.response?.data?.error||'Não foi possível registrar a evidência.');}finally{setSaving(false);}};
 const review=async(id:string,status:string)=>{const reviewer=window.prompt('Nome do responsável pela revisão científica:');if(!reviewer?.trim())return;setSaving(true);setError('');try{await api.patch('/api/science/validation-evidence/'+id+'/status',{status,reviewer:reviewer.trim()});setNotice('Revisão registrada no histórico de auditoria.');await load();}catch(e:any){setError(e?.response?.data?.error||'Não foi possível atualizar a revisão.');}finally{setSaving(false);}};
 return <section className="admin-content validation-center">
  <header className="admin-section validation-hero"><div><span className="eyebrow">HSI · EVIDÊNCIA PSICOMÉTRICA</span><h3>Validação científica e homologação</h3><p>Registro estruturado das evidências necessárias para avaliar qualidade, validade e limites de interpretação dos instrumentos.</p></div><button className="secondary" onClick={()=>void load()} disabled={loading}>{loading?'Atualizando…':'Atualizar'}</button></header>
  <div className="validation-warning" role="note"><b>Status científico atual — ambos os instrumentos permanecem experimentais.</b><p>Não validados psicometricamente. Os resultados não devem ser usados como diagnóstico, norma populacional, certificação, seleção ou avaliação de aptidão. A conclusão de um estudo isolado não muda automaticamente este status.</p></div>
  {error&&<div className="notice error" role="alert">{error}</div>}{notice&&<div className="notice success" role="status">{notice}</div>}
  <div className="validation-instrument-grid">{['HSI-DOTH-P','HSI Visual Cognitivo'].map(name=><article key={name}><span className="validation-dot"/><div><b>{name}</b><small>Experimental · validação psicométrica pendente</small></div></article>)}</div>
  <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">MAPA DE EVIDÊNCIAS</span><h3>Cobertura dos estudos</h3></div><span className="muted">{rows.length} registro(s)</span></div><div className="validation-coverage-grid">{counts.map(x=><article key={x.key}><span>{x.label}</span><b>{x.count}</b><small>{x.accepted} aceita(s) em revisão interna</small></article>)}</div></div>
  <div className="validation-layout">
   <form className="admin-section validation-form" onSubmit={save}><span className="eyebrow">NOVO REGISTRO</span><h3>Registrar estudo ou evidência</h3><p>Cadastre métodos, população, amostra, resultados e limitações. Não inclua dados pessoais ou identificáveis de participantes.</p>
    <label>Instrumento<select value={form.instrument} onChange={e=>setForm({...form,instrument:e.target.value})}><option>HSI-DOTH-P</option><option>HSI Visual Cognitivo</option></select></label>
    <label>Tipo de evidência<select value={form.evidenceType} onChange={e=>setForm({...form,evidenceType:e.target.value})}>{kinds.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label>Título do estudo<input required minLength={5} maxLength={180} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
    <div className="validation-two"><label>Versão do instrumento<input required value={form.versionScope} onChange={e=>setForm({...form,versionScope:e.target.value})} placeholder="Ex.: 1.0"/></label><label>Código do estudo (opcional)<input value={form.studyCode} onChange={e=>setForm({...form,studyCode:e.target.value})}/></label></div>
    <label>Referência do protocolo (opcional)<input value={form.protocolReference} onChange={e=>setForm({...form,protocolReference:e.target.value})}/></label>
    <label>Método e desenho do estudo<textarea required minLength={10} value={form.methodDescription} onChange={e=>setForm({...form,methodDescription:e.target.value})} placeholder="Desenho, instrumentos externos, procedimentos, análises e pré-registro."/></label>
    <label>População-alvo<textarea required minLength={5} value={form.population} onChange={e=>setForm({...form,population:e.target.value})}/></label>
    <div className="validation-two"><label>Tamanho da amostra<input type="number" min="0" max="1000000" required value={form.sampleSize} onChange={e=>setForm({...form,sampleSize:e.target.value})}/></label><label>Descrição da amostra<input required value={form.sampleDescription} onChange={e=>setForm({...form,sampleDescription:e.target.value})} placeholder="Composição, recrutamento e representatividade"/></label></div>
    <label>Resultados observados<textarea required minLength={5} value={form.findings} onChange={e=>setForm({...form,findings:e.target.value})}/></label>
    <label>Interpretação e alcance das evidências<textarea required minLength={5} value={form.interpretation} onChange={e=>setForm({...form,interpretation:e.target.value})}/></label>
    <label>Limitações, vieses e incertezas<textarea required minLength={5} value={form.limitations} onChange={e=>setForm({...form,limitations:e.target.value})}/></label>
    <label>Situação da revisão ética<select value={form.ethicalStatus} onChange={e=>setForm({...form,ethicalStatus:e.target.value})}><option value="NOT_ASSESSED">Não avaliada</option><option value="PENDING">Pendente</option><option value="APPROVED">Aprovada</option><option value="WAIVED">Dispensada formalmente</option><option value="NOT_APPLICABLE">Não aplicável — justificar</option></select></label>
    <label>Referência/identificação ética (opcional)<input value={form.ethicsReference} onChange={e=>setForm({...form,ethicsReference:e.target.value})} placeholder="CEP/CONEP, parecer, CAAE ou justificativa formal"/></label>
    <label>Etapa da evidência<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="PLANNED">Planejada</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Concluída — aguardando revisão</option><option value="UNDER_REVIEW">Em revisão</option></select></label>
    <button className="primary" type="submit" disabled={saving}>{saving?'Salvando…':'Registrar evidência científica'}</button>
   </form>
   <div className="admin-section validation-register"><div className="section-heading"><div><span className="eyebrow">RASTREABILIDADE</span><h3>Registros e revisões</h3></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">Todos</option><option>HSI-DOTH-P</option><option>HSI Visual Cognitivo</option></select></div>
    {visible.length===0?<div className="chart-empty">Nenhuma evidência registrada para este filtro.</div>:visible.map(x=><article className="validation-record" key={x.id}><div className="validation-record-top"><b>{x.title}</b><span className={'science-status '+x.status.toLowerCase()}>{statusLabel(x.status)}</span></div><p>{x.instrument} · {kinds.find(k=>k[0]===x.evidenceType)?.[1]||x.evidenceType} · versão {x.versionScope}</p><div className="validation-record-facts"><span>Amostra: <b>{x.sampleSize}</b></span><span>Ética: <b>{ethicalLabel(x.ethicalStatus)}</b></span><span>Estudo: <b>{x.studyCode||'Não vinculado'}</b></span></div><details><summary>Ver método, resultados e limitações</summary><h4>Método</h4><p>{x.methodDescription}</p><h4>População e amostra</h4><p>{x.population} · {x.sampleDescription}</p><h4>Resultados</h4><p>{x.findings}</p><h4>Interpretação</h4><p>{x.interpretation}</p><h4>Limitações</h4><p>{x.limitations}</p><h4>Revisão ética</h4><p>{ethicalLabel(x.ethicalStatus)} · {x.ethicsReference||'Sem referência registrada'}</p>{x.reviewer&&<p>Revisado por {x.reviewer} em {x.reviewedAt?new Date(x.reviewedAt).toLocaleDateString('pt-BR'):'—'}</p>}</details>{!['ACCEPTED','INCONCLUSIVE','REJECTED'].includes(x.status)&&<div className="validation-review-actions"><button type="button" className="secondary" disabled={saving} onClick={()=>void review(x.id,'ACCEPTED')}>Aceitar evidência</button><button type="button" className="secondary" disabled={saving} onClick={()=>void review(x.id,'INCONCLUSIVE')}>Inconclusiva</button><button type="button" className="secondary" disabled={saving} onClick={()=>void review(x.id,'REJECTED')}>Não aceitar</button></div>}</article>)}
   </div>
  </div>
  <div className="validation-method-note"><b>Orientações para o plano de validação — não são critérios automáticos de aprovação</b><div className="validation-guidance-grid">
 <article><b>Conteúdo</b><p>Mapear cada item ao domínio teórico, documentar painel de especialistas, clareza, relevância e entrevistas cognitivas com o público-alvo.</p></article>
 <article><b>Confiabilidade e consistência</b><p>Selecionar estimativas conforme escala, dimensionalidade e desenho. Consistência interna só é interpretável quando a estrutura do construto a justifica; não aplicar alfa como selo universal.</p></article>
 <article><b>Construto e indicadores</b><p>Definir hipóteses antes da análise e examinar relações convergentes, discriminantes e estrutura interna quando apropriado. Validar cada indicador para sua finalidade.</p></article>
 <article><b>Estabilidade temporal</b><p>Planejar teste-reteste com intervalo justificado, estabilidade esperada e estatística compatível com o tipo de medida; considerar efeitos de prática e mudanças reais.</p></article>
 <article><b>Viés e equidade</b><p>Investigar funcionamento diferencial dos itens e invariância de medida entre grupos quando houver amostra e desenho adequados. Ausência de significância não prova ausência de viés.</p></article>
 <article><b>Tarefas cognitivas</b><p>Examinar dificuldade, discriminação, efeitos de teto/piso, tempo de resposta, acessibilidade, compreensão das instruções e efeitos de familiarização.</p></article>
 <article><b>Amostragem</b><p>Documentar população de referência, recrutamento, perdas, composição, tamanho justificado pelo plano analítico e limites de generalização. Não declarar representatividade sem desenho amostral que a sustente.</p></article>
 <article><b>Ética</b><p>Antes do recrutamento, avaliar a necessidade de submissão ao sistema CEP/CONEP e as demais exigências aplicáveis ao desenho concreto. Registrar parecer ou justificativa formal; o sistema não substitui a avaliação ética.</p></article>
 </div><p>Confiabilidade, validade e equidade são linhas de evidência distintas. Nenhum coeficiente isolado comprova validade global, e os critérios devem ser definidos previamente por especialistas conforme finalidade, população e desenho.</p></div>
 </section>;
}
