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

export function scoreDothp(answers: number[]) {
  const normalized = dothpItems.map(([dimensionId, statement], index) => ({
    index,
    dimensionId,
    statement,
    response: answers[index],
    scoredResponse: reverseItems.has(index) ? 6 - answers[index] : answers[index],
    reverseScored: reverseItems.has(index),
  }));
  const dimensions = dothpDimensions.map(dimension => {
    const rows = normalized.filter(item => item.dimensionId === dimension.id);
    const mean = rows.reduce((sum, item) => sum + item.scoredResponse, 0) / rows.length;
    const score = Math.round((mean - 1) * 25);
    const interpretation = score < 34
      ? 'Nesta aplicação, as respostas indicam menor frequência autorreferida de comportamentos associados a esta dimensão. Pode ser útil refletir sobre situações concretas em que esses comportamentos poderiam ser praticados.'
      : score < 67
        ? 'Nesta aplicação, as respostas sugerem presença variável dos comportamentos associados a esta dimensão. Vale observar em quais contextos aparecem com maior ou menor frequência.'
        : 'Nesta aplicação, as respostas indicam maior frequência autorreferida de comportamentos associados a esta dimensão. A reflexão pode explorar como manter essa consistência em diferentes contextos.';
    return { id: dimension.id, name: dimension.name, subtitle: dimension.subtitle, mean: Number(mean.toFixed(2)), score, answered: rows.length, interpretation };
  });
  return { answers: normalized, dimensions };
}
