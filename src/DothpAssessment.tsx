import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';
import { getDothpContextHint, getDothpContextQuestion } from './dothp-contexts';

const defaultDimensions = [
 {id:'decision',name:'Decisão',subtitle:'Análise de alternativas, consequências e escolhas conscientes'},
 {id:'organization',name:'Organização',subtitle:'Planejamento, prioridades, consistência e gestão de recursos'},
 {id:'time',name:'Tempo',subtitle:'Percepção temporal, pontualidade, ritmo e equilíbrio de demandas'},
 {id:'humanization',name:'Humanização',subtitle:'Empatia, respeito, cooperação e consideração pelo impacto sobre outras pessoas'},
 {id:'psychocomportamental',name:'Psicocomportamental',subtitle:'Autopercepção, regulação emocional, padrões de reação e flexibilidade'}
];

const defaultItems = [
 ['decision','Quando preciso tomar uma decisão importante, procuro considerar mais de uma alternativa.'],
 ['decision','Antes de agir, costumo avaliar possíveis consequências para mim e para outras pessoas.'],
 ['decision','Consigo rever uma escolha quando surgem informações relevantes que eu não tinha considerado.'],
 ['decision','Em situações de pressão, ajo imediatamente sem avaliar o que pode acontecer.'],
 ['decision','Quando tenho dúvidas importantes, busco informações ou apoio antes de decidir.'],
 ['organization','Costumo definir prioridades antes de iniciar várias tarefas.'],
 ['organization','Mantenho compromissos e informações importantes organizados de modo que consiga recuperá-los.'],
 ['organization','Quando um plano deixa de funcionar, procuro reorganizar as etapas necessárias.'],
 ['organization','Frequentemente começo atividades sem verificar os recursos ou o tempo de que vou precisar.'],
 ['organization','Costumo acompanhar o que foi concluído e o que ainda precisa ser feito.'],
 ['time','Consigo estimar de forma razoável quanto tempo minhas atividades costumam exigir.'],
 ['time','Procuro organizar meus compromissos para evitar atrasos que poderiam ser prevenidos.'],
 ['time','Quando percebo que não conseguirei cumprir um prazo, aviso os envolvidos com antecedência.'],
 ['time','Deixo tarefas importantes para o último momento mesmo quando poderia iniciá-las antes.'],
 ['time','Procuro equilibrar demandas, pausas e descanso ao longo da rotina.'],
 ['humanization','Procuro ouvir o ponto de vista de alguém mesmo quando discordo dessa pessoa.'],
 ['humanization','Considero como minhas atitudes podem afetar o bem-estar e os direitos de outras pessoas.'],
 ['humanization','Em situações de conflito, tento compreender as necessidades envolvidas antes de responder.'],
 ['humanization','Quando uma situação não me afeta diretamente, considero desnecessário me preocupar com suas consequências para os outros.'],
 ['humanization','Procuro agir com respeito também quando estou frustrado ou sob pressão.'],
 ['psychocomportamental','Consigo perceber sinais de que minhas emoções estão influenciando meu comportamento.'],
 ['psychocomportamental','Quando fico frustrado, consigo utilizar estratégias para evitar uma reação impulsiva.'],
 ['psychocomportamental','Reconheço situações recorrentes que costumam desencadear reações semelhantes em mim.'],
 ['psychocomportamental','Tenho dificuldade em mudar minha reação mesmo quando percebo que ela não está ajudando.'],
 ['psychocomportamental','Depois de uma situação difícil, costumo refletir sobre o que senti e como agi.']
] as const;

const defaultReverse = new Set([3,8,13,18,23]);
const scale = ['Discordo totalmente','Discordo parcialmente','Nem concordo nem discordo','Concordo parcialmente','Concordo totalmente'];

