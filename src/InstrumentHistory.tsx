import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';

type CognitiveResult = { id:string; completedAt:string; accuracy:number; correct:number; totalQuestions:number; axes:Array<{axisId:string;title:string;accuracy:number;correct:number;total:number;averageSeconds?:number}> };
type InstrumentAnswer = { index:number; dimensionId:string; statement:string; response:number; scoredResponse:number; reverseScored:boolean; contextHint?:string };
type Dimension = { id:string; name:string; subtitle:string; mean:number; score:number; answered:number; interpretation:string };
type InstrumentResult = { id:string; instrument:string; context:string; contextVersion?:string; completedAt:string; answers:InstrumentAnswer[]; dimensions:Dimension[] };

const contexts:Record<string,string> = { cotidiano:'Vida cotidiana e relações pessoais', trabalho:'Trabalho e ambiente profissional', educacao:'Estudos e aprendizagem', familia:'Família e convivência', social:'Comunidade e participação social', digital:'Ambientes digitais', transito:'Mobilidade e trânsito', integrado:'Diferentes contextos' };
const responseLabels:Record<number,string> = {1:'Discordo totalmente',2:'Discordo parcialmente',3:'Nem concordo nem discordo',4:'Concordo parcialmente',5:'Concordo totalmente'};
const dimensionGuidance:Record<string,{focus:string;question:string;practice:string}> = {
 decision:{focus:'qualidade do processo de escolha: considerar alternativas, antecipar consequências, rever decisões e buscar informação',question:'Em que tipo de situação você costuma decidir rápido demais ou, ao contrário, adiar uma escolha mesmo tendo informações suficientes?',practice:'Antes de uma decisão relevante, registre duas alternativas, consequências prováveis e a informação que ainda falta. Depois, revise se a escolha correspondeu ao que você antecipou.'},
 organization:{focus:'planejamento e monitoramento: definição de prioridades, preparação de recursos e reorganização diante de imprevistos',question:'Você costuma perder mais energia para começar, priorizar ou acompanhar a conclusão das tarefas?',practice:'No início do dia, escolha até três prioridades, liste o primeiro passo de cada uma e faça uma checagem curta do que foi concluído.'},
 time:{focus:'estimativa e gestão do tempo: previsão de duração, prevenção de atrasos, comunicação de prazos e equilíbrio entre demandas e pausas',question:'Em quais compromissos sua estimativa de tempo costuma falhar e o que normalmente interfere nela?',practice:'Compare por uma semana o tempo estimado com o tempo real de duas atividades recorrentes e ajuste sua margem de planejamento.'},
 humanization:{focus:'consideração interpessoal: escuta, respeito em divergências, compreensão de conflitos e avaliação dos efeitos das próprias atitudes',question:'Como sua postura muda quando há discordância, frustração ou quando as consequências atingem outras pessoas?',practice:'Em um conflito, descreva primeiro o ponto de vista da outra pessoa e o impacto possível da sua resposta antes de apresentar sua posição.'},
 psychocomportamental:{focus:'autopercepção e autorregulação: reconhecer gatilhos emocionais, perceber reações, modular impulsos e aprender com situações difíceis',question:'Quais situações recorrentes costumam alterar seu estado emocional e qual sinal aparece primeiro no seu comportamento?',practice:'Identifique um gatilho recorrente, o primeiro sinal corporal ou emocional e uma estratégia de pausa que possa ser usada antes de responder.'}
};
function analyzeDimension(result:InstrumentResult,d:Dimension){
 const rows=result.answers.filter(a=>a.dimensionId===d.id).sort((a,b)=>a.index-b.index);
 const positive=rows.filter(a=>a.scoredResponse>=4);
 const lower=rows.filter(a=>a.scoredResponse<=2);
 const neutral=rows.filter(a=>a.scoredResponse===3);
 const spread=rows.length?Math.max(...rows.map(a=>a.scoredResponse))-Math.min(...rows.map(a=>a.scoredResponse)):0;
 const guide=dimensionGuidance[d.id]||dimensionGuidance.decision;
 const pattern=spread>=3?'As respostas não formam um padrão uniforme: há diferenças relevantes entre afirmações desta mesma dimensão. Isso pode indicar que o comportamento varia conforme a situação ou o tipo de exigência.':positive.length>=4?'As respostas mostram concordância relativamente consistente com os comportamentos favoráveis descritos nesta dimensão. É útil verificar se essa percepção se mantém em situações de maior pressão.':lower.length>=3?'Há várias respostas com baixa concordância com os comportamentos favoráveis descritos. Isso aponta temas concretos para reflexão e desenvolvimento, não uma característica fixa da pessoa.':'O padrão é intermediário ou misto. A leitura mais útil depende das situações específicas associadas às afirmações com respostas mais altas e mais baixas.';
 return {rows,positive,lower,neutral,spread,guide,pattern};
}


