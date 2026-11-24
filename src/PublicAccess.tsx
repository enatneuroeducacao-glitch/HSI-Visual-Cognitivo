import { useState, type FormEvent } from 'react';
import { auth, publicAccess } from './lib/api';

const logoUrl = new URL('../assets/hsi-visual-cognitivo.webp', import.meta.url).href;
const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

type Props = { onAuthenticated: (user: any) => void };
type AccessMode = 'login' | 'register' | 'public' | 'resume' | 'created';

export default function PublicAccess({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<AccessMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [licenseCategory, setLicenseCategory] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [institutionType, setInstitutionType] = useState('INDEPENDENT');
  const [institutionName, setInstitutionName] = useState('');
  const [groupSector, setGroupSector] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [researchConsent, setResearchConsent] = useState(false);
  const [participantCode, setParticipantCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const switchMode = (next: AccessMode) => {
    setMode(next); setError(''); setMessage(''); setPassword(''); setCopied(false);
  };

  const handleAccount = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'register') {
        await auth.register(name, email, password);
      } else {
        await auth.signInWithPassword(email, password);
      }
      const current = await auth.getUser();
      if (!current) throw new Error('Não foi possível recuperar a sessão autenticada.');
      onAuthenticated(current);
    } catch (err: any) {
      setError(err?.response?.data?.error || (mode === 'register' ? 'Não foi possível criar sua conta.' : 'Não foi possível autenticar. Confira suas credenciais.'));
    } finally { setBusy(false); }
  };

  const requestReset = async () => {
    const target = email.trim();
    if (!target) { setError('Informe seu e-mail para solicitar a redefinição.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await auth.requestPasswordReset(target);
      setMessage(response.data.message || 'Se o endereço estiver cadastrado, você receberá instruções para redefinir a senha.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Não foi possível solicitar a redefinição.');
    } finally { setBusy(false); }
  };

  const handlePublicRegistration = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    if (!privacyAccepted) { setError('É necessário confirmar a leitura do aviso de privacidade para continuar.'); setBusy(false); return; }
    try {
      const response = await publicAccess.register({
        birthDate, sex, licenseCategory: licenseCategory || null, city: city.trim(), state,
        institutionType, institutionName: institutionName.trim() || null,
        groupSector: groupSector.trim() || null, privacyNoticeVersion: 'ENAT-PRIVACY-1.1',
        researchConsent
      });
      setCreatedCode(response.participantCode);
      setPendingUser(response.user);
      setMode('created');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Não foi possível iniciar sua participação. Confira os dados e tente novamente.');
    } finally { setBusy(false); }
  };

  const handleResume = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await publicAccess.resume(participantCode.trim());
      onAuthenticated(response.user);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Não foi possível localizar sua participação.');
    } finally { setBusy(false); }
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(createdCode); setCopied(true); }
    catch { setError('Não foi possível copiar automaticamente. Selecione e copie o código exibido.'); }
  };

  return (
    <main className="login-screen public-access-screen">
      <div className="login-card public-access-card">
        <img className="login-brand-logo" src={logoUrl} alt="HSI Visual Cognitivo" />
        <p className="eyebrow">ENAT · PESQUISA E DESENVOLVIMENTO</p>
        <h1>HSI Visual Cognitivo</h1>
        <p className="muted">Plataforma de instrumentos complementares para exploração de habilidades cognitivas e padrões comportamentais.</p>

        {error && <div className="notice error" role="alert">{error}</div>}
        {message && <div className="notice success" role="status">{message}</div>}

        {mode === 'created' && (
          <section className="public-code-panel">
            <span className="eyebrow">IDENTIFICAÇÃO PERSISTENTE</span>
            <h2>Sua participação foi criada</h2>
            <p>Este é seu código privado. Ele permite retomar seu histórico e realizar novas aplicações sem criar uma conta ou informar e-mail.</p>
            <div className="public-code-value">{createdCode}</div>
            <button type="button" className="secondary full" onClick={copyCode}>{copied ? 'Código copiado' : 'Copiar código privado'}</button>
            <p className="legal-note">Guarde este código em local seguro. Quem tiver acesso a ele poderá retomar esta participação e consultar o histórico associado. O código não pode ser recuperado por e-mail.</p>
            <button type="button" className="primary full" onClick={() => onAuthenticated(pendingUser)}>Entrar na plataforma</button>
          </section>
        )}

        {(mode === 'login' || mode === 'register') && (
          <>
            <form className="login-form" onSubmit={handleAccount}>
              {mode === 'register' && <>
                <label htmlFor="account-name">Nome completo</label>
                <input id="account-name" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" />
              </>}
              <label htmlFor="account-email">E-mail</label>
              <input id="account-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
              <label htmlFor="account-password">Senha</label>
              <input id="account-password" type="password" required minLength={mode === 'register' ? 12 : 1} maxLength={200} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'Mínimo de 12 caracteres' : 'Sua senha'} />
              <button className="primary full" type="submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'register' ? 'Criar minha conta' : 'Entrar na plataforma'}</button>
            </form>
            <button className="forgot-link" type="button" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Já tenho uma conta · Fazer login' : 'Criar conta com e-mail e senha'}</button>
            {mode === 'login' && <button className="forgot-link" type="button" onClick={requestReset} disabled={busy}>Esqueci minha senha</button>}
          </>
        )}

        {mode === 'public' && (
          <form className="login-form public-profile-form" onSubmit={handlePublicRegistration}>
            <div className="public-form-heading"><span className="eyebrow">PARTICIPAÇÃO PÚBLICA · SEM LOGIN</span><h2>Identificação para pesquisa</h2><p>Não solicitamos nome, e-mail ou senha. Os dados abaixo serão compartilhados entre os dois instrumentos.</p></div>
            <div className="public-form-grid">
              <label htmlFor="public-birth">Data de nascimento<input id="public-birth" type="date" required max={new Date().toISOString().slice(0,10)} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
              <label htmlFor="public-sex">Sexo<select id="public-sex" required value={sex} onChange={e=>setSex(e.target.value)}><option value="">Selecione</option><option value="M">M — Masculino</option><option value="F">F — Feminino</option></select></label>
              <label htmlFor="public-license">Categoria de habilitação <small>(opcional)</small><select id="public-license" value={licenseCategory} onChange={e=>setLicenseCategory(e.target.value)}><option value="">Não informar</option><option value="NONE">Não possui CNH</option><option value="ACC">ACC</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option><option value="AB">AB</option><option value="AC">AC</option><option value="AD">AD</option><option value="AE">AE</option></select></label>
              <label htmlFor="public-city">Município<input id="public-city" required maxLength={100} value={city} onChange={e=>setCity(e.target.value)} placeholder="Digite seu município"/></label>
              <label htmlFor="public-state">UF<select id="public-state" required value={state} onChange={e=>setState(e.target.value)}><option value="">Selecione</option>{states.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label>
              <label htmlFor="public-institution-type">Tipo de instituição / vínculo<select id="public-institution-type" required value={institutionType} onChange={e=>{setInstitutionType(e.target.value);if(e.target.value==='INDEPENDENT'){setInstitutionName('');setGroupSector('');}}}><option value="INDEPENDENT">Independente / sem vínculo</option><option value="SCHOOL">Escola</option><option value="COMPANY">Empresa</option><option value="PUBLIC_AGENCY">Órgão público</option><option value="UNIVERSITY">Universidade</option><option value="RESEARCH_CENTER">Centro de pesquisa</option><option value="COMMUNITY">Comunidade / organização social</option><option value="OTHER">Outro</option></select></label>
              {institutionType !== 'INDEPENDENT' && <label className="public-institution-name" htmlFor="public-institution-name">Nome da instituição <small>(opcional)</small><input id="public-institution-name" maxLength={180} value={institutionName} onChange={e=>setInstitutionName(e.target.value)} placeholder="Nome da escola, empresa ou instituição"/></label>}
              {institutionType !== 'INDEPENDENT' && <label className="public-institution-name" htmlFor="public-group-sector">Grupo ou setor <small>(opcional)</small><input id="public-group-sector" maxLength={120} value={groupSector} onChange={e=>setGroupSector(e.target.value)} placeholder="Turma, departamento, setor…"/></label>}
            </div>
            <details className="public-privacy-details">
              <summary>Ler aviso de privacidade e uso dos dados</summary>
              <div>
                <p><strong>Responsável pelo projeto:</strong> ENAT — Ensino Neuroeducacional Aplicado ao Trânsito. Canal de contato: enat.neuroeducacao@gmail.com.</p>
                <p><strong>Dados coletados:</strong> data de nascimento, sexo, município, UF, categoria de habilitação (opcional), tipo e nome da instituição (opcional), grupo/setor (opcional), respostas aos instrumentos e informações técnicas da aplicação, como tempo de resposta.</p>
                <p><strong>Finalidades:</strong> registrar sua participação, permitir reaplicações vinculadas ao mesmo código privado, apresentar seu histórico e produzir indicadores. O uso das respostas em pesquisas ENAT é opcional e depende da autorização específica abaixo.</p>
                <p><strong>Identificação:</strong> a participação pública não exige nome, e-mail ou senha. É criado um código privado pseudonimizado. Guarde-o em segurança: quem tiver esse código poderá retomar a participação e acessar o histórico vinculado.</p>
                <p><strong>Compartilhamento e resultados:</strong> os dados cadastrais são restritos à administração autorizada. As análises de pesquisa devem ser apresentadas em formato agregado, com supressão de recortes pequenos. Os dados não são vendidos.</p>
                <p><strong>Seus direitos:</strong> para solicitar acesso, correção ou exclusão de dados, ou retirar a autorização de pesquisa, entre em contato pelo endereço informado acima, identificando sua solicitação com o código privado. A retirada da autorização impede o uso futuro em novos agregados, sem alterar automaticamente resultados já anonimizados e divulgados.</p>
                <p><strong>Limites:</strong> os instrumentos são experimentais e não constituem diagnóstico, avaliação clínica, aptidão para dirigir ou certificação profissional.</p>
                <p className="public-privacy-review">Aviso de privacidade versão 1.1. A identificação jurídica completa do controlador, os operadores envolvidos, os prazos específicos de retenção e os canais formais de atendimento devem ser confirmados pelo responsável institucional antes da expansão pública.</p>
              </div>
            </details>
            <div className="public-consent-block">
              <label className="public-check"><input type="checkbox" checked={privacyAccepted} onChange={e=>setPrivacyAccepted(e.target.checked)}/><span><strong>Li e estou ciente do aviso de privacidade e das informações sobre o tratamento dos dados necessários para registrar minha participação.</strong><small>Data de nascimento, sexo, município, UF e vínculo institucional serão usados para contextualizar as aplicações. Não solicitamos identificação civil.</small></span></label>
              <label className="public-check optional"><input type="checkbox" checked={researchConsent} onChange={e=>setResearchConsent(e.target.checked)}/><span><strong>Autorizo, opcionalmente, o uso das minhas respostas em pesquisas ENAT.</strong><small>As análises serão realizadas em formato agregado, com supressão de recortes com menos de cinco participantes. Posso participar dos exercícios sem marcar esta opção.</small></span></label>
            </div>
            <button className="primary full" type="submit" disabled={busy || !privacyAccepted}>{busy ? 'Registrando participação…' : 'Criar identificação e continuar'}</button>
          </form>
        )}

        {mode === 'resume' && (
          <form className="login-form" onSubmit={handleResume}>
            <div className="public-form-heading"><span className="eyebrow">RETOMAR PARTICIPAÇÃO</span><h2>Informe seu código privado</h2><p>Use o código recebido quando iniciou sua participação pública.</p></div>
            <label htmlFor="participant-code">Código do participante</label>
            <input id="participant-code" required minLength={30} maxLength={100} value={participantCode} onChange={e=>setParticipantCode(e.target.value)} placeholder="ENAT-PUB-…" autoComplete="off"/>
            <button className="primary full" type="submit" disabled={busy}>{busy ? 'Verificando código…' : 'Retomar participação'}</button>
          </form>
        )}

        {mode !== 'created' && (
          <div className="public-access-options">
            <button type="button" className="public-option-primary" onClick={() => switchMode(mode === 'public' ? 'login' : 'public')}>{mode === 'public' ? 'Voltar ao login' : 'Participar sem criar conta'}</button>
            <button type="button" className="forgot-link" onClick={() => switchMode(mode === 'resume' ? 'login' : 'resume')}>{mode === 'resume' ? 'Voltar ao login' : 'Já tenho um código de participante'}</button>
          </div>
        )}
        <p className="legal-note">Os instrumentos são experimentais. Seus resultados não constituem diagnóstico psicológico, avaliação clínica, aptidão para dirigir ou certificação profissional.</p>
      </div>
    </main>
  );
}
