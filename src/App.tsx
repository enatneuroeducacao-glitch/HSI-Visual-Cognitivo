import { useEffect, useMemo, useState } from 'react';
import { auth, api, publicAccess } from './lib/api';
import AdminPanel from './AdminPanel';
import DothpAssessment from './DothpAssessment';
import InstrumentHistory from './InstrumentHistory';
import PublicAccess from './PublicAccess';
import ResearchProfile from './ResearchProfile';
import PrivacyCenter from './PrivacyCenter';
import ParticipantExperience from './ParticipantExperience';
import { exportReportCsv, exportReportExcel } from './report-export';

const logoUrl = new URL('../assets/hsi-visual-cognitivo.webp', import.meta.url).href;

type Axis = {
  id: string;
  title: string;
  short: string;
  description: string;
  color: string;
};

type Question = {
  id: string;
  axis: string;
  prompt: string;
  visual: string[];
  options: string[];
};

type AnswerDetail = { questionId: string; axisId: string; selected: number; prompt: string; selectedOption: string; correctOption: string; correct: boolean; seconds: number };

type SavedResult = {
  id: string;
  participantCode: string;
  mode: string;
  completedAt: string;
  totalQuestions: number;
  correct: number;
  accuracy: number;
  durationSeconds: number;
  answerDetails?: AnswerDetail[];
  axes: Array<{
    axisId: string;
    title: string;
    correct: number;
    total: number;
    accuracy: number;
    averageSeconds: number;
  }>;
};