export default function InstrumentHistory({ cognitiveResults }: { cognitiveResults:CognitiveResult[] }) {
  const [results,setResults]=useState<InstrumentResult[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;api.get('/api/instrument-results').then(r=>{if(active)setResults(r.data.results||[])}).catch(()=>{if(active)setError('Não foi possível carregar as avaliações comportamentais.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const latestCognitive=useMemo(()=>[...cognitiveResults].sort((a,b)=>b.completedAt.localeCompare(a.completedAt))[0],[cognitiveResults]);
  if(loading)return <section className="instrument-history"><h3>Questionários comportamentais</h3><p>Carregando registros…</p></section>;
  return <section className="instrument-history">
    <div className="instrument-history-heading"><div><span className="eyebrow">INSTRUMENTOS DE AUTORRELATO</span><h3>Questionários e pareceres comportamentais</h3><p>Respostas individuais, resultados por dimensão e interpretação descritiva de cada aplicação.</p></div><span className="instrument-count">{results.length} registro(s)</span></div>
    {error&&<div className="instrument-error" role="alert">{error}</div>}
    {!results.length&&!error&&<div className="instrument-empty">Nenhum questionário comportamental foi salvo nesta conta. As novas aplicações do HSI-DOTH-P serão registradas aqui.</div>}
    {results.map(result=>{
      const date=new Date(result.completedAt);
      const days=latestCognitive?Math.abs(Math.round((date.getTime()-new Date(latestCognitive.completedAt).getTime())/86400000)):null;
      const previous=[...results].filter(r=>r.context===result.context&&r.completedAt<result.completedAt).sort((a,b)=>b.completedAt.localeCompare(a.completedAt))[0];
      return <article className="instrument-record" key={result.id}>
        <div className="instrument-record-head"><div><span className="eyebrow">{date.toLocaleString('pt-BR')}</span><h4>{result.instrument}</h4><p>Contexto: {contexts[result.context]||result.context} · 25 afirmações · 5 dimensões · versão contextual {result.contextVersion||'1.0'}</p></div><button className="secondary no-print" onClick={()=>window.print()}>Imprimir parecer</button></div>
        <section className="instrument-opinion"><h4>Parecer analítico individual</h4><p>Esta leitura foi construída a partir do padrão das 25 respostas, incluindo concordâncias, discordâncias e diferenças entre afirmações da mesma dimensão. Ela procura indicar <strong>quais comportamentos foram mais endossados, quais merecem reflexão e onde as respostas variam</strong>, em vez de apenas repetir as notas. O conteúdo é autorrelato e não comprova, por si só, como a pessoa age em todas as situações.</p><p><strong>Contexto declarado:</strong> {contexts[result.context]||result.context}. As interpretações abaixo são específicas desta aplicação.</p></section>
        <section className="instrument-deep-reading"><h4>Síntese interpretativa do perfil</h4>
          {(()=>{const sorted=[...result.dimensions].sort((a,b)=>b.score-a.score);const top=sorted[0],bottom=sorted[sorted.length-1];const gap=top.score-bottom.score;return <><p>{gap>=35?'O perfil apresenta diferenças acentuadas entre as dimensões nesta aplicação. Isso sugere que as respostas não descrevem um padrão comportamental homogêneo: alguns conjuntos de atitudes são mais endossados do que outros.':gap>=18?'O perfil apresenta diferenças moderadas entre as dimensões. A leitura deve considerar os contextos em que cada comportamento aparece, em vez de resumir o resultado a uma nota única.':'As dimensões apresentam resultados relativamente próximos. Ainda assim, as respostas individuais podem revelar diferenças importantes que a média de cada dimensão não mostra.'}</p><p><strong>Maior pontuação nesta aplicação:</strong> {top.name} ({top.score}/100). <strong>Menor pontuação:</strong> {bottom.name} ({bottom.score}/100). A diferença entre elas é de {gap} pontos, exclusivamente descritiva.</p></>})()}
        </section>
        {latestCognitive&&<section className="instrument-crossread"><h4>Leitura conjunta com o HSI Visual Cognitivo</h4><p>O HSI-DOTH-P registra percepções e comportamentos autorreferidos; o HSI Visual Cognitivo registra respostas a tarefas estruturadas. São fontes complementares, mas distintas, e seus percentuais não devem ser somados nem convertidos em um único índice.</p><p>{days!==null&&days<=30?'A avaliação cognitiva mais recente ocorreu a '+days+' dia(s) desta aplicação. A proximidade temporal permite visualizar os registros lado a lado, sem presumir relação causal entre eles.':'A avaliação cognitiva mais recente não foi realizada no mesmo período (diferença de '+days+' dias). A comparação deve considerar essa distância temporal.'}</p><div className="instrument-cognitive-snapshot"><div><small>Última avaliação cognitiva</small><strong>{latestCognitive.accuracy}%</strong><span>{latestCognitive.correct}/{latestCognitive.totalQuestions} acertos · {new Date(latestCognitive.completedAt).toLocaleDateString('pt-BR')}</span></div><div><small>Eixos registrados</small><strong>{latestCognitive.axes.length}/6</strong><span>{latestCognitive.axes.map(a=>a.title).join(' · ')}</span></div></div><div className="instrument-cognitive-axes">{latestCognitive.axes.map(axis=><div key={axis.axisId}><span>{axis.title}</span><strong>{axis.accuracy}%</strong><small>{axis.correct}/{axis.total} acertos{axis.averageSeconds!==undefined?' · '+axis.averageSeconds+'s por questão':''}</small></div>)}</div><p className="instrument-crossread-caution"><strong>Como interpretar:</strong> compare os registros como fontes independentes. Uma resposta autorreferida em Decisão, por exemplo, não equivale automaticamente ao desempenho no eixo cognitivo Tomada de decisão. A plataforma ainda não possui estudo de validade que autorize equivalência, correlação ou cálculo conjunto entre essas medidas.</p></section>}
        {previous&&<section className="instrument-longitudinal"><h4>Comparação com a aplicação anterior no mesmo contexto</h4><p>Comparação descritiva com o registro de {new Date(previous.completedAt).toLocaleString('pt-BR')}. A variação não comprova mudança estável: pode refletir diferenças de situação, interpretação das afirmações ou momento de resposta.</p><div className="instrument-longitudinal-grid">{result.dimensions.map(d=>{const old=previous.dimensions.find(x=>x.id===d.id);const delta=old?d.score-old.score:null;return <div key={d.id}><span>{d.name}</span><strong>{d.score}/100</strong><small>{delta===null?'Sem dimensão correspondente':delta===0?'Sem variação':(delta>0?'+':'')+delta+' pontos em relação à aplicação anterior'}</small></div>})}</div></section>}
        <h4 className="instrument-section-title">Análise aprofundada por dimensão</h4>
        <div className="instrument-deep-dimensions">{result.dimensions.map(d=>{const analysis=analyzeDimension(result,d);return <section className="instrument-deep-dimension" key={d.id}>
          <div className="instrument-deep-head"><div><h4>{d.name}</h4><p>{d.subtitle}</p>{analysis.rows[0]?.contextHint&&<p className="instrument-context-hint"><strong>Foco contextual desta dimensão:</strong> {analysis.rows[0].contextHint}</p>}</div><strong>{d.score}/100</strong></div>
          <div className="instrument-score-track"><i style={{width:d.score+'%'}}/></div>
          <p>{analysis.pattern}</p>
          <div className="instrument-evidence-grid">
            <div><strong>Respostas alinhadas ao sentido favorável ({analysis.positive.length})</strong>{analysis.positive.length?<ul>{analysis.positive.map(a=><li key={a.index}>{a.statement} <em>Resposta: {responseLabels[a.response]}</em></li>)}</ul>:<p>Não houve resposta na faixa superior após ajustar o sentido dos itens invertidos.</p>}</div>
            <div><strong>Respostas que merecem reflexão ({analysis.lower.length})</strong>{analysis.lower.length?<ul>{analysis.lower.map(a=><li key={a.index}>{a.statement} <em>Resposta: {responseLabels[a.response]}</em></li>)}</ul>:<p>Não houve resposta na faixa inferior após ajustar o sentido dos itens invertidos.</p>}</div>
          </div>
          {analysis.neutral.length>0&&<p className="instrument-neutral-note"><strong>Respostas intermediárias:</strong> {analysis.neutral.length} afirmação(ões) receberam resposta neutra. Isso pode representar dúvida, variação contextual ou ausência de experiência suficiente para uma posição definida.</p>}
          <p><strong>Foco interpretativo:</strong> {analysis.guide.focus}.</p>
          <p><strong>Pergunta para reflexão:</strong> {analysis.guide.question}</p>
          <p><strong>Exercício prático sugerido:</strong> {analysis.guide.practice}</p>
          <details><summary>Conferir todas as respostas e a pontuação considerada</summary><ol>{analysis.rows.map(a=><li key={a.index}><p>{a.statement}</p><span>Resposta: {responseLabels[a.response]} · valor considerado no cálculo: {a.scoredResponse}/5{a.reverseScored?' · item de sentido invertido':''}</span></li>)}</ol></details>
        </section>})}</div>
        <div className="instrument-dimensions">{result.dimensions.map(d=>{
          const answers=result.answers.filter(a=>a.dimensionId===d.id);
          return <section className="instrument-dimension" key={d.id}>
            <div className="instrument-dimension-title"><div><h4>{d.name}</h4><p>{d.subtitle}</p></div><strong>{d.score}/100</strong></div>
            <div className="instrument-score-track"><i style={{width:d.score+'%'}}/></div>
            <p className="instrument-interpretation"><strong>Interpretação:</strong> {d.interpretation}</p>
            <details><summary>Ver as cinco respostas desta dimensão</summary><ol>{answers.map(a=><li key={a.index}><p>{a.statement}</p><span>Resposta: {responseLabels[a.response]}{a.reverseScored?' · pontuação invertida para cálculo':''}</span></li>)}</ol></details>
          </section>;
        })}</div>
        <div className="instrument-method-note"><strong>Limite interpretativo:</strong> instrumento em versão piloto, sem validação psicométrica estabelecida. Os resultados não são normas populacionais, diagnóstico, laudo clínico, avaliação de personalidade, seleção profissional ou classificação de aptidão para dirigir. O HSI-DOTH-P não deve ser confundido com um escore geral HSI.</div>
      </article>;
    })}
  </section>;
}
