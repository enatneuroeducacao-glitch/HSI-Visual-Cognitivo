import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';

type CognitiveResult = { id:string; completedAt:string; accuracy:number; correct:number; totalQuestions:number; axes:Array<{axisId:string;title:string;accuracy:number;correct:number;total:number}> };
type InstrumentAnswer = { index:number; dimensionId:string; statement:string; response:number; scoredResponse:number; reverseScored:boolean };
type Dimension = { id:string; name:string; subtitle:string; mean:number; score:number; answered:number; interpretation:string };
type InstrumentResult = { id:string; instrument:string; context:string; completedAt:string; answers:InstrumentAnswer[]; dimensions:Dimension[] };

const contexts:Record<string,string> = { cotidiano:'Vida cotidiana e relações pessoais', trabalho:'Trabalho e ambiente profissional', educacao:'Estudos e aprendizagem', familia:'Família e convivência', social:'Comunidade e participação social', digital:'Ambientes digitais', transito:'Mobilidade e trânsito', integrado:'Diferentes contextos' };
const responseLabels:Record<number,string> = {1:'Discordo totalmente',2:'Discordo parcialmente',3:'Nem concordo nem discordo',4:'Concordo parcialmente',5:'Concordo totalmente'};

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
      return <article className="instrument-record" key={result.id}>
        <div className="instrument-record-head"><div><span className="eyebrow">{date.toLocaleString('pt-BR')}</span><h4>{result.instrument}</h4><p>Contexto: {contexts[result.context]||result.context} · 25 afirmações · 5 dimensões</p></div><button className="secondary no-print" onClick={()=>window.print()}>Imprimir parecer</button></div>
        <section className="instrument-opinion"><h4>Parecer geral da aplicação</h4><p>Este registro reúne as respostas autorreferidas do participante no contexto de <strong>{contexts[result.context]||result.context}</strong>. Os resultados descrevem a frequência declarada de comportamentos relacionados a decisão, organização, tempo, humanização e aspectos psicocomportamentais. Devem ser interpretados à luz das situações vividas pelo participante, e não como características fixas.</p></section>
        {latestCognitive&&<section className="instrument-crossread"><h4>Leitura conjunta com o HSI Visual Cognitivo</h4><p>O HSI-DOTH-P registra percepções e comportamentos autorreferidos; o HSI Visual Cognitivo registra respostas a tarefas estruturadas. São fontes complementares, mas distintas, e seus percentuais não devem ser somados nem convertidos em um único índice.</p><p>{days!==null&&days<=30?'A avaliação cognitiva mais recente ocorreu a '+days+' dia(s) desta aplicação. A proximidade temporal permite visualizar os registros lado a lado, sem presumir relação causal entre eles.':'A avaliação cognitiva mais recente não foi realizada no mesmo período (diferença de '+days+' dias). A comparação deve considerar essa distância temporal.'}</p><div className="instrument-cognitive-snapshot"><div><small>Última avaliação cognitiva</small><strong>{latestCognitive.accuracy}%</strong><span>{latestCognitive.correct}/{latestCognitive.totalQuestions} acertos · {new Date(latestCognitive.completedAt).toLocaleDateString('pt-BR')}</span></div><div><small>Eixos registrados</small><strong>{latestCognitive.axes.length}/6</strong><span>{latestCognitive.axes.map(a=>a.title).join(' · ')}</span></div></div></section>}
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
