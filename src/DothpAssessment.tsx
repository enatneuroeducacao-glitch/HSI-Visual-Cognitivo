import { useMemo, useState } from 'react';
import { api } from './lib/api';
import { getDothpContextHint } from './dothp-contexts';

const dimensions = [
 {id:'decision',name:'Decisão',subtitle:'Análise de alternativas, consequências e escolhas conscientes'},
 {id:'organization',name:'Organização',subtitle:'Planejamento, prioridades, consistência e gestão de recursos'},
 {id:'time',name:'Tempo',subtitle:'Percepção temporal, pontualidade, ritmo e equilíbrio de demandas'},
 {id:'humanization',name:'Humanização',subtitle:'Empatia, respeito, cooperação e consideração pelo impacto sobre outras pessoas'},
 {id:'psychocomportamental',name:'Psicocomportamental',subtitle:'Autopercepção, regulação emocional, padrões de reação e flexibilidade'}
];

const items = [
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

const reverse = new Set([3,8,13,18,23]);
const scale = ['Discordo totalmente','Discordo parcialmente','Nem concordo nem discordo','Concordo parcialmente','Concordo totalmente'];

export default function DothpAssessment(){
 const [context,setContext]=useState('cotidiano');
 const [answers,setAnswers]=useState<Record<number,number>>({});
 const [showResult,setShowResult]=useState(false);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState('');
 const [saved,setSaved]=useState(false);
 const [researchConsent,setResearchConsent]=useState(false);
 const complete=Object.keys(answers).length===25;
 const results=useMemo(()=>dimensions.map(d=>{
   const indices=items.map((q,i)=>q[0]===d.id?i:-1).filter(i=>i>=0);
   const values=indices.map(i=>reverse.has(i)?6-answers[i]:answers[i]).filter(v=>Number.isFinite(v));
   const mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
   return {...d,mean,index:Math.round((mean-1)*25),answered:values.length};
 }),[answers]);
 const setAnswer=(i:number,v:number)=>{setAnswers(prev=>({...prev,[i]:v}));setShowResult(false)};
 const reset=()=>{setAnswers({});setShowResult(false);setSaveError('');setSaved(false)};
 const saveAndShowResult=async()=>{
  if(!complete||saving)return;
  setSaving(true);setSaveError('');
  try{
   await api.post('/api/instrument-results',{id:crypto.randomUUID(),instrument:'HSI-DOTH-P',context,contextVersion:'1.1',...(researchConsent?{consentVersion:'ENAT-RESEARCH-1.0'}:{}),answers:items.map((_,i)=>answers[i])});
   setSaved(true);setShowResult(true);
  }catch(error:any){setSaveError(error?.response?.data?.error||'Não foi possível registrar suas respostas. Verifique a conexão e tente novamente.');}
  finally{setSaving(false);}
 };
 return <section className="dothp-workspace">
  <header className="dothp-hero"><span className="eyebrow">INSTRUMENTO COMPORTAMENTAL · HSI-DOTH-P</span><h1>Comportamento em diferentes contextos da vida</h1><p>Uma autoavaliação estruturada sobre decisões, organização, tempo, humanização e padrões psicocomportamentais. Não é limitada ao trânsito.</p><div className="dothp-tags"><span>25 afirmações</span><span>5 dimensões</span><span>Escala Likert de 1 a 5</span><span>Versão piloto</span></div></header>
  {!showResult?<><div className="dothp-context"><label htmlFor="dothp-context">Contexto que deseja considerar ao responder</label><select id="dothp-context" value={context} onChange={e=>setContext(e.target.value)}><option value="cotidiano">Vida cotidiana e relações pessoais</option><option value="trabalho">Trabalho e ambiente profissional</option><option value="educacao">Estudos e aprendizagem</option><option value="familia">Família e convivência</option><option value="social">Comunidade e participação social</option><option value="digital">Ambientes digitais</option><option value="transito">Mobilidade e trânsito</option><option value="integrado">Considerar diferentes contextos</option></select><p>Responda pensando em como costuma agir, e não em como acredita que deveria agir. Considere experiências recentes e representativas.</p></div>
  {saveError&&<div className="dothp-save-error" role="alert">{saveError}</div>}
  <div className="dothp-progress"><div><strong>{Object.keys(answers).length} de 25 respondidas</strong><span>{Math.round(Object.keys(answers).length/25*100)}%</span></div><div className="dothp-track"><i style={{width:(Object.keys(answers).length/25*100)+'%'}}/></div></div>
  {dimensions.map((d,di)=><section className="dothp-dimension" key={d.id}><div className="dothp-dimension-head"><span>DIMENSÃO 0{di+1}</span><h2>{d.name}</h2><p>{d.subtitle}</p><p className="dothp-context-guidance"><strong>Foco contextual:</strong> {getDothpContextHint(context,d.id)}</p></div>
  {items.map((q,i)=>q[0]===d.id?<article className="dothp-question" key={i}><div className="dothp-question-title"><b>{String(i+1).padStart(2,'0')}</b><p>{q[1]}</p></div><div className="dothp-options">{scale.map((label,j)=><label className={answers[i]===j+1?'chosen':''} key={j}><input type="radio" name={'dothp-'+i} checked={answers[i]===j+1} onChange={()=>setAnswer(i,j+1)}/><span>{j+1}</span><small>{label}</small></label>)}</div></article>:null)}
  </section>)}
  <label className="dothp-research-consent"><input type="checkbox" checked={researchConsent} onChange={e=>setResearchConsent(e.target.checked)}/><span><strong>Participação voluntária em pesquisas ENAT (opcional).</strong> Autorizo que minhas respostas sejam utilizadas em análises estatísticas e pesquisas, exclusivamente em formato agregado e anonimizado. Posso concluir a avaliação sem marcar esta opção.</span></label><div className="dothp-actions"><button className="secondary" onClick={reset}>Limpar respostas</button><button className="primary" disabled={!complete||saving} onClick={saveAndShowResult}>{saving?'Registrando respostas…':'Calcular perfil dimensional e salvar'}</button></div>
  </>:<><section className="dothp-results"><span className="eyebrow">DEVOLUTIVA DESCRITIVA · {context.toUpperCase()}</span>{saved&&<div className="dothp-saved-notice">Avaliação registrada no histórico da sua conta.</div>}<h2>Panorama por dimensão</h2><p>Os resultados abaixo representam somente suas respostas nesta aplicação. Não existe nota geral nem classificação de aprovação.</p>
  {results.map(d=><article className="dothp-result" key={d.id}><div><h3>{d.name}</h3><strong>{d.index}/100</strong></div><div className="dothp-track"><i style={{width:d.index+'%'}}/></div><small>Média {d.mean.toFixed(2).replace('.',',')} de 5 · {d.answered} afirmações</small><p>{d.index<34?'Nesta aplicação, as respostas indicam um espaço possível para reflexão e desenvolvimento nesta dimensão.':d.index<67?'Nesta aplicação, as respostas sugerem aspectos relativamente presentes e outros que podem ser fortalecidos.':'Nesta aplicação, as respostas indicam maior frequência de comportamentos associados a esta dimensão.'}</p></article>)}
  <div className="dothp-notice"><strong>Limites metodológicos:</strong> instrumento em versão piloto, sem validação psicométrica estabelecida. As faixas são apenas descrições internas da aplicação, não normas populacionais. Não constitui diagnóstico, avaliação clínica, seleção profissional, avaliação de personalidade, aptidão ou decisão automatizada sobre pessoas. Um resultado isolado não define um indivíduo.</div>
  <div className="dothp-actions"><button className="secondary" onClick={()=>setShowResult(false)}>Revisar respostas</button><button className="primary" onClick={reset}>Nova aplicação</button></div></section></>}
 </section>
}
