import React from 'react';
import { createRoot } from 'react-dom/client';
import './public.css';

const axes = [
  ['01','Raciocínio lógico','Organização de relações, regras e resolução de problemas.'],
  ['02','Atenção seletiva','Identificação de estímulos relevantes em meio a distratores.'],
  ['03','Percepção de padrões','Reconhecimento de regularidades, sequências e mudanças.'],
  ['04','Antecipação de situações','Leitura de pistas e projeção de cenários possíveis.'],
  ['05','Percepção de riscos no trânsito','Reconhecimento de conflitos e vulnerabilidades viárias.'],
  ['06','Tomada de decisão','Escolhas prudentes diante de situações e alternativas.']
];

function PublicHome() {
 return <div className="site">
  <header className="nav"><a className="brand" href="#" aria-label="HSI Visual Cognitivo — ENAT"><img className="brand-logo" src="/assets/hsi-visual-cognitivo.webp" alt="HSI Visual Cognitivo" /></a><nav className="nav-actions"><a className="nav-link" href="#metodologia">Metodologia</a><a className="nav-access" href="/app.html">Acessar plataforma</a></nav></header>
  <main>
   <section className="hero"><div className="hero-copy"><span className="eyebrow">AMBIENTE DE AVALIAÇÃO EXPERIMENTAL</span><h1>Cognição, percepção e decisões no contexto do trânsito.</h1><p>Uma plataforma de exercícios visuais estruturados para observar padrões de resposta, precisão e tempo de execução em seis eixos cognitivos relacionados à mobilidade segura.</p><div className="hero-actions"><a className="primary" href="/app.html">Acessar área de avaliação <span>→</span></a><a className="secondary" href="#metodologia">Conhecer a metodologia</a></div><div className="hero-note"><span className="dot"></span> Ambiente público de apresentação · ENAT</div></div><div className="visual" aria-hidden="true"><div className="ring r1"></div><div className="ring r2"></div><div className="ring r3"></div><div className="core"><b>HSI</b><small>VISUAL<br/>COGNITIVO</small></div><span className="node n1">◎</span><span className="node n2">△</span><span className="node n3">◇</span></div></section>
   <section className="stats"><div><b>30</b><span>exercícios visuais</span></div><div><b>06</b><span>eixos de observação</span></div><div><b>01</b><span>ambiente integrado</span></div><div><b>ENAT</b><span>base educacional</span></div></section>
   <section className="section" id="eixos"><div className="section-head"><span className="eyebrow">ESTRUTURA DO INSTRUMENTO</span><h2>Seis eixos de observação cognitiva</h2><p>Os exercícios são organizados em seis dimensões complementares. Cada eixo aborda uma habilidade distinta, sem reduzir a complexidade do comportamento humano a uma única pontuação.</p></div><div className="axis-grid">{axes.map(([n,t,d])=><article className="axis" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
   <section className="method" id="metodologia"><div><span className="eyebrow">COMPROMISSO METODOLÓGICO</span><h2>Dados para reflexão e desenvolvimento educacional.</h2></div><div><p>A plataforma foi concebida como instrumento complementar de observação e aprendizagem. Os registros de desempenho podem apoiar análises individuais e estudos coletivos, desde que interpretados conforme os critérios metodológicos, o tamanho da amostra e as limitações do instrumento.</p><p>Os resultados experimentais não constituem diagnóstico psicológico, laudo, certificação, avaliação de aptidão ou autorização para dirigir.</p></div></section>
   <section className="access"><span className="eyebrow">AMBIENTE DE AVALIAÇÃO</span><h2>Entre na plataforma HSI</h2><p>Acesse a área autenticada para realizar exercícios, consultar resultados e utilizar os recursos disponíveis conforme seu perfil de acesso.</p><a className="primary" href="/app.html">Entrar na plataforma <span>→</span></a></section>
  </main>
  <footer><img className="footer-logo" src="/assets/hsi-visual-cognitivo.webp" alt="HSI Visual Cognitivo" /><span>Ensino Neuroeducacional Aplicado ao Trânsito</span><small>Plataforma experimental</small></footer>
 </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><PublicHome /></React.StrictMode>);
