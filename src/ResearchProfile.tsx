import { useState, type FormEvent } from 'react';
import { api } from './lib/api';

const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const categories = ['NONE','ACC','A','B','C','D','E','AB','AC','AD','AE'];
type Profile = { birthDate:string|null; sex:string|null; licenseCategory?:string|null; city:string|null; state:string|null; institutionType:string|null; institutionName?:string|null; groupSector?:string|null; researchConsent?:boolean };
type Props = { user:any; onSaved:(user:any)=>void };
export default function ResearchProfile({user,onSaved}:Props){
 const profile=(user?.researchProfile||{}) as Profile;
 const complete=Boolean(profile.birthDate&&profile.sex&&profile.city&&profile.state&&profile.institutionType);
 const [editing,setEditing]=useState(!complete);
 const [birthDate,setBirthDate]=useState(profile.birthDate||'');
 const [sex,setSex]=useState(profile.sex||'');
 const [licenseCategory,setLicenseCategory]=useState(profile.licenseCategory||'');
 const [city,setCity]=useState(profile.city||'');
 const [state,setState]=useState(profile.state||'');
 const [institutionType,setInstitutionType]=useState(profile.institutionType||'INDEPENDENT');
 const [institutionName,setInstitutionName]=useState(profile.institutionName||'');
 const [groupSector,setGroupSector]=useState(profile.groupSector||'');
 const [researchConsent,setResearchConsent]=useState(Boolean(profile.researchConsent));
 const [privacyAccepted,setPrivacyAccepted]=useState(complete);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [feedback,setFeedback]=useState('');
 const save=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');setFeedback('');
  if(!privacyAccepted){setError('É necessário confirmar a leitura do aviso de privacidade.');setBusy(false);return;}
  try{
   const response=await api.patch('/api/auth/research-profile',{birthDate,sex,licenseCategory:licenseCategory||null,city:city.trim(),state,institutionType,institutionName:institutionType==='INDEPENDENT'?null:(institutionName.trim()||null),groupSector:institutionType==='INDEPENDENT'?null:(groupSector.trim()||null),privacyNoticeVersion:'ENAT-PRIVACY-1.0',researchConsent});
   onSaved(response.data.user);setEditing(false);setFeedback('Cadastro salvo. Os dados serão reutilizados nos dois instrumentos.');
  }catch(err:any){setError(err?.response?.data?.error||'Não foi possível salvar o cadastro.');}
  finally{setBusy(false);}
 };
 if(complete&&!editing){
  return <section className="dothp-participant-data">
   <div className="dothp-participant-heading"><span className="eyebrow">IDENTIFICAÇÃO COMPARTILHADA</span><h2>Cadastro do respondente</h2><p>Os dados abaixo identificam esta participação e serão reutilizados no HSI Visual Cognitivo e no HSI-DOTH-P.</p></div>
   <div className="research-profile-summary"><span><strong>Nascimento</strong>{new Date(profile.birthDate+'T00:00:00').toLocaleDateString('pt-BR')}</span><span><strong>Sexo</strong>{profile.sex}</span><span><strong>CNH</strong>{profile.licenseCategory==='NONE'?'Não possui':profile.licenseCategory||'Não informado'}</span><span><strong>Município/UF</strong>{profile.city} / {profile.state}</span><span><strong>Vínculo</strong>{profile.institutionType==='INDEPENDENT'?'Independente / sem vínculo':profile.institutionType}</span><span><strong>Instituição</strong>{profile.institutionName||'Não informada'}</span></div>
   {!user?.publicAccess&&<button type="button" className="secondary research-profile-edit" onClick={()=>setEditing(true)}>Atualizar cadastro</button>}
   {feedback&&<p className="dothp-profile-privacy" role="status">{feedback}</p>}
  </section>;
 }
 return <section className="dothp-participant-data" aria-labelledby="research-profile-title">
  <div className="dothp-participant-heading"><span className="eyebrow">IDENTIFICAÇÃO PARA PESQUISA</span><h2 id="research-profile-title">Dados do respondente</h2><p>Preencha uma única vez. Não é necessário informar nome, e-mail ou criar um cadastro institucional. O nome da instituição é opcional.</p></div>
  {error&&<div className="notice error" role="alert">{error}</div>}
  <form onSubmit={save}>
   <div className="dothp-profile-grid">
    <label>Data de nascimento<input type="date" required max={new Date().toISOString().slice(0,10)} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
    <label>Sexo<select required value={sex} onChange={e=>setSex(e.target.value)}><option value="">Selecione</option><option value="M">M — Masculino</option><option value="F">F — Feminino</option></select></label>
    <label>Categoria de habilitação <small>(opcional)</small><select value={licenseCategory} onChange={e=>setLicenseCategory(e.target.value)}><option value="">Não informar</option>{categories.map(c=><option key={c} value={c}>{c==='NONE'?'Não possui CNH':c}</option>)}</select></label>
    <label>Município<input required maxLength={100} value={city} onChange={e=>setCity(e.target.value)} placeholder="Digite seu município"/></label>
    <label>UF<select required value={state} onChange={e=>setState(e.target.value)}><option value="">Selecione</option>{states.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label>
    <label>Tipo de instituição / vínculo<select required value={institutionType} onChange={e=>{setInstitutionType(e.target.value);if(e.target.value==='INDEPENDENT'){setInstitutionName('');setGroupSector('');}}}><option value="INDEPENDENT">Independente / sem vínculo</option><option value="SCHOOL">Escola</option><option value="COMPANY">Empresa</option><option value="PUBLIC_AGENCY">Órgão público</option><option value="UNIVERSITY">Universidade</option><option value="RESEARCH_CENTER">Centro de pesquisa</option><option value="COMMUNITY">Comunidade / organização social</option><option value="OTHER">Outro</option></select></label>
    {institutionType!=='INDEPENDENT'&&<label>Nome da instituição <small>(opcional)</small><input maxLength={180} value={institutionName} onChange={e=>setInstitutionName(e.target.value)} placeholder="Nome da escola, empresa ou instituição"/></label>}
    {institutionType!=='INDEPENDENT'&&<label>Grupo ou setor <small>(opcional)</small><input maxLength={120} value={groupSector} onChange={e=>setGroupSector(e.target.value)} placeholder="Turma, departamento, setor…"/></label>}
   </div>
   <details className="public-privacy-details"><summary>Ler aviso de privacidade e uso dos dados</summary><div>
    <p><strong>Responsável pelo projeto:</strong> ENAT — Ensino Neuroeducacional Aplicado ao Trânsito. Contato: enat.neuroeducacao@gmail.com.</p>
    <p><strong>Dados coletados:</strong> data de nascimento, sexo, município, UF, categoria de habilitação (opcional), tipo e nome da instituição (opcional), grupo/setor (opcional), respostas e informações técnicas da aplicação.</p>
    <p><strong>Finalidade:</strong> registrar e contextualizar suas aplicações, manter histórico e produzir indicadores. O uso das respostas em pesquisas ENAT é opcional.</p>
    <p><strong>Resultados:</strong> análises coletivas devem ser agregadas e suprimir recortes com menos de cinco participantes. Os instrumentos são experimentais e não constituem diagnóstico, avaliação clínica ou aptidão para dirigir.</p>
    <p className="public-privacy-review">Aviso preliminar: os prazos de retenção, a identificação jurídica completa do controlador e os procedimentos de atendimento devem ser revisados antes da abertura pública definitiva.</p>
   </div></details>
   <div className="public-consent-block">
    <label className="public-check"><input type="checkbox" checked={privacyAccepted} onChange={e=>setPrivacyAccepted(e.target.checked)}/><span><strong>Li o aviso de privacidade e concordo com o tratamento dos dados necessários para registrar minha participação.</strong><small>Esta confirmação é necessária para continuar.</small></span></label>
    <label className="public-check optional"><input type="checkbox" checked={researchConsent} onChange={e=>setResearchConsent(e.target.checked)}/><span><strong>Autorizo, opcionalmente, o uso das minhas respostas em pesquisas ENAT.</strong><small>Posso realizar os instrumentos sem autorizar o uso das respostas em pesquisas.</small></span></label>
   </div>
   <div className="dothp-actions"><button className="primary" type="submit" disabled={busy||!privacyAccepted}>{busy?'Salvando cadastro…':'Salvar cadastro e continuar'}</button></div>
  </form>
 </section>;
}
