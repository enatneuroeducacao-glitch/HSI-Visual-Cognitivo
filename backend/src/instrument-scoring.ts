import { getDothpContextHint, getDothpContextQuestion } from './dothp-contexts.js';

export const dothpDimensions = [
  { id: 'decision', name: 'Decisão', subtitle: 'Análise de alternativas, consequências e escolhas conscientes' },
  { id: 'organization', name: 'Organização', subtitle: 'Planejamento, prioridades, consistência e gestão de recursos' },
  { id: 'time', name: 'Tempo', subtitle: 'Percepção temporal, pontualidade, ritmo e equilíbrio de demandas' },
  { id: 'humanization', name: 'Humanização', subtitle: 'Empatia, respeito, cooperação e consideração pelo impacto sobre outras pessoas' },
  { id: 'psychocomportamental', name: 'Psicocomportamental', subtitle: 'Autopercepção, regulação emocional, padrões de reação e flexibilidade' },
] as const;

export const dothpItems = [
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
  ['psychocomportamental','Depois de uma situação difícil, costumo refletir sobre o que senti e como agi.'],
] as const;

const reverseItems = new Set([3, 8, 13, 18, 23]);

export function scoreDothp(answers: number[], context = 'cotidiano', questionSet: Array<Record<string, any>> = dothpItems.map(([dimension,prompt],index)=>({dimension,prompt,reverseScored:[3,8,13,18,23].includes(index)})), criteria: Record<string, any> = {}) {
  const dimensionPositions = new Map<string,number>();
  const reverseItems = new Set<number>((Array.isArray(criteria.reverseItems)?criteria.reverseItems:[4,9,14,19,24]).map((x:any)=>Number(x)-1));
  const normalized = questionSet.map((question, index) => {
    const dimensionId=String(question.dimension||question.dimensionId||'unknown');
    const baseStatement=String(question.prompt||question.statement||'');
    const dimensionItemIndex=dimensionPositions.get(dimensionId)||0;
    dimensionPositions.set(dimensionId,dimensionItemIndex+1);
    return {
      index,
      dimensionId,
      statement:getDothpContextQuestion(context,dimensionId,dimensionItemIndex,baseStatement),
      response:answers[index],
      scoredResponse:reverseItems.has(index)?6-answers[index]:answers[index],
      reverseScored:reverseItems.has(index),
      contextHint:getDothpContextHint(context,dimensionId),
    };
  });
  const dimensionDefinitions=Array.isArray(criteria.dimensions)&&criteria.dimensions.length?criteria.dimensions:dothpDimensions;
  const dimensions = dimensionDefinitions.map((dimension:any) => {
    const rows = normalized.filter(item => item.dimensionId === dimension.id);
    const mean = rows.length ? rows.reduce((sum, item) => sum + item.scoredResponse, 0) / rows.length : 0;
    const scaleMin=Number(criteria.scale?.min??1),scaleMax=Number(criteria.scale?.max??5);
    const scoreMin=Number(criteria.scoreRange?.min??0),scoreMax=Number(criteria.scoreRange?.max??100);
    const score = rows.length ? Math.round(scoreMin+((mean-scaleMin)/(scaleMax-scaleMin))*(scoreMax-scoreMin)) : 0;
    const low=Number(criteria.bands?.low?.maxExclusive??34),high=Number(criteria.bands?.high?.min??67);
    const interpretation = score < low
      ? 'Nesta aplicação, as respostas indicam menor frequência autorreferida de comportamentos associados a esta dimensão. Pode ser útil refletir sobre situações concretas em que esses comportamentos poderiam ser praticados.'
      : score < high
        ? 'Nesta aplicação, as respostas sugerem presença variável dos comportamentos associados a esta dimensão. Vale observar em quais contextos aparecem com maior ou menor frequência.'
        : 'Nesta aplicação, as respostas indicam maior frequência autorreferida de comportamentos associados a esta dimensão. A reflexão pode explorar como manter essa consistência em diferentes contextos.';
    return { id: dimension.id, name: dimension.name, subtitle: dimension.subtitle, mean: Number(mean.toFixed(2)), score, answered: rows.length, interpretation };
  });
  return { answers: normalized, dimensions };
}