const axes: Axis[] = [
  {
    id: 'logic',
    title: 'Raciocínio lógico',
    short: 'Lógica',
    description: 'Resolver relações e problemas por regras explícitas.',
    color: '#6d5ce8',
  },
  {
    id: 'attention',
    title: 'Atenção seletiva',
    short: 'Atenção',
    description: 'Identificar estímulos relevantes em meio a distratores.',
    color: '#0d9488',
  },
  {
    id: 'patterns',
    title: 'Percepção de padrões',
    short: 'Padrões',
    description: 'Reconhecer regularidades, sequências e mudanças.',
    color: '#d97706',
  },
  {
    id: 'anticipation',
    title: 'Antecipação de situações',
    short: 'Antecipação',
    description: 'Inferir o que pode acontecer a partir de pistas disponíveis.',
    color: '#2563eb',
  },
  {
    id: 'risk',
    title: 'Percepção de riscos no trânsito',
    short: 'Risco viário',
    description:
      'Reconhecer conflitos potenciais e vulnerabilidades no cenário viário.',
    color: '#dc5656',
  },
  {
    id: 'decision',
    title: 'Tomada de decisão',
    short: 'Decisão',
    description: 'Selecionar uma resposta prudente diante de alternativas.',
    color: '#7c3aed',
  },
];

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'min ' + String(s).padStart(2, '0') + 's';
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [consentUpdating, setConsentUpdating] = useState(false);
  const [consentFeedback, setConsentFeedback] = useState('');
  const [mode, setMode] = useState('full');
  const [studyCode,setStudyCode] = useState('');
  const [studyGroupCode,setStudyGroupCode] = useState('');
  const [researchConsent,setResearchConsent] = useState(false);
  const [runQuestions, setRunQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<
    Array<{
      questionId: string;
      axisId: string;
      selected: number;
      correct: boolean;
      seconds: number;
    }>
  >([]);
  const [results, setResults] = useState<SavedResult[]>([]);
  const [behavioralResults, setBehavioralResults] = useState<any[]>([]);
  const [finishConfirmation, setFinishConfirmation] = useState(false);
  const [pendingFinalAnswers, setPendingFinalAnswers] = useState<typeof answers>([]);
  const [view, setView] = useState('home');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [lastResult, setLastResult] = useState<SavedResult | null>(null);
  const [selectedReport, setSelectedReport] = useState<SavedResult | null>(null);
  const [advisorText, setAdvisorText] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState('');

  useEffect(() => {
    auth
      .getUser()
      .then(current => {
        setUser(current);
        setResearchConsent(Boolean(current?.researchProfile?.researchConsent));
        setAuthLoading(false);
      })
      .catch(() => {
        setAuthLoading(false);
      });
  }, []);

  const loadResults = async () => {
    try {
      const [response, behavioral] = await Promise.all([api.get('/api/results'), api.get('/api/instrument-results')]);
      setResults(response.data.results || []);
      setBehavioralResults(behavioral.data.results || []);
    } catch {
      setSaveError(
        'Não foi possível carregar o histórico. Verifique sua conexão e tente novamente.'
      );
    }
  };

  useEffect(() => {
    if (user) loadResults();
  }, [user]);

  useEffect(() => {
    if (view !== 'test') return;
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [view, startedAt]);

  const current = runQuestions[index];
  const currentAxis = current
    ? axes.find(axis => axis.id === current.axis)
    : null;
  const progress = runQuestions.length
    ? ((index + 1) / runQuestions.length) * 100
    : 0;
  const consolidatedReport = useMemo(() => {
    const latestByAxis = new Map<string, { result: SavedResult; axis: SavedResult['axes'][number] }>();
    const ordered = [...results].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    for (const result of ordered) {
      for (const axisResult of result.axes || []) {
        if (!latestByAxis.has(axisResult.axisId)) {
          latestByAxis.set(axisResult.axisId, { result, axis: axisResult });
        }
      }
    }
    const rows = axes.map(axis => latestByAxis.get(axis.id)).filter(Boolean) as Array<{ result: SavedResult; axis: SavedResult['axes'][number] }>;
    const total = rows.reduce((sum, row) => sum + row.axis.total, 0);
    const correct = rows.reduce((sum, row) => sum + row.axis.correct, 0);
    const seconds = rows.reduce((sum, row) => sum + row.axis.averageSeconds * row.axis.total, 0);
    return {
      rows,
      totalAxes: rows.length,
      totalQuestions: total,
      correct,
      accuracy: total ? Math.round(correct / total * 100) : 0,
      averageSeconds: total ? Math.round(seconds / total) : 0
    };
  }, [results]);

  const openReport = (result: SavedResult) => {
    setSelectedReport(result);
    setView('report');
  };

  const buildConsolidatedResult = (): SavedResult | null => {
    if (!consolidatedReport.rows.length) return null;
    const axisResults = consolidatedReport.rows.map(row => row.axis);
    const correct = axisResults.reduce((sum, axis) => sum + axis.correct, 0);
    const totalQuestions = axisResults.reduce((sum, axis) => sum + axis.total, 0);
    const durationSeconds = axisResults.reduce((sum, axis) => sum + axis.averageSeconds * axis.total, 0);
    const latestDate = consolidatedReport.rows.map(row => row.result.completedAt).sort().slice(-1)[0] || new Date().toISOString();
    const participant = consolidatedReport.rows[0].result.participantCode;
    const aggregate: SavedResult = {
      id: 'consolidated-' + participant,
      participantCode: participant,
      mode: 'Relatório geral consolidado · último resultado disponível por eixo',
      completedAt: latestDate,
      totalQuestions,
      correct,
      accuracy: totalQuestions ? Math.round(correct / totalQuestions * 100) : 0,
      durationSeconds,
      axes: axisResults,
      answerDetails: consolidatedReport.rows.flatMap(row => row.result.answerDetails || []).filter(detail => axisResults.some(axis => axis.axisId === detail.axisId))
    };
    return aggregate;
  };

  const openConsolidatedReport = () => {
    const aggregate = buildConsolidatedResult();
    if (!aggregate) return;
    setSelectedReport(aggregate);
    setAdvisorText('');
    setAdvisorError('');
    setView('report');
  };

  const openConsolidatedAdvisor = async () => {
    const aggregate = buildConsolidatedResult();
    if (!aggregate) return;
    setSelectedReport(aggregate);
    setAdvisorText('');
    setAdvisorError('');
    setView('report');
    setAdvisorLoading(true);
    try {
      const response = await api.post('/api/advisor', { resultIds: consolidatedReport.rows.map(row => row.result.id) });
      setAdvisorText(response.data.guidance || 'A orientação foi gerada sem conteúdo disponível.');
    } catch {
      setAdvisorError('Não foi possível gerar a orientação personalizada. Tente novamente.');
    } finally {
      setAdvisorLoading(false);
    }
  };

  // Preserve paragraph boundaries returned by the advisor.
  const renderAdvisorText = (content: string) => {
    const lines = content.replace(/\*\*(.*?)\*\*/g, '$1').split('\n');
    return <div className="advisor-document-content">{lines.map((line, index) => {
      const clean = line.trim();
      if (!clean) return <div className="advisor-space" key={index}/>;
      if (/^#{1,3}\s/.test(clean)) return <h3 key={index}>{clean.replace(/^#{1,3}\s*/, '')}</h3>;
      if (/^[-*]\s/.test(clean)) return <div className="advisor-bullet" key={index}><span>•</span><p>{clean.replace(/^[-*]\s*/, '')}</p></div>;
      if (/^\d+[.)]\s/.test(clean)) return <div className="advisor-numbered" key={index}>{clean}</div>;
      return <p key={index}>{clean}</p>;
    })}</div>;
  };

  const generateAdvisor = async () => {
    if (!selectedReport) return;
    setAdvisorLoading(true);
    setAdvisorError('');
    setAdvisorText('');
    try {
      const response = await api.post('/api/advisor', { resultIds: [selectedReport.id] });
      setAdvisorText(response.data.guidance || 'A orientação foi gerada sem conteúdo disponível.');
    } catch {
      setAdvisorError('Não foi possível gerar a orientação personalizada. Verifique a conexão e tente novamente.');
    } finally {
      setAdvisorLoading(false);
    }
  };

  const printReport = () => window.setTimeout(() => window.print(), 150);

  const behavioralObservations = (answerDetails?: AnswerDetail[]) => {
    if (!answerDetails?.length) {
      return {
        available: false,
        summary: 'Os registros desta avaliação não armazenam o detalhe de cada alternativa e do tempo individual por questão. Por isso, não é possível reconstruir padrões comportamentais retrospectivos com segurança.',
        items: [] as string[]
      };
    }
    const times = answerDetails.map(item => item.seconds).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] || 0;
    const fastErrors = answerDetails.filter(item => !item.correct && item.seconds < median * 0.7);
    const slowCorrect = answerDetails.filter(item => item.correct && item.seconds > median * 1.5);
    const axisRows = axes.map(axis => {
      const rows = answerDetails.filter(item => item.axisId === axis.id);
      const errors = rows.filter(item => !item.correct).length;
      const avg = rows.length ? rows.reduce((sum, item) => sum + item.seconds, 0) / rows.length : 0;
      const min = rows.length ? Math.min(...rows.map(item => item.seconds)) : 0;
      const max = rows.length ? Math.max(...rows.map(item => item.seconds)) : 0;
      return { title: axis.title, rows, errors, avg: Math.round(avg), range: max - min };
    }).filter(row => row.rows.length);
    const items: string[] = [];
    for (const row of axisRows) {
      if (row.errors > 0) items.push(`${row.title}: ${row.errors} resposta(s) incorreta(s) em ${row.rows.length} exercício(s). Recomenda-se revisar os tipos de tarefa em que ocorreram os erros.`);
      if (row.rows.length >= 3 && row.range >= Math.max(8, row.avg * 1.5)) items.push(`${row.title}: houve variação perceptível entre o menor e o maior tempo de resposta (${row.range} s). Isso descreve os tempos desta sessão e não permite, isoladamente, inferir uma característica psicológica.`);
    }
    if (fastErrors.length) items.push(`${fastErrors.length} resposta(s) incorreta(s) ocorreram em tempo inferior a 70% da mediana individual (${median} s). Vale revisar se houve leitura apressada ou interpretação diferente do enunciado; o tempo, sozinho, não prova impulsividade.`);
    if (slowCorrect.length) items.push(`${slowCorrect.length} resposta(s) correta(s) levaram mais de 1,5 vez a mediana individual. Isso pode refletir maior tempo de análise nessas questões, sem indicar por si só dificuldade cognitiva.`);
    if (!items.length) items.push('Nesta sessão, não foram identificados contrastes marcantes pelos critérios descritivos simples utilizados. Isso não equivale à ausência de variação nem a uma classificação cognitiva.');
    return {
      available: true,
      summary: `Foram analisadas ${answerDetails.length} respostas, considerando acerto/erro e tempo individual. Os tempos são comparados apenas com a distribuição desta própria sessão, sem normas externas.`,
      items
    };
  };


  const recommendationsFor = (accuracy: number, axisId: string) => {
    const data: Record<string, { focus: string; practices: string[]; traffic: string }> = {
      logic: { focus: 'Resolução de problemas, comparação de alternativas e aplicação de regras.', practices: ['Resolver sequências e problemas de lógica variados, explicando o raciocínio.', 'Praticar classificação e relações entre símbolos, números e situações.', 'Identificar as informações disponíveis e a regra aplicável antes de decidir.'], traffic: 'Observar sinalização, prioridades e condições do ambiente antes de escolher uma manobra.' },
      attention: { focus: 'Seleção de estímulos relevantes e identificação de detalhes em meio a informações concorrentes.', practices: ['Realizar tarefas breves de busca visual com estímulos-alvo e distratores.', 'Variar gradualmente a quantidade de estímulos, com pausas regulares.', 'Praticar observação sistemática do ambiente, sem fixar a atenção em um único ponto.'], traffic: 'Distribuir a observação entre via, espelhos, sinalização e usuários vulneráveis, sem usar o celular.' },
      patterns: { focus: 'Reconhecimento de regularidades, mudanças e sequências visuais.', practices: ['Completar sequências e identificar elementos que rompem um padrão.', 'Comparar imagens semelhantes e localizar pequenas mudanças.', 'Explicar a regra que sustenta cada resposta.'], traffic: 'Observar alterações no fluxo e nas condições da via que possam sinalizar mudanças.' },
      anticipation: { focus: 'Uso de pistas do ambiente para considerar acontecimentos possíveis.', practices: ['Analisar cenas e listar o que pode acontecer em seguida.', 'Separar fatos observáveis de hipóteses.', 'Treinar cenários com pedestres, ciclistas, cruzamentos e veículos parcialmente ocultos.'], traffic: 'Manter margem de segurança e estar preparado para eventos plausíveis, sem presumir que ocorrerão.' },
      risk: { focus: 'Reconhecimento de conflitos potenciais, visibilidade limitada e vulnerabilidade dos usuários.', practices: ['Analisar imagens de trânsito e apontar riscos, obstáculos e pontos cegos.', 'Comparar cenários com diferentes condições de visibilidade e aderência.', 'Descrever medidas preventivas adequadas a cada cenário.'], traffic: 'Ajustar velocidade e distância às condições e verificar pontos cegos antes de manobras.' },
      decision: { focus: 'Avaliação de alternativas e escolha de respostas prudentes.', practices: ['Resolver estudos de caso, justificando riscos e vantagens de cada alternativa.', 'Praticar a sequência: observar, avaliar opções, antecipar consequências e agir.', 'Revisar decisões e identificar quais informações foram determinantes.'], traffic: 'Priorizar condutas previsíveis, respeitar a sinalização e evitar manobras abruptas ou proibidas.' }
    };
    const item = data[axisId] || data.logic;
    const interpretation = accuracy >= 80
      ? 'Neste conjunto de exercícios, o percentual de acertos foi relativamente elevado. Amplie a variedade e a complexidade das atividades para observar a consistência do desempenho.'
      : accuracy >= 60
        ? 'Neste conjunto, houve acertos e oportunidades de revisão. A prática gradual pode ajudar a consolidar estratégias.'
        : 'Neste conjunto, pode ser útil retomar estratégias básicas, praticar com orientação e repetir atividades variadas em outro momento.';
    return { ...item, interpretation };
  };

  const startTest = async (axisId?: string) => {
    const profile = user?.researchProfile;
    if (!profile?.birthDate || !profile?.sex || !profile?.city || !profile?.state || !profile?.institutionType || profile?.privacyNoticeVersion !== 'ENAT-PRIVACY-1.1') {
      setSaveError('Antes de iniciar os exercícios, complete o cadastro e confirme a leitura do aviso de privacidade atualizado.');
      setView('home');
      return;
    }
    setSaveError('');
    try {
      const params = new URLSearchParams(axisId ? { mode: 'axis', axisId } : { mode: 'full' });
      const response = await api.get('/api/questions?' + params.toString());
      const delivered = response.data.questions as Question[];
      if (!Array.isArray(delivered) || delivered.length !== (axisId ? 5 : 30)) throw new Error('Quantidade de exercícios recebida é inválida.');
      setRunQuestions(axisId ? delivered : shuffle(delivered));
    } catch (error: any) {
      setSaveError(error?.response?.data?.error || error.message || 'Não foi possível carregar os exercícios.');
      return;
    }
    setMode(axisId ? 'axis' : 'full');
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    setStartedAt(Date.now());
    setQuestionStartedAt(Date.now());
    setElapsed(0);
    setSaveError('');
    setView('test');
  };

  const finishTest = async (finalAnswers: typeof answers) => {
    const totalSeconds = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    const payload = {
      id: crypto.randomUUID(),
      mode: mode === 'full' ? 'Avaliação completa' : 'Eixo individual',
      completedAt: new Date().toISOString(),
      totalQuestions: finalAnswers.length,
      durationSeconds: totalSeconds,
      instrumentVersion: '1.0',
      researchConsent,
      ...(studyCode.trim()?{studyCode:studyCode.trim().toUpperCase(),...(studyGroupCode.trim()?{studyGroupCode:studyGroupCode.trim().toUpperCase()}:{})}:{}),
      answerDetails: finalAnswers.map(({ questionId, axisId, selected, seconds }) => ({ questionId, axisId, selected, seconds })),
    };
    setSaving(true);
    setSaveError('');
    try {
      const response = await api.post('/api/results', payload);
      setLastResult(response.data.result as SavedResult);
      await loadResults();
      setView('result');
    } catch (error: any) {
      setSaveError(error?.response?.data?.error || 'Não foi possível validar e salvar o resultado. Nenhum resultado foi registrado. Saia da sessão e inicie uma nova avaliação para tentar novamente.');
      setView('test');
    } finally {
      setSaving(false);
    }
  };


  const chooseAnswer = (optionIndex: number) => {
    if (selected !== null) return;
    setSelected(optionIndex);
  };

  const nextQuestion = () => {
    if (selected === null || !current) return;
    const response = {
      questionId: current.id,
      axisId: current.axis,
      selected,
      correct: false,
      seconds: Math.max(1, Math.floor((Date.now() - questionStartedAt) / 1000)),
    };
    const nextAnswers = [...answers, response];
    setAnswers(nextAnswers);
    if (index + 1 < runQuestions.length) {
      setIndex(index + 1);
      setSelected(null);
      setQuestionStartedAt(Date.now());
    } else {
      setPendingFinalAnswers(nextAnswers);
      setFinishConfirmation(true);
    }
  };

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setResults([]);
    setBehavioralResults([]);
    setFinishConfirmation(false);
    setView('home');
  };

  const togglePublicResearchConsent = async () => {
    if (!user?.publicAccess || consentUpdating) return;
    setConsentUpdating(true);
    setConsentFeedback('');
    try {
      const nextValue = !Boolean(user.researchProfile?.researchConsent);
      const response = await publicAccess.updateResearchConsent(nextValue);
      setUser(response.data.user);
      setConsentFeedback(nextValue ? 'Autorização de pesquisa ativada.' : 'Autorização de pesquisa retirada. Novos agregados deixarão de incluir suas aplicações públicas.');
    } catch (error: any) {
      setConsentFeedback(error?.response?.data?.error || 'Não foi possível atualizar sua autorização.');
    } finally {
      setConsentUpdating(false);
    }
  };

  if (authLoading)
    return (
      <main className="center-screen">
        <div className="loader" />
        <p>Preparando ambiente seguro…</p>
      </main>
    );
  if (!user) return <PublicAccess onAuthenticated={setUser} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <img className="sidebar-brand-logo" src={logoUrl} alt="HSI Visual Cognitivo" />
        </div>
        <div className="side-label">AMBIENTE</div>
        <button
          className={['home','cognitive-intro','dothp-intro'].includes(view) ? 'nav-item active' : 'nav-item'}
          onClick={() => setView('home')}
        >
          ⌂ <span>Painel inicial</span>
        </button>
        <button className={view === 'dothp' || view === 'dothp-intro' ? 'nav-item active' : 'nav-item'} onClick={() => { if (!user?.researchProfile?.birthDate || user?.researchProfile?.privacyNoticeVersion !== 'ENAT-PRIVACY-1.1') { setSaveError('Complete o cadastro e confirme o aviso de privacidade atualizado no painel inicial.'); setView('home'); return; } setView('dothp-intro'); }}>
          ◉ <span>HSI-DOTH-P comportamental</span>
        </button>
        <button
          className={view === 'privacy' ? 'nav-item active' : 'nav-item'}
          onClick={() => setView('privacy')}
        >
          ◈ <span>Privacidade e meus dados</span>
        </button>
        <button
          className={view === 'history' ? 'nav-item active' : 'nav-item'}
          onClick={() => {
            setView('history');
            loadResults();
          }}
        >
          ◷ <span>Histórico</span>
        </button>
        {(user.role === 'ADMIN' || user.role === 'ANALYST') && (
          <button className={view === 'admin' ? 'nav-item active' : 'nav-item'} onClick={() => setView('admin')}>
            ◫ <span>{user.role === 'ADMIN' ? 'Administração' : 'Análises coletivas'}</span>
          </button>
        )}
        <div className="side-bottom">
          <div className="user-chip">
            <div className="avatar">
              {(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{user.name || 'Pesquisador'}</strong>
              <small>{user.publicAccess ? 'Acesso público · código privado' : user.email || 'Conta autenticada'}</small>
            </div>
          </div>
          <button className="logout" onClick={logout}>
            {user.publicAccess ? 'Encerrar sessão' : 'Sair da conta'}
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">ENAT · INSTRUMENTOS COMPLEMENTARES</span>
            <h2>
              {view === 'home'
                ? 'Painel de avaliação'
                : view === 'dothp' || view === 'dothp-intro'
                  ? 'Avaliação comportamental HSI-DOTH-P'
                  : view === 'cognitive-intro'
                    ? 'HSI Visual Cognitivo'
                  : view === 'history'
                  ? 'Histórico de avaliações'
                  : view === 'test'
                    ? 'Sessão em andamento'
                    : view === 'report'
                      ? 'Relatório individual'
                      : view === 'admin'
                        ? 'Gestão e inteligência'
                        : 'Resultado da sessão'}
            </h2>
          </div>
          <div className="top-meta">
            <span className="status-dot" /> Ambiente experimental
          </div>
        </header>

        {view === 'privacy' && <main className="main-content"><PrivacyCenter user={user} onUserChange={(next)=>{setUser(next);setResearchConsent(Boolean(next?.researchProfile?.researchConsent));}} /></main>}
        {view === 'admin' && (user.role === 'ADMIN' || user.role === 'ANALYST') && <AdminPanel role={user.role} />}
        {view === 'dothp' && <DothpAssessment participantData={user.researchProfile} />}

        {view === 'home' && (
          <ParticipantExperience
            participantName={user.name || ''}
            publicAccess={Boolean(user.publicAccess)}
            participantCode={user.participantCode}
            cognitiveApplications={results.length}
            behavioralApplications={behavioralResults.length}
            onStartCognitive={() => setView('cognitive-intro')}
            onStartBehavioral={() => setView('dothp-intro')}
            onHistory={() => { setView('history'); loadResults(); }}
            onPrivacy={() => setView('privacy')}
          />
        )}

        {view === 'cognitive-intro' && (
          <section className="participant-intro-page">
            <button className="participant-back" onClick={() => setView('home')}>← Voltar aos instrumentos</button>
            <div className="participant-intro-card">
              <span className="eyebrow">EXERCÍCIOS · HSI VISUAL COGNITIVO</span>
              <h1>Explore habilidades em tarefas visuais e de raciocínio.</h1>
              <p>Esta bateria reúne exercícios experimentais que observam precisão e tempo de resposta em seis eixos. As tarefas não são um diagnóstico e não medem, isoladamente, sua capacidade geral.</p>
              <div className="participant-intro-facts"><span><b>30</b> exercícios</span><span><b>6</b> eixos</span><span><b>Sem limite rígido</b> de tempo total</span></div>
              <h2>O que será observado</h2>
              <ul><li>Raciocínio lógico e atenção seletiva</li><li>Percepção de padrões e antecipação de situações</li><li>Percepção de riscos no trânsito e tomada de decisão</li></ul>
              <div className="participant-intro-notice"><strong>Antes de começar</strong><p>Responda em um ambiente tranquilo. Leia cada questão com atenção. Você poderá acompanhar seu progresso; ao concluir, será solicitado que confirme o envio.</p><p>Seus resultados serão apresentados somente como descrição desta aplicação, sem classificação clínica ou de aptidão.</p></div>
              <button className="participant-primary" onClick={() => startTest()}>Iniciar exercícios <span aria-hidden="true">→</span></button>
            </div>
          </section>
        )}

        {view === 'dothp-intro' && (
          <section className="participant-intro-page">
            <button className="participant-back" onClick={() => setView('home')}>← Voltar aos instrumentos</button>
            <div className="participant-intro-card behavioral">
              <span className="eyebrow">AUTOAVALIAÇÃO · HSI-DOTH-P</span>
              <h1>Reflita sobre seus padrões de comportamento.</h1>
              <p>O HSI-DOTH-P reúne afirmações sobre cinco dimensões da experiência humana. Não existem respostas certas ou erradas: responda de acordo com a forma como costuma agir.</p>
              <div className="participant-intro-facts"><span><b>25</b> afirmações</span><span><b>5</b> dimensões</span><span><b>1–5</b> escala de concordância</span></div>
              <h2>As cinco dimensões</h2>
              <ul><li>Decisão e Organização</li><li>Tempo e Humanização</li><li>Psicocomportamental</li></ul>
              <div className="participant-intro-notice"><strong>Antes de começar</strong><p>Considere experiências recentes e representativas. Não responda pensando no que seria ideal, mas no que realmente costuma acontecer.</p><p>Você verá sua devolutiva dimensional ao finalizar. A interpretação é descritiva e não representa diagnóstico, personalidade fixa ou aptidão.</p></div>
              <button className="participant-primary" onClick={() => setView('dothp')}>Iniciar autoavaliação <span aria-hidden="true">→</span></button>
            </div>
          </section>
        )}

        {view === 'test' && current && (
          <section className="test-content">
            {saveError && <div className="notice error">{saveError}</div>}
            <div className="test-toolbar">
              <button className="back-link" onClick={() => setView('home')}>
                ← Sair da sessão
              </button>
              <span className="timer">◷ {formatTime(elapsed)}</span>
            </div>
            <div className="progress-row">
              <span>
                QUESTÃO {index + 1} DE {runQuestions.length}
              </span>
              <span>{Math.round(progress)}% concluído</span>
            </div>
            <div className="progress-track">
              <div style={{ width: progress + '%' }} />
            </div>
            <div className="question-layout">
              <div className="question-main">
                <span
                  className="axis-badge"
                  style={{ color: currentAxis?.color }}
                >
                  {currentAxis?.title}
                </span>
                <h1>{current.prompt}</h1>
                <div className="visual-board">
                  {current.visual.map((line, i) => (
                    <div key={i} className="visual-line">
                      {line}
                    </div>
                  ))}
                </div>
                <div className="options-list">
                  {current.options.map((option, i) => (
                    <button
                      key={i}
                      className={selected === i ? 'option selected' : 'option'}
                      onClick={() => chooseAnswer(i)}
                    >
                      <span className="option-letter">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{option}</span>
                      <span className="option-check">
                        {selected === i ? '✓' : ''}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="question-footer">
                  <span>
                    {selected === null
                      ? 'Selecione uma alternativa para continuar.'
                      : 'Resposta selecionada.'}
                  </span>
                  <button
                    className="primary"
                    disabled={selected === null || saving}
                    onClick={nextQuestion}
                  >
                    {index + 1 === runQuestions.length
                      ? 'Concluir sessão'
                      : 'Próxima questão'}{' '}
                    →
                  </button>
                </div>
              </div>
              <aside className="question-aside">
                <span className="eyebrow">SEU PROGRESSO</span>
                <strong>
                  {index + 1}
                  <small> / {runQuestions.length}</small>
                </strong>
                <p>
                  As respostas são registradas ao avançar. O resultado é
                  calculado ao final da sessão.
                </p>
                <div className="mini-dots">
                  {runQuestions.map((q, i) => (
                    <span
                      key={q.id}
                      className={i < index ? 'done' : i === index ? 'now' : ''}
                    />
                  ))}
                </div>
                <div className="aside-note">
                  Responda considerando apenas as informações apresentadas em
                  cada exercício.
                </div>
              </aside>
            </div>
          </section>
        )}

        {view === 'result' && lastResult && (
          <section className="content result-content">
            <div className="result-head">
              <span className="eyebrow">SESSÃO FINALIZADA</span>
              <h1>Panorama de desempenho</h1>
              <p>
                Resultado experimental registrado para o código{' '}
                <strong>{lastResult.participantCode}</strong>.
              </p>
            </div>
            {saveError && (
              <div className="notice error">
                {saveError}{' '}
                
              </div>
            )}
            <div className="score-grid">
              <div className="score-card primary-score">
                <span>Precisão geral</span>
                <strong>{lastResult.accuracy}%</strong>
                <small>
                  {lastResult.correct} de {lastResult.totalQuestions} respostas
                  corretas
                </small>
              </div>
              <div className="score-card">
                <span>Tempo total</span>
                <strong>{formatTime(lastResult.durationSeconds)}</strong>
                <small>Duração da sessão</small>
              </div>
              <div className="score-card">
                <span>Eixos observados</span>
                <strong>{lastResult.axes.length}/6</strong>
                <small>Dimensões com respostas</small>
              </div>
            </div>
            <div className="result-table">
              <div className="table-title">
                <h3>Desempenho por eixo</h3>
                <span>Indicadores descritivos</span>
              </div>
              {lastResult.axes.map(axis => (
                <div className="axis-result" key={axis.axisId}>
                  <div>
                    <strong>{axis.title}</strong>
                    <small>
                      {axis.correct}/{axis.total} acertos · média{' '}
                      {axis.averageSeconds}s por questão
                    </small>
                  </div>
                  <div className="bar-wrap">
                    <div className="bar">
                      <span style={{ width: axis.accuracy + '%' }} />
                    </div>
                    <b>{axis.accuracy}%</b>
                  </div>
                </div>
              ))}
            </div>
            <div className="result-actions">
              {lastResult.accuracy === 100 ? <button className="secondary" onClick={() => openReport(lastResult)}>Ver parecer breve</button> : <button className="secondary" onClick={() => openReport(lastResult)}>Gerar relatório único PDF</button>}
              <button className="secondary" onClick={() => setView('history')}>Ver histórico</button>
              <button className="primary" onClick={() => setView('home')}>Voltar ao painel</button>
            </div>
            <div className="disclaimer">
              <span>ⓘ</span>
              <p>
                Os resultados não permitem classificar uma pessoa como apta ou
                inapta para dirigir. A interpretação científica exige estudos de
                validade, confiabilidade, normas e controle das condições de
                aplicação.
              </p>
            </div>
          </section>
        )}

        {view === 'report' && selectedReport && (
          <section className="content report-page">
            <div className="report-toolbar no-print">
              <button className="back-link" onClick={() => setView('history')}>← Voltar ao histórico</button>
              <button className="secondary" onClick={()=>{const metadata={Instrumento:"HSI Visual Cognitivo",Código: selectedReport.participantCode,Data:new Date(selectedReport.completedAt).toLocaleString("pt-BR"),Sessão:selectedReport.mode,Amostra:"1 participante — relatório pessoal",Metodologia:"Desempenho descritivo em tarefas estruturadas; percentuais calculados a partir de acertos e questões respondidas.",Inclusão:"Somente o resultado autenticado do próprio participante.",Limitações:"Instrumento experimental; não constitui diagnóstico, norma populacional, laudo ou avaliação de aptidão para dirigir."};const rows=[...selectedReport.axes.map(a=>({Tipo:"Eixo",Indicador:a.title,Acertos:a.correct,Questões:a.total,Precisão:a.accuracy,Tempo_médio_segundos:a.averageSeconds})),...(selectedReport.answerDetails||[]).map(a=>({Tipo:"Resposta",Questão:a.prompt,Eixo:a.axisId,Alternativa:a.selectedOption,Alternativa_referência:a.correctOption,Acerto:a.correct?"Sim":"Não",Tempo_segundos:a.seconds}))];exportReportCsv("HSI-Visual-Cognitivo-individual-"+selectedReport.completedAt.slice(0,10)+".csv",metadata,rows);}}>CSV</button><button className="secondary" onClick={()=>{const metadata={Instrumento:"HSI Visual Cognitivo",Código:selectedReport.participantCode,Data:new Date(selectedReport.completedAt).toLocaleString("pt-BR"),Sessão:selectedReport.mode,Amostra:"1 participante — relatório pessoal",Metodologia:"Desempenho descritivo em tarefas estruturadas; percentuais calculados a partir de acertos e questões respondidas.",Inclusão:"Somente o resultado autenticado do próprio participante.",Limitações:"Instrumento experimental; não constitui diagnóstico, norma populacional, laudo ou avaliação de aptidão para dirigir."};exportReportExcel("HSI-Visual-Cognitivo-individual-"+selectedReport.completedAt.slice(0,10)+".xls",metadata,[{name:"Eixos",rows:selectedReport.axes.map(a=>({Eixo:a.title,Acertos:a.correct,Questões:a.total,Precisão:a.accuracy,Tempo_médio_segundos:a.averageSeconds}))},{name:"Respostas",rows:(selectedReport.answerDetails||[]).map(a=>({Questão:a.prompt,Eixo:a.axisId,Alternativa:a.selectedOption,Alternativa_referência:a.correctOption,Acerto:a.correct?"Sim":"Não",Tempo_segundos:a.seconds}))}]);}}>Excel</button><button className="primary" onClick={printReport}>PDF / Imprimir</button>
            </div>
            <article className="pdf-report">
              <header className="pdf-header institutional-header">
                <div className="institutional-logos"><img src="/resources/logo-enat.png" alt="Logo ENAT"/><img src="/resources/neurociencia-transito.jpeg" alt="Neurociência Aplicada ao Trânsito"/></div>
                <div className="institutional-title"><span className="eyebrow">ENSINO NEUROEDUCACIONAL APLICADO AO TRÂNSITO</span><h1>HSI Visual Cognitivo</h1><p>Relatório geral de desempenho e orientações</p></div>
              </header>
              <div className="pdf-identification">
                <div><small>PARTICIPANTE</small><strong>{selectedReport.participantCode}</strong></div>
                <div><small>DATA DA AVALIAÇÃO</small><strong>{new Date(selectedReport.completedAt).toLocaleString('pt-BR')}</strong></div>
                <div><small>TIPO DE SESSÃO</small><strong>{selectedReport.mode}</strong></div>
              </div>
              <h2>1. Síntese do desempenho</h2>
              <div className="pdf-kpis">
                <div><small>Precisão nesta sessão</small><strong>{selectedReport.accuracy}%</strong></div>
                <div><small>Respostas corretas</small><strong>{selectedReport.correct}/{selectedReport.totalQuestions}</strong></div>
                <div><small>Tempo total</small><strong>{formatTime(selectedReport.durationSeconds)}</strong></div>
                <div><small>Eixos observados</small><strong>{selectedReport.axes.length}/6</strong></div>
              </div>
              <p className="pdf-intro">Este documento descreve o desempenho registrado nesta sessão. Os resultados representam somente as respostas e os tempos observados nesta aplicação.</p>
              <h2>2. Resultados e orientações por eixo</h2>
              {selectedReport.axes.map(axisResult => {
                const guidance = recommendationsFor(axisResult.accuracy, axisResult.axisId);
                return <section className="pdf-axis" key={axisResult.axisId}>
                  <div className="pdf-axis-title"><h3>{axisResult.title}</h3><strong>{axisResult.accuracy}%</strong></div>
                  <p className="pdf-small">{axisResult.correct} acertos em {axisResult.total} exercícios · tempo médio: {axisResult.averageSeconds} segundos por questão.</p>
                  <p><strong>O que este eixo explora:</strong> {guidance.focus}</p>
                  <p><strong>Leitura descritiva:</strong> {guidance.interpretation}</p>
                  <p><strong>Práticas recomendadas:</strong></p>
                  <ul>{guidance.practices.map((practice, i) => <li key={i}>{practice}</li>)}</ul>
                  <p><strong>Aplicação ao contexto do trânsito:</strong> {guidance.traffic}</p>
                </section>;
              })}
              {selectedReport.axes.length < 6 && <div className="pdf-notice"><strong>Avaliação parcial:</strong> esta sessão contemplou {selectedReport.axes.length} dos seis eixos. Os eixos não realizados não foram avaliados.</div>}
              <h2>3. Análise dos indicadores comportamentais e observações cognitivas</h2>
              {(() => {
                const observations = behavioralObservations(selectedReport.answerDetails);
                return <>
                  <p>{observations.summary}</p>
                  {observations.available ? <ul>{observations.items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <div className="pdf-notice">{observations.summary} As avaliações anteriores à inclusão deste registro detalhado permanecem válidas para os percentuais e tempos médios, mas não permitem análise item a item.</div>}
                  {observations.available && <p><strong>Limite interpretativo:</strong> as observações descrevem apenas o comportamento de resposta nesta tarefa. Não identificam traços de personalidade, impulsividade, ansiedade, déficit de atenção ou qualquer condição clínica.</p>}
                </>;
              })()}
              <h2>3.1. Análise das questões e dos padrões de resposta</h2>
              {selectedReport.answerDetails?.length ? (() => {
                const details=selectedReport.answerDetails!;
                const errors=details.filter(item=>!item.correct);
                const byAxis=selectedReport.axes.map(axis=>({axis,items:details.filter(item=>item.axisId===axis.axisId)}));
                const strongest=[...selectedReport.axes].sort((a,b)=>b.accuracy-a.accuracy)[0];
                const weakest=[...selectedReport.axes].sort((a,b)=>a.accuracy-b.accuracy)[0];
                const sortedTimes=details.map(item=>item.seconds).sort((a,b)=>a-b);
                const median=sortedTimes[Math.floor(sortedTimes.length/2)]||0;
                const quickErrors=errors.filter(item=>item.seconds<median*.7);
                const slowErrors=errors.filter(item=>item.seconds>median*1.5);
                return <>
                  <p>Esta seção examina as questões individualmente, identifica em quais eixos os erros se concentraram e relaciona cada resposta incorreta ao tempo utilizado. A análise é restrita aos exercícios apresentados nesta sessão.</p>
                  {selectedReport.axes.length>1&&<div className="pdf-notice"><strong>Contraste entre eixos:</strong> maior precisão observada em {strongest.title} ({strongest.accuracy}%) e menor precisão em {weakest.title} ({weakest.accuracy}%). Essa diferença orienta a prioridade de revisão nesta amostra; não estabelece uma hierarquia estável de habilidades.</div>}
                  <div className="pdf-kpis"><div><small>Questões para revisar</small><strong>{errors.length}</strong></div><div><small>Erros abaixo da mediana temporal</small><strong>{quickErrors.length}</strong></div><div><small>Erros acima de 1,5× a mediana</small><strong>{slowErrors.length}</strong></div><div><small>Mediana de resposta</small><strong>{median}s</strong></div></div>
                  {byAxis.map(({axis,items})=><section className="pdf-axis" key={axis.axisId}>
                    <h3>{axis.title}: {items.filter(item=>!item.correct).length} erro(s) em {items.length} questão(ões)</h3>
                    {items.filter(item=>!item.correct).length ? <ul>{items.filter(item=>!item.correct).map(item=><li key={item.questionId}><strong>Enunciado:</strong> {item.prompt}<br/><strong>Alternativa selecionada:</strong> {item.selectedOption}<br/><strong>Alternativa considerada correta:</strong> {item.correctOption}<br/><strong>Tempo de resposta:</strong> {item.seconds} segundo(s)</li>)}</ul> : <p>Não houve respostas incorretas neste eixo nesta sessão. O resultado deve ser observado em outras tarefas e ocasiões antes de qualquer conclusão mais ampla.</p>}
                  </section>)}
                  <p><strong>Leitura dos tempos:</strong> {quickErrors.length?quickErrors.length+' erro(s) ocorreram em tempo inferior a 70% da mediana desta sessão. Vale verificar se houve leitura rápida, familiaridade com a tarefa ou interpretação diferente do enunciado. ':''}{slowErrors.length?slowErrors.length+' erro(s) ocorreram em tempo superior a 1,5 vez a mediana. Pode ser útil revisar a estratégia de resolução e a compreensão das pistas. ':''}{!quickErrors.length&&!slowErrors.length?'Os erros não se concentraram nos extremos temporais definidos por este critério interno. ':''}O tempo não permite, isoladamente, afirmar impulsividade, lentidão cognitiva ou qualquer condição clínica.</p>
                </>;
              })() : <div className="pdf-notice">Esta sessão não possui respostas item a item disponíveis. É possível interpretar os percentuais por eixo, mas não identificar com segurança quais enunciados e alternativas originaram cada resultado.</div>}
              <h2>4. Orientador ENAT</h2>
              <div className="advisor-panel no-print">
                <p>Gere uma explicação individual dos resultados e um conjunto de exercícios novos, escolhidos conforme os dados desta avaliação.</p>
                <button className="primary" onClick={generateAdvisor} disabled={advisorLoading}>
                  {advisorLoading ? 'Preparando orientação…' : 'Gerar orientação e exercícios personalizados'}
                </button>
                {advisorError && <p className="advisor-error">{advisorError}</p>}
              </div>
              {advisorText && <section className="advisor-output">
                <h3>Orientação personalizada</h3>
                {renderAdvisorText(advisorText)}
                <p className="advisor-disclaimer">Conteúdo educativo gerado automaticamente a partir dos registros disponíveis. Revise as orientações antes de utilizá-las em contexto de formação.</p>
              </section>}
              <h2>5. Recomendações gerais</h2>
              <ul>
                <li>Realizar as atividades em ambiente tranquilo, com boa visibilidade e sem interrupções.</li>
                <li>Praticar em sessões curtas e regulares, respeitando pausas e evitando exercícios sob fadiga.</li>
                <li>Observar resultados em novas aplicações comparáveis, sem interpretar diferenças isoladas como mudança definitiva de capacidade.</li>
                <li>Associar treinamento visual a formação adequada; exercícios na tela não substituem experiência prática supervisionada.</li>
              </ul>
              <h2>6. Plano de desenvolvimento sugerido</h2>
              <p>Nas próximas semanas, escolha uma ou duas atividades recomendadas para cada eixo avaliado, pratique em sessões breves e registre as condições de realização. Uma nova aplicação poderá ajudar a observar o desempenho em outra ocasião, mas não constitui, por si só, prova de evolução validada.</p>
              <div className="pdf-notice"><strong>Nota metodológica:</strong> este relatório é educativo e descritivo. O HSI Visual Cognitivo encontra-se em fase experimental. Os percentuais não são normas populacionais nem escores psicométricos validados. Este documento não constitui diagnóstico, laudo, avaliação de aptidão para dirigir ou certificação. Não representa o índice HSI e não substitui o HSI-DOTH-P. A integração entre instrumentos depende de estudos de validade, confiabilidade e definição de critérios.</div>
              <footer className="pdf-footer">ENAT · HSI Visual Cognitivo · Gerado a partir dos registros desta sessão · {new Date().toLocaleDateString('pt-BR')}</footer>
            </article>
          </section>
        )}

        {view === 'history' && (
          <section className="content">
            <div className="section-heading">
              <div>
                <span className="eyebrow">REGISTROS DA CONTA</span>
                <h3>Suas sessões anteriores</h3>
              </div>
              <button className="secondary" onClick={loadResults}>
                Atualizar histórico
              </button>
            </div>
            {consolidatedReport.totalAxes > 0 && (
              <div className="consolidated-report">
                <div className="report-heading">
                  <div>
                    <span className="eyebrow">RELATÓRIO GERAL · HSI VISUAL COGNITIVO</span>
                    <h3>Resultado integrado dos eixos</h3>
                    <p>Um único documento reúne o resultado mais recente de cada eixo realizado, mesmo quando as sessões ocorreram separadamente.</p>
                  </div>
                  <span className="report-coverage">{consolidatedReport.totalAxes}/6 eixos</span>
                </div>
                <div className="report-metrics">
                  <div><small>Precisão descritiva</small><strong>{consolidatedReport.accuracy}%</strong></div>
                  <div><small>Acertos</small><strong>{consolidatedReport.correct}/{consolidatedReport.totalQuestions}</strong></div>
                  <div><small>Tempo médio por questão</small><strong>{consolidatedReport.averageSeconds}s</strong></div>
                </div>
                <div className="report-axis-list">
                  {axes.map(axis => {
                    const row = consolidatedReport.rows.find(item => item.axis.axisId === axis.id);
                    return (
                      <div className="report-axis-row" key={axis.id}>
                        <div><strong>{axis.title}</strong><small>{row ? row.axis.correct + '/' + row.axis.total + ' acertos · sessão de ' + new Date(row.result.completedAt).toLocaleString('pt-BR') : 'Ainda sem registro'}</small></div>
                        <b>{row ? row.axis.accuracy + '%' : '—'}</b>
                      </div>
                    );
                  })}
                </div>
                <div className="report-method">
                  <strong>Importante:</strong> este panorama resume desempenho e tempo nos exercícios. Não é um escore HSI, não substitui o HSI-DOTH-P e não classifica aptidão para dirigir. A conversão em índice exige modelo de pontuação, estudos de validade e confiabilidade.
                </div>
                <div className="history-document-actions"><button className="secondary" onClick={openConsolidatedAdvisor}>✦ Gerar orientação educativa</button><button className="primary" onClick={openConsolidatedReport}>▤ {consolidatedReport.accuracy === 100 ? 'Gerar parecer geral para impressão' : 'Gerar relatório geral para impressão'}</button></div>
              </div>
            )}
            {results.length === 0 ? (
              <div className="empty-state">
                <div>◷</div>
                <h3>Nenhuma avaliação registrada</h3>
                <p>
                  Quando você concluir uma sessão, os resultados aparecerão
                  aqui.
                </p>
                <button className="primary" onClick={() => setView('home')}>
                  Começar avaliação
                </button>
              </div>
            ) : (
              <div className="history-list">
                {results.map(r => (
                  <article className="history-card" key={r.id}>
                    <div>
                      <span className="eyebrow">
                        {new Date(r.completedAt).toLocaleString('pt-BR')}
                      </span>
                      <h3>{r.mode}</h3>
                      <p>
                        Código: {r.participantCode} · {r.totalQuestions}{' '}
                        exercícios · {formatTime(r.durationSeconds)}
                      </p>
                    </div>
                    <div className="history-score">
                      <strong>{r.accuracy}%</strong>
                      <small>precisão</small>
                      <button className="secondary history-opinion-button" onClick={() => openReport(r)}>Ver parecer individual</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <InstrumentHistory cognitiveResults={results} />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
