export const dothpContextLabels: Record<string,string> = {
  cotidiano:'Vida cotidiana e relações pessoais', trabalho:'Trabalho e ambiente profissional',
  educacao:'Estudos e aprendizagem', familia:'Família e convivência',
  social:'Comunidade e participação social', digital:'Ambientes digitais',
  transito:'Mobilidade e trânsito', integrado:'Diferentes contextos da vida'
};

export const dothpContextHints: Record<string,Record<string,string>> = {
  cotidiano:{
    decision:'Considere escolhas de rotina, compromissos pessoais, consumo, convivência e resolução de imprevistos.',
    organization:'Considere organização da rotina, tarefas domésticas, compromissos, prioridades e acompanhamento do que precisa ser feito.',
    time:'Considere pontualidade, distribuição do tempo pessoal, compromissos, descanso e equilíbrio da rotina.',
    humanization:'Considere relações pessoais, divergências, respeito, escuta e impactos das suas atitudes sobre outras pessoas.',
    psychocomportamental:'Considere situações cotidianas de frustração, pressão, mudança de planos e reações emocionais.'
  },
  trabalho:{
    decision:'Considere decisões profissionais, prioridades, solução de problemas, comunicação e consequências para a equipe ou clientes.',
    organization:'Considere planejamento de tarefas, organização de processos, cumprimento de responsabilidades e gestão de recursos de trabalho.',
    time:'Considere prazos, reuniões, pontualidade, ritmo de trabalho, pausas e equilíbrio entre demandas profissionais.',
    humanization:'Considere relações com colegas, lideranças, equipes, clientes e pessoas afetadas pelas decisões profissionais.',
    psychocomportamental:'Considere pressão por resultados, feedback, conflitos, mudanças de prioridade e autorregulação no ambiente profissional.'
  },
  educacao:{
    decision:'Considere escolhas de aprendizagem, resolução de dificuldades, participação em atividades e busca de orientação.',
    organization:'Considere planejamento de estudos, materiais, tarefas, trabalhos, metas e acompanhamento da aprendizagem.',
    time:'Considere rotina de estudos, prazos, avaliações, distribuição do tempo e pausas para aprendizagem.',
    humanization:'Considere convivência com colegas, professores, diferenças de opinião, colaboração e respeito no ambiente educacional.',
    psychocomportamental:'Considere situações de avaliação, erros, frustração, dificuldades de aprendizagem e reação a desafios acadêmicos.'
  },
  familia:{
    decision:'Considere decisões compartilhadas, divisão de responsabilidades, resolução de problemas e efeitos sobre familiares.',
    organization:'Considere tarefas domésticas, compromissos familiares, planejamento conjunto e organização de responsabilidades.',
    time:'Considere horários, cuidados, compromissos familiares, disponibilidade e equilíbrio entre necessidades da família e pessoais.',
    humanization:'Considere escuta, respeito entre gerações, divergências, cuidado e consideração pelas necessidades dos familiares.',
    psychocomportamental:'Considere conflitos familiares, frustrações, mudanças na rotina e formas de regular suas reações.'
  },
  social:{
    decision:'Considere decisões em espaços coletivos, participação comunitária, uso de serviços e consequências para a comunidade.',
    organization:'Considere participação em iniciativas, compromissos coletivos, planejamento de ações e organização comunitária.',
    time:'Considere horários de atividades coletivas, compromissos comunitários e conciliação com outras responsabilidades.',
    humanization:'Considere diversidade, convivência pública, respeito às diferenças, cooperação e impacto coletivo das atitudes.',
    psychocomportamental:'Considere divergências públicas, pressão de grupo, situações de tensão e respostas emocionais em espaços coletivos.'
  },
  digital:{
    decision:'Considere compartilhamento de conteúdo, privacidade, compras, interações, segurança e decisões tomadas em plataformas digitais.',
    organization:'Considere organização de informações, arquivos, tarefas digitais, notificações e gestão de múltiplas plataformas.',
    time:'Considere tempo de tela, interrupções, prazos digitais, alternância de tarefas e equilíbrio entre atividades conectadas e desconectadas.',
    humanization:'Considere comentários, debates, comunicação escrita, respeito, exposição de terceiros e consequências das interações online.',
    psychocomportamental:'Considere reações a mensagens, críticas, notícias, notificações, comparação social e conflitos em ambientes digitais.'
  },
  transito:{
    decision:'Considere escolhas de deslocamento, decisões como condutor, passageiro, ciclista ou pedestre e consequências para os usuários da via.',
    organization:'Considere planejamento de trajetos, preparação para deslocamentos, manutenção de compromissos e organização antes de sair.',
    time:'Considere estimativa de deslocamento, pontualidade, planejamento de horários, pausas e pressão para chegar ao destino.',
    humanization:'Considere convivência entre condutores, pedestres, ciclistas, motociclistas e passageiros, com respeito e proteção mútua.',
    psychocomportamental:'Considere congestionamentos, conflitos viários, pressa, frustração, imprevistos e controle das reações durante deslocamentos.'
  },
  integrado:{
    decision:'Considere situações de diferentes áreas da vida e observe se seu processo de decisão muda conforme o ambiente.',
    organization:'Considere tarefas pessoais, profissionais, educacionais, familiares e coletivas, observando diferenças entre ambientes.',
    time:'Considere como distribui o tempo entre diferentes responsabilidades, compromissos, descanso e deslocamentos.',
    humanization:'Considere relações em diferentes ambientes e se mantém respeito e consideração pelas pessoas em situações distintas.',
    psychocomportamental:'Considere situações variadas de pressão e observe se seus gatilhos e estratégias de autorregulação mudam conforme o contexto.'
  }
};

export function getDothpContextHint(context:string,dimensionId:string):string {
  return dothpContextHints[context]?.[dimensionId] || dothpContextHints.cotidiano[dimensionId];
}
