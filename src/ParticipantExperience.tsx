import React from 'react';

type Props = {
  participantName: string;
  publicAccess: boolean;
  participantCode?: string;
  cognitiveApplications: number;
  behavioralApplications: number;
  onStartCognitive: () => void;
  onStartBehavioral: () => void;
  onHistory: () => void;
  onPrivacy: () => void;
};

export default function ParticipantExperience({
  participantName, publicAccess, participantCode, cognitiveApplications, behavioralApplications,
  onStartCognitive, onStartBehavioral, onHistory, onPrivacy
}: Props) {
  return (
    <section className="participant-experience" aria-labelledby="participant-welcome">
      <div className="participant-welcome">
        <div className="participant-welcome-copy">
          <span className="eyebrow">AMBIENTE DE AVALIAÇÃO · ENAT</span>
          <h1 id="participant-welcome">Olá{participantName ? `, ${participantName.split(' ')[0]}` : ''}.<br/><em>Sua jornada começa aqui.</em></h1>
          <p>Escolha o instrumento que deseja responder. Cada avaliação tem um objetivo próprio e apresenta uma devolutiva individual, com linguagem clara e limites metodológicos explícitos.</p>
          <div className="participant-welcome-actions">
            <button className="participant-primary" onClick={onStartBehavioral}>Começar avaliação comportamental <span aria-hidden="true">→</span></button>
            <button className="participant-quiet" onClick={onHistory}>Ver meu histórico</button>
          </div>
        </div>
        <div className="participant-welcome-art" aria-hidden="true">
          <div className="participant-art-ring ring-a"/><div className="participant-art-ring ring-b"/>
          <div className="participant-art-core"><b>HSI</b><span>VISUAL<br/>COGNITIVO</span></div>
          <i className="art-node node-a">◎</i><i className="art-node node-b">◇</i><i className="art-node node-c">↗</i>
        </div>
      </div>

      {publicAccess && participantCode && <section className="participant-code-card" aria-label="Código privado de participação">
        <div><span className="eyebrow">SEU ACESSO PESSOAL</span><strong>Código privado de participação</strong><p>Guarde este código para retomar seu histórico em outro dispositivo. Não o compartilhe.</p><code>{participantCode}</code></div>
        <button className="participant-secondary" onClick={() => navigator.clipboard.writeText(participantCode)}>Copiar código</button>
      </section>}

      <div className="participant-section-title"><div><span className="eyebrow">INSTRUMENTOS DISPONÍVEIS</span><h2>O que você deseja avaliar?</h2><p>Leia a descrição e escolha por onde começar. Você pode realizar os dois instrumentos em momentos diferentes.</p></div><span className="participant-separate-note">Instrumentos independentes</span></div>

      <div className="participant-instrument-grid">
        <article className="participant-instrument-card behavioral">
          <div className="participant-card-top"><span className="participant-icon" aria-hidden="true">◉</span><span className="participant-type">AUTOAVALIAÇÃO · COMPORTAMENTAL</span></div>
          <h3>HSI-DOTH-P</h3>
          <p className="participant-card-lead">Compreenda padrões de comportamento em diferentes situações da vida.</p>
          <div className="participant-facts"><span><b>25</b> afirmações</span><span><b>5</b> dimensões</span><span><b>1–5</b> escala de resposta</span></div>
          <ul><li>Decisão e organização</li><li>Gestão do tempo e humanização</li><li>Padrões psicocomportamentais</li></ul>
          <div className="participant-card-foot"><span>{behavioralApplications} {behavioralApplications === 1 ? 'aplicação concluída' : 'aplicações concluídas'}</span><button className="participant-primary" onClick={onStartBehavioral}>Conhecer e iniciar <span aria-hidden="true">→</span></button></div>
        </article>
        <article className="participant-instrument-card cognitive">
          <div className="participant-card-top"><span className="participant-icon" aria-hidden="true">▦</span><span className="participant-type">EXERCÍCIOS · COGNITIVO</span></div>
          <h3>HSI Visual Cognitivo</h3>
          <p className="participant-card-lead">Explore seu desempenho em tarefas visuais e de raciocínio, observando precisão e tempo de resposta.</p>
          <div className="participant-facts"><span><b>30</b> exercícios</span><span><b>6</b> eixos</span><span><b>≈</b> tempo variável</span></div>
          <ul><li>Raciocínio lógico e atenção seletiva</li><li>Percepção de padrões e antecipação</li><li>Percepção de riscos e tomada de decisão</li></ul>
          <div className="participant-card-foot"><span>{cognitiveApplications} {cognitiveApplications === 1 ? 'aplicação concluída' : 'aplicações concluídas'}</span><button className="participant-primary" onClick={onStartCognitive}>Conhecer e iniciar <span aria-hidden="true">→</span></button></div>
        </article>
      </div>

      <section className="participant-how"><div><span className="eyebrow">COMO FUNCIONA</span><h2>Uma etapa de cada vez</h2></div><div className="participant-how-steps"><article><b>01</b><strong>Escolha</strong><p>Selecione o instrumento e leia as orientações antes de começar.</p></article><article><b>02</b><strong>Responda</strong><p>Avance no seu ritmo e acompanhe o progresso durante a aplicação.</p></article><article><b>03</b><strong>Revise</strong><p>Confira suas respostas e confirme antes de enviar.</p></article><article><b>04</b><strong>Compreenda</strong><p>Consulte a devolutiva e o histórico de cada instrumento separadamente.</p></article></div></section>

      <div className="participant-privacy-strip"><span aria-hidden="true">⌑</span><p><strong>Seus dados e sua privacidade</strong><br/>As avaliações são independentes. O uso das respostas em pesquisa é opcional e não interfere na sua devolutiva individual.</p><button className="participant-quiet" onClick={onPrivacy}>Privacidade e meus dados →</button></div>
      <p className="participant-method-note">Nota metodológica: os instrumentos possuem finalidades e escalas próprias. Os resultados são descritivos e experimentais; não constituem diagnóstico clínico, laudo, certificação ou decisão sobre aptidão.</p>
    </section>
  );
}