type ParticipantData = {
 birthDate:string; sex:'M'|'F'; licenseCategory?:string|null; city:string; state:string;
 institutionType:string; institutionName?:string|null; groupSector?:string|null; researchConsent?:boolean;
};
type Props = { participantData?:ParticipantData|null };
export default function DothpAssessment({participantData=null}:Props={}){
 const [context,setContext]=useState('cotidiano');
 const [dimensions,setDimensions]=useState<any[]>(defaultDimensions);
 const [items,setItems]=useState<Array<[string,string]>>(defaultItems.map(([a,b])=>[a,b] as [string,string]));
 const [reverse,setReverse]=useState<Set<number>>(defaultReverse);
 const [scoringCriteria,setScoringCriteria]=useState<any>({scale:{min:1,max:5},scoreRange:{min:0,max:100},bands:{low:{maxExclusive:34},high:{min:67}}});
 const [instrumentVersion,setInstrumentVersion]=useState('1.0');
 const [studyCode,setStudyCode]=useState('');
 const [studyGroupCode,setStudyGroupCode]=useState('');
 const [definitionLoading,setDefinitionLoading]=useState(true);
 const [answers,setAnswers]=useState<Record<number,number>>({});
 const [showResult,setShowResult]=useState(false);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState('');
 const [saved,setSaved]=useState(false);
 const [researchConsent,setResearchConsent]=useState(Boolean(participantData?.researchConsent));
 const [birthDate,setBirthDate]=useState(participantData?.birthDate||'');
 const [sex,setSex]=useState(participantData?.sex||'');
 const [licenseCategory,setLicenseCategory]=useState(participantData?.licenseCategory||'');
 const [city,setCity]=useState(participantData?.city||'');
 const [state,setState]=useState(participantData?.state||'');
 const [institutionType,setInstitutionType]=useState(participantData?.institutionType||'INDEPENDENT');
 const [institutionName,setInstitutionName]=useState(participantData?.institutionName||'');
 const [groupSector,setGroupSector]=useState(participantData?.groupSector||'');
 const [profileError,setProfileError]=useState('');
 useEffect(()=>{let mounted=true;api.get('/api/instrument-definition').then(r=>{if(!mounted)return;const data=r.data;setInstrumentVersion(data.version||'1.0');setItems((data.questions||[]).map((q:any)=>[String(q.dimension||q.dimensionId),String(q.prompt||q.statement||'')]));if(data.scoringCriteria?.dimensions)setDimensions(data.scoringCriteria.dimensions);setScoringCriteria(data.scoringCriteria||{});setReverse(new Set((data.scoringCriteria?.reverseItems||[]).map((n:number)=>Number(n)-1)));}).catch(()=>{}).finally(()=>{if(mounted)setDefinitionLoading(false);});return()=>{mounted=false;};},[]);
 const profileComplete=participantData?true:Boolean(birthDate&&sex&&city.trim()&&state.trim().length===2&&institutionType);
 const complete=Object.keys(answers).length===items.length;
 const results=useMemo(()=>dimensions.map(d=>{
   const indices=items.map((q,i)=>q[0]===d.id?i:-1).filter(i=>i>=0);
   const values=indices.map(i=>reverse.has(i)?6-answers[i]:answers[i]).filter(v=>Number.isFinite(v));
   const mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
   const min=Number(scoringCriteria.scale?.min??1),max=Number(scoringCriteria.scale?.max??5),scoreMin=Number(scoringCriteria.scoreRange?.min??0),scoreMax=Number(scoringCriteria.scoreRange?.max??100);
   return {...d,mean,index:values.length?Math.round(scoreMin+((mean-min)/(max-min))*(scoreMax-scoreMin)):0,answered:values.length};
 }),[answers,items,dimensions,reverse,scoringCriteria]);
 const setAnswer=(i:number,v:number)=>{setAnswers(prev=>({...prev,[i]:v}));setShowResult(false)};
 const reset=()=>{setAnswers({});setShowResult(false);setSaveError('');setSaved(false);setResearchConsent(false);setProfileError('')};
 const saveAndShowResult=async()=>{
  if(!complete||saving)return;
  if(!profileComplete){setProfileError('Preencha data de nascimento, sexo, município, UF e tipo de vínculo para continuar.');return;}
  setSaving(true);setSaveError('');setProfileError('');
  try{
   await api.post('/api/instrument-results',{id:crypto.randomUUID(),instrument:'HSI-DOTH-P',context,contextVersion:'1.1',instrumentVersion,...((participantData?.researchConsent??researchConsent)?{consentVersion:'ENAT-RESEARCH-1.0'}:{}),participantData:{birthDate:participantData?.birthDate||birthDate,sex:participantData?.sex||sex,licenseCategory:participantData?.licenseCategory??(licenseCategory||null),city:participantData?.city||city.trim(),state:participantData?.state||state.trim().toUpperCase(),country:'BR',institutionType:participantData?.institutionType||institutionType,institutionName:participantData?.institutionName??(institutionName.trim()||null),groupSector:participantData?.groupSector??(groupSector.trim()||null)},answers:items.map((_,i)=>answers[i]),...(studyCode.trim()?{studyCode:studyCode.trim().toUpperCase(),...(studyGroupCode.trim()?{studyGroupCode:studyGroupCode.trim().toUpperCase()}:{})}:{})});
   setSaved(true);setShowResult(true);
  }catch(error:any){setSaveError(error?.response?.data?.error||'Não foi possível registrar suas respostas. Verifique a conexão e tente novamente.');}
  finally{setSaving(false);}
 };
 return <section className="dothp-workspace">
  <header className="dothp-hero"><span className="eyebrow">INSTRUMENTO COMPORTAMENTAL · HSI-DOTH-P</span><h1>Comportamento em diferentes contextos da vida</h1><p>Uma autoavaliação estruturada sobre decisões, organização, tempo, humanização e padrões psicocomportamentais. Não é limitada ao trânsito.</p><div className="dothp-tags"><span>25 afirmações</span><span>5 dimensões</span><span>Escala Likert de 1 a 5</span><span>Versão {instrumentVersion}</span></div></header>
  {definitionLoading?<div className="notice">Carregando a versão vigente do instrumento…</div>:!showResult?<>{!participantData && <section className="dothp-participant-data" aria-labelledby="dothp-participant-title">
   <div className="dothp-participant-heading"><span className="eyebrow">IDENTIFICAÇÃO PARA PESQUISA</span><h2 id="dothp-participant-title">Dados do respondente</h2><p>Essas informações permitem análises territoriais e sociodemográficas. O nome da instituição é opcional e não é necessário ter cadastro prévio.</p></div>
   <div className="dothp-profile-grid">
    <label>Data de nascimento<input type="date" required max={new Date().toISOString().slice(0,10)} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
    <label>Sexo<select required value={sex} onChange={e=>setSex(e.target.value)}><option value="">Selecione</option><option value="M">M — Masculino</option><option value="F">F — Feminino</option></select></label>
    <label>Categoria de habilitação <small>(opcional)</small><select value={licenseCategory} onChange={e=>setLicenseCategory(e.target.value)}><option value="">Não informar</option><option value="NONE">Não possui CNH</option><option value="ACC">ACC</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option><option value="AB">AB</option><option value="AC">AC</option><option value="AD">AD</option><option value="AE">AE</option></select></label>
    <label>Município<input required maxLength={100} value={city} onChange={e=>setCity(e.target.value)} placeholder="Digite seu município"/></label>
    <label>UF<select required value={state} onChange={e=>setState(e.target.value)}><option value="">Selecione</option>{['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label>
    <label>Tipo de instituição / vínculo<select required value={institutionType} onChange={e=>setInstitutionType(e.target.value)}><option value="INDEPENDENT">Independente / sem vínculo</option><option value="SCHOOL">Escola</option><option value="COMPANY">Empresa</option><option value="PUBLIC_AGENCY">Órgão público</option><option value="UNIVERSITY">Universidade</option><option value="RESEARCH_CENTER">Centro de pesquisa</option><option value="COMMUNITY">Comunidade / organização social</option><option value="OTHER">Outro</option></select></label>
    {institutionType!=='INDEPENDENT'&&<label>Nome da instituição <small>(opcional)</small><input maxLength={180} value={institutionName} onChange={e=>setInstitutionName(e.target.value)} placeholder="Nome da escola, empresa ou instituição"/></label>}
    {institutionType!=='INDEPENDENT'&&<label>Grupo ou setor <small>(opcional)</small><input maxLength={120} value={groupSector} onChange={e=>setGroupSector(e.target.value)} placeholder="Turma, departamento, setor…"/></label>}
   </div>
   {profileError&&<div className="dothp-save-error" role="alert">{profileError}</div>}
   <p className="dothp-profile-privacy">Os dados são utilizados para contextualizar esta aplicação e apoiar análises autorizadas. A participação em pesquisas ENAT continua opcional, mediante consentimento específico; relatórios coletivos suprimem recortes com menos de cinco participantes e não exibem dados pessoais.</p>
  </section>}{participantData && <section className="dothp-participant-data"><div className="dothp-participant-heading"><span className="eyebrow">IDENTIFICAÇÃO COMPARTILHADA</span><h2>Dados vinculados ao respondente</h2><p>{participantData.city} · {participantData.state} · {participantData.institutionType==="INDEPENDENT"?"Independente / sem vínculo":(participantData.institutionName||"Vínculo institucional")}. A identificação foi informada uma única vez e será reutilizada nos instrumentos.</p></div></section>}<div className="dothp-context"><label htmlFor="dothp-study-code">Código do estudo (se recebeu um código de pesquisa)</label><input id="dothp-study-code" value={studyCode} onChange={e=>setStudyCode(e.target.value.toUpperCase())} placeholder="Opcional · código fornecido pela equipe de pesquisa"/><label htmlFor="dothp-study-group">Grupo de pesquisa (opcional)</label><input id="dothp-study-group" value={studyGroupCode} onChange={e=>setStudyGroupCode(e.target.value.toUpperCase())} placeholder="Código do grupo informado pelo pesquisador"/><label htmlFor="dothp-context">Contexto que deseja considerar ao responder</label><select id="dothp-context" value={context} onChange={e=>setContext(e.target.value)}><option value="cotidiano">Vida cotidiana e relações pessoais</option><option value="trabalho">Trabalho e ambiente profissional</option><option value="educacao">Estudos e aprendizagem</option><option value="familia">Família e convivência</option><option value="social">Comunidade e participação social</option><option value="digital">Ambientes digitais</option><option value="transito">Mobilidade e trânsito</option><option value="integrado">Considerar diferentes contextos</option></select><p>Responda pensando em como costuma agir, e não em como acredita que deveria agir. Considere experiências recentes e representativas.</p></div>
  {saveError&&<div className="dothp-save-error" role="alert">{saveError}</div>}
  <div className="dothp-progress"><div><strong>{Object.keys(answers).length} de 25 respondidas</strong><span>{Math.round(Object.keys(answers).length/25*100)}%</span></div><div className="dothp-track"><i style={{width:(Object.keys(answers).length/25*100)+'%'}}/></div></div>
  {dimensions.map((d,di)=><section className="dothp-dimension" key={d.id}><div className="dothp-dimension-head"><span>DIMENSÃO 0{di+1}</span><h2>{d.name}</h2><p>{d.subtitle}</p><p className="dothp-context-guidance"><strong>Foco contextual:</strong> {getDothpContextHint(context,d.id)}</p></div>
  {items.map((q,i)=>q[0]===d.id?<article className="dothp-question" key={i}><div className="dothp-question-title"><b>{String(i+1).padStart(2,'0')}</b><p>{getDothpContextQuestion(context,q[0],items.slice(0,i).filter(item=>item[0]===q[0]).length,q[1])}</p></div><div className="dothp-options">{scale.map((label,j)=><label className={answers[i]===j+1?'chosen':''} key={j}><input type="radio" name={'dothp-'+i} checked={answers[i]===j+1} onChange={()=>setAnswer(i,j+1)}/><span>{j+1}</span><small>{label}</small></label>)}</div></article>:null)}
  </section>)}
  {!participantData ? <label className="dothp-research-consent"><input type="checkbox" checked={researchConsent} onChange={e=>setResearchConsent(e.target.checked)}/><span><strong>Participação voluntária em pesquisas ENAT (opcional).</strong> Autorizo que minhas respostas sejam utilizadas em análises estatísticas e pesquisas, exclusivamente em formato agregado e anonimizado. Posso concluir a avaliação sem marcar esta opção.</span></label> : <p className="dothp-profile-privacy">{participantData.researchConsent?'O respondente autorizou o uso das respostas em pesquisas ENAT agregadas.':'O respondente não autorizou o uso das respostas em pesquisas ENAT; a aplicação será registrada sem inclusão nos agregados de pesquisa.'}</p>}<div className="dothp-actions"><button className="secondary" onClick={reset}>Limpar respostas</button><button className="primary" disabled={!complete||!profileComplete||saving} onClick={saveAndShowResult}>{saving?'Registrando respostas…':'Calcular perfil dimensional e salvar'}</button></div>
  </>:<><section className="dothp-results"><span className="eyebrow">DEVOLUTIVA DESCRITIVA · {context.toUpperCase()}</span>{saved&&<div className="dothp-saved-notice">Avaliação registrada no histórico da sua participação.</div>}<h2>Panorama por dimensão</h2><p>Os resultados abaixo representam somente suas respostas nesta aplicação. Não existe nota geral nem classificação de aprovação.</p>
  {results.map(d=><article className="dothp-result" key={d.id}><div><h3>{d.name}</h3><strong>{d.index}/100</strong></div><div className="dothp-track"><i style={{width:d.index+'%'}}/></div><small>Média {d.mean.toFixed(2).replace('.',',')} de 5 · {d.answered} afirmações</small><p>{d.index<34?'Nesta aplicação, as respostas indicam um espaço possível para reflexão e desenvolvimento nesta dimensão.':d.index<67?'Nesta aplicação, as respostas sugerem aspectos relativamente presentes e outros que podem ser fortalecidos.':'Nesta aplicação, as respostas indicam maior frequência de comportamentos associados a esta dimensão.'}</p></article>)}
  <div className="dothp-notice"><strong>Limites metodológicos:</strong> instrumento em versão piloto, sem validação psicométrica estabelecida. As faixas são apenas descrições internas da aplicação, não normas populacionais. Não constitui diagnóstico, avaliação clínica, seleção profissional, avaliação de personalidade, aptidão ou decisão automatizada sobre pessoas. Um resultado isolado não define um indivíduo.</div>
  <div className="dothp-actions"><button className="secondary" onClick={()=>setShowResult(false)}>Revisar respostas</button><button className="primary" onClick={reset}>Nova aplicação</button></div></section></>}
 </section>
}
