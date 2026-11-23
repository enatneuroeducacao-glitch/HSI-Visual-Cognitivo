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

const dothpContextScenarios: Record<string,Record<string,string[]>> = {
  "cotidiano": {
    "decision": [
      "decidir como organizar um compromisso pessoal",
      "escolher entre alternativas para resolver um imprevisto doméstico",
      "avaliar uma compra ou gasto importante",
      "decidir como responder a uma divergência pessoal",
      "escolher quando pedir ajuda para resolver uma situação cotidiana"
    ],
    "organization": [
      "organizar tarefas e compromissos da semana",
      "separar prioridades domésticas e pessoais",
      "preparar o que será necessário para uma atividade",
      "reorganizar a rotina quando surge um imprevisto",
      "acompanhar tarefas que ficaram pendentes"
    ],
    "time": [
      "calcular o tempo para chegar a um compromisso",
      "distribuir tarefas ao longo do dia",
      "avisar que um compromisso sofrerá atraso",
      "evitar deixar uma tarefa pessoal para a última hora",
      "reservar tempo para pausas e descanso"
    ],
    "humanization": [
      "ouvir alguém da família ou do círculo pessoal",
      "considerar o efeito de uma escolha sobre outra pessoa",
      "resolver uma divergência entre pessoas próximas",
      "agir diante de uma necessidade que não é sua",
      "manter respeito durante uma situação frustrante"
    ],
    "psychocomportamental": [
      "lidar com uma mudança inesperada na rotina",
      "reagir a uma crítica de alguém próximo",
      "perceber irritação durante uma tarefa cotidiana",
      "interromper uma reação impulsiva em uma discussão",
      "refletir após um conflito pessoal"
    ]
  },
  "trabalho": {
    "decision": [
      "escolher como encaminhar uma demanda profissional",
      "avaliar consequências de uma decisão para a equipe",
      "rever uma decisão após receber novos dados de trabalho",
      "responder a uma cobrança urgente",
      "buscar orientação diante de uma tarefa profissional desconhecida"
    ],
    "organization": [
      "priorizar demandas simultâneas da equipe",
      "organizar documentos e informações de trabalho",
      "replanejar uma entrega após mudança de escopo",
      "iniciar uma tarefa sem todos os recursos disponíveis",
      "acompanhar entregas e pendências profissionais"
    ],
    "time": [
      "estimar a duração de uma atividade profissional",
      "organizar reuniões e prazos de entrega",
      "comunicar risco de atraso a colegas ou clientes",
      "iniciar uma entrega antes do prazo limite",
      "equilibrar produtividade, pausas e descanso"
    ],
    "humanization": [
      "ouvir um colega com opinião diferente",
      "considerar impactos de uma decisão sobre clientes e equipe",
      "mediar um conflito profissional",
      "agir quando um problema afeta outro setor",
      "manter respeito sob pressão por resultados"
    ],
    "psychocomportamental": [
      "lidar com mudanças urgentes de prioridade",
      "receber feedback crítico",
      "perceber sinais de estresse durante o expediente",
      "evitar responder impulsivamente a uma cobrança",
      "refletir após um conflito de trabalho"
    ]
  },
  "educacao": {
    "decision": [
      "escolher uma estratégia para compreender um conteúdo",
      "avaliar consequências de uma decisão em um trabalho em grupo",
      "mudar uma estratégia após perceber um erro",
      "responder a uma questão difícil durante uma avaliação",
      "pedir orientação quando não compreende uma atividade"
    ],
    "organization": [
      "planejar tarefas e materiais de estudo",
      "organizar anotações e conteúdos de aprendizagem",
      "reorganizar o cronograma após uma dificuldade",
      "começar um trabalho sem conferir instruções e materiais",
      "acompanhar atividades e conteúdos já estudados"
    ],
    "time": [
      "estimar quanto tempo exige estudar um conteúdo",
      "organizar horários de estudo e avaliações",
      "avisar sobre dificuldade para cumprir um prazo acadêmico",
      "iniciar um trabalho antes da data de entrega",
      "equilibrar estudo, pausas e descanso"
    ],
    "humanization": [
      "ouvir um colega durante uma atividade colaborativa",
      "considerar como sua participação afeta a aprendizagem do grupo",
      "resolver divergência em trabalho coletivo",
      "apoiar alguém com dificuldade de aprendizagem",
      "respeitar colegas e professores em momentos de frustração"
    ],
    "psychocomportamental": [
      "lidar com uma nota abaixo da expectativa",
      "receber correção ou crítica sobre uma atividade",
      "perceber ansiedade diante de uma avaliação",
      "evitar desistir ou reagir impulsivamente diante de erro",
      "refletir sobre como reagiu a uma dificuldade de aprendizagem"
    ]
  },
  "familia": {
    "decision": [
      "decidir como dividir uma responsabilidade familiar",
      "avaliar o impacto de uma escolha sobre familiares",
      "rever um acordo diante de nova necessidade da família",
      "responder durante uma discussão familiar",
      "buscar diálogo antes de decidir algo que afeta a casa"
    ],
    "organization": [
      "organizar tarefas e responsabilidades da casa",
      "manter compromissos e informações familiares acessíveis",
      "reorganizar a rotina quando alguém precisa de apoio",
      "preparar recursos antes de uma atividade familiar",
      "acompanhar tarefas e compromissos compartilhados"
    ],
    "time": [
      "planejar horários de cuidados e compromissos familiares",
      "conciliar demandas familiares e pessoais",
      "avisar familiares quando não conseguirá cumprir um horário",
      "antecipar preparativos de uma atividade familiar",
      "equilibrar responsabilidades, convivência e descanso"
    ],
    "humanization": [
      "ouvir a opinião de um familiar com quem discorda",
      "considerar necessidades de diferentes gerações",
      "resolver conflitos sem desqualificar outra pessoa",
      "oferecer apoio quando alguém da família precisa",
      "manter respeito em momentos de tensão familiar"
    ],
    "psychocomportamental": [
      "lidar com mudança inesperada nos planos familiares",
      "receber uma crítica de alguém da família",
      "perceber irritação durante uma conversa difícil",
      "evitar reagir impulsivamente em uma discussão",
      "refletir depois de uma situação de conflito familiar"
    ]
  },
  "social": {
    "decision": [
      "escolher como agir diante de um problema comunitário",
      "avaliar consequências de uma decisão em espaço coletivo",
      "rever uma posição após ouvir moradores ou participantes",
      "responder a uma divergência em reunião comunitária",
      "buscar informações antes de apoiar uma iniciativa pública"
    ],
    "organization": [
      "organizar tarefas em uma ação comunitária",
      "planejar participação em atividades coletivas",
      "reorganizar uma ação quando há imprevistos",
      "preparar materiais e recursos para uma iniciativa",
      "acompanhar compromissos assumidos com o grupo"
    ],
    "time": [
      "estimar o tempo necessário para uma atividade comunitária",
      "organizar horários de participação coletiva",
      "comunicar ausência ou atraso em compromisso público",
      "antecipar tarefas para uma ação comunitária",
      "equilibrar participação social e outras responsabilidades"
    ],
    "humanization": [
      "ouvir pessoas com experiências diferentes das suas",
      "considerar impactos de suas atitudes na comunidade",
      "resolver divergências em espaços coletivos",
      "agir diante de uma necessidade de interesse público",
      "respeitar pessoas durante debates e desacordos"
    ],
    "psychocomportamental": [
      "lidar com discordância em reunião pública",
      "receber críticas em uma atividade coletiva",
      "perceber reações emocionais em debate",
      "evitar responder impulsivamente em conflito social",
      "refletir sobre sua postura após uma discussão pública"
    ]
  },
  "digital": {
    "decision": [
      "decidir se deve compartilhar uma informação online",
      "avaliar consequências de uma publicação para outras pessoas",
      "rever uma opinião após checar uma informação digital",
      "responder a uma mensagem provocativa",
      "buscar confirmação antes de clicar ou compartilhar conteúdo"
    ],
    "organization": [
      "organizar arquivos, mensagens e tarefas digitais",
      "priorizar notificações e demandas online",
      "reorganizar tarefas após interrupções digitais",
      "preparar arquivos e recursos antes de uma atividade online",
      "acompanhar pendências em diferentes plataformas"
    ],
    "time": [
      "estimar o tempo gasto em atividades digitais",
      "organizar períodos de conexão e desconexão",
      "avisar quando uma entrega digital sofrerá atraso",
      "evitar adiar tarefas por excesso de navegação",
      "equilibrar tempo de tela, pausas e descanso"
    ],
    "humanization": [
      "ouvir uma opinião divergente em debate online",
      "considerar efeitos de uma publicação sobre terceiros",
      "resolver um conflito em mensagens ou redes sociais",
      "evitar expor alguém sem considerar consequências",
      "manter respeito em comentários e conversas digitais"
    ],
    "psychocomportamental": [
      "lidar com uma notícia que provoca forte reação",
      "receber crítica ou comentário ofensivo online",
      "perceber impulsos ao acompanhar notificações",
      "evitar responder imediatamente a uma provocação",
      "refletir após uma discussão em ambiente digital"
    ]
  },
  "transito": {
    "decision": [
      "escolher uma rota ou forma de deslocamento",
      "avaliar consequências de uma manobra para outros usuários da via",
      "rever uma decisão diante de sinalização ou risco novo",
      "responder à pressão de outros condutores",
      "buscar informação antes de realizar um deslocamento desconhecido"
    ],
    "organization": [
      "planejar rota, horários e condições do deslocamento",
      "preparar documentos e itens necessários antes de sair",
      "reorganizar o trajeto diante de bloqueio ou imprevisto",
      "verificar condições do veículo antes do percurso",
      "acompanhar compromissos e etapas de uma viagem"
    ],
    "time": [
      "estimar o tempo de deslocamento considerando o trânsito",
      "organizar horários para evitar pressa na via",
      "avisar sobre atraso sem tentar compensá-lo com velocidade",
      "sair com antecedência para um compromisso",
      "equilibrar tempo de viagem, pausas e descanso"
    ],
    "humanization": [
      "respeitar pedestres, ciclistas e outros condutores",
      "considerar como sua condução afeta pessoas vulneráveis",
      "resolver conflitos sem disputa de espaço na via",
      "facilitar a circulação segura de outros usuários",
      "manter respeito mesmo em congestionamentos"
    ],
    "psychocomportamental": [
      "lidar com congestionamento ou atraso no trajeto",
      "receber uma provocação de outro usuário da via",
      "perceber irritação enquanto conduz ou se desloca",
      "evitar uma reação impulsiva diante de manobra alheia",
      "refletir depois de uma situação de conflito no trânsito"
    ]
  },
  "integrado": {
    "decision": [
      "tomar uma decisão que afeta mais de uma área da vida",
      "avaliar consequências pessoais, profissionais e coletivas",
      "rever uma escolha quando o contexto muda",
      "responder a uma situação de pressão em qualquer ambiente",
      "buscar orientação quando uma decisão envolve diferentes responsabilidades"
    ],
    "organization": [
      "organizar responsabilidades pessoais e profissionais",
      "definir prioridades entre demandas de diferentes ambientes",
      "replanejar compromissos após um imprevisto",
      "preparar recursos para tarefas em contextos distintos",
      "acompanhar metas e tarefas de diferentes áreas da vida"
    ],
    "time": [
      "estimar o tempo de atividades em diferentes ambientes",
      "distribuir horários entre trabalho, estudo, família e vida pessoal",
      "comunicar atrasos a pessoas envolvidas em contextos distintos",
      "antecipar tarefas de diferentes responsabilidades",
      "equilibrar demandas, deslocamentos e descanso"
    ],
    "humanization": [
      "ouvir pessoas com diferentes papéis na sua vida",
      "considerar impactos de suas atitudes em diferentes ambientes",
      "resolver conflitos pessoais, profissionais ou coletivos",
      "agir com consideração mesmo quando o problema não é diretamente seu",
      "manter respeito em diferentes relações e situações"
    ],
    "psychocomportamental": [
      "lidar com uma mudança inesperada em qualquer contexto",
      "receber crítica em ambientes pessoais ou profissionais",
      "perceber emoções que influenciam suas decisões",
      "evitar respostas impulsivas em situações de pressão",
      "refletir sobre reações em diferentes áreas da vida"
    ]
  }
};

export function getDothpContextQuestion(context:string,dimensionId:string,dimensionItemIndex:number,baseStatement:string):string {
  const scenario=dothpContextScenarios[context]?.[dimensionId]?.[dimensionItemIndex] || dothpContextScenarios.cotidiano[dimensionId][dimensionItemIndex];
  return baseStatement + ' Considere especificamente situações em que você precisa ' + scenario + '.';
}
