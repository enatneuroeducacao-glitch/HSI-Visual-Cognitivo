export const questions = [
  {
    id: 'l1',
    axis: 'logic',
    prompt: 'Qual símbolo completa a sequência?',
    visual: ['○', '△', '□', '○', '△', '?'],
    options: ['○', '△', '□', '◇'],
    answer: 2,
    explanation: 'A sequência repete o ciclo círculo, triângulo e quadrado.',
  },
  {
    id: 'l2',
    axis: 'logic',
    prompt:
      'Se todos os cartões azuis são quadrados e este cartão é azul, o que podemos concluir?',
    visual: ['AZUL', '→', 'QUADRADO'],
    options: [
      'É um círculo',
      'É um quadrado',
      'É um triângulo',
      'Não é possível concluir',
    ],
    answer: 1,
    explanation: 'A conclusão decorre diretamente da regra apresentada.',
  },
  {
    id: 'l3',
    axis: 'logic',
    prompt: 'Qual número deve ocupar a posição seguinte?',
    visual: ['2', '4', '8', '16', '?'],
    options: ['18', '24', '30', '32'],
    answer: 3,
    explanation: 'Cada termo é o dobro do anterior.',
  },
  {
    id: 'l4',
    axis: 'logic',
    prompt: 'Observe a relação: ▲ está para △ assim como ■ está para…',
    visual: ['▲  →  △', '■  →  ?'],
    options: ['□', '●', '◆', '▲'],
    answer: 0,
    explanation:
      'A relação transforma a forma preenchida em sua versão vazada.',
  },
  {
    id: 'l5',
    axis: 'logic',
    prompt:
      'Três veículos chegam a um cruzamento. A ordem é: A antes de B; B antes de C. Quem chega por último?',
    visual: ['A  →  B  →  C'],
    options: ['A', 'B', 'C', 'Não há informação'],
    answer: 2,
    explanation: 'Pelas duas relações, C vem depois de A e B.',
  },

  {
    id: 'a1',
    axis: 'attention',
    prompt: 'Conte apenas as setas apontando para a direita.',
    visual: ['↑  →  ←  →', '→  ↓  →  ←', '←  →  ↑  ↓'],
    options: ['3', '4', '5', '6'],
    answer: 2,
    explanation: 'Há cinco setas apontando para a direita.',
  },
  {
    id: 'a2',
    axis: 'attention',
    prompt:
      'Selecione a única sequência que contém exatamente dois triângulos.',
    visual: ['A  ○ △ □ △', 'B  △ △ ○ □', 'C  □ ○ ○ △', 'D  △ □ ○ ○'],
    options: ['A', 'B', 'C', 'D'],
    answer: 0,
    explanation: 'A alternativa A contém dois triângulos.',
  },
  {
    id: 'a3',
    axis: 'attention',
    prompt: 'Quantas vezes aparece o número 7?',
    visual: ['7  1  7  4  2', '3  7  9  7  5', '1  2  6  8  7'],
    options: ['3', '4', '5', '6'],
    answer: 2,
    explanation: 'O número 7 aparece cinco vezes.',
  },
  {
    id: 'a4',
    axis: 'attention',
    prompt: 'Identifique o par idêntico ao modelo.',
    visual: ['MODELO:  ◇ ○ △', 'A  ◇ ○ △', 'B  ◇ △ ○', 'C  ○ ◇ △'],
    options: ['A', 'B', 'C', 'Nenhum'],
    answer: 0,
    explanation: 'Somente a alternativa A mantém formas e ordem do modelo.',
  },
  {
    id: 'a5',
    axis: 'attention',
    prompt: 'Em qual linha todas as letras são iguais?',
    visual: ['A  M M N M', 'B  P P P P', 'C  R R K R', 'D  S S S Z'],
    options: ['A', 'B', 'C', 'D'],
    answer: 1,
    explanation: 'A linha B contém apenas a letra P.',
  },

  {
    id: 'p1',
    axis: 'patterns',
    prompt: 'Qual elemento vem a seguir?',
    visual: ['● ○ ● ○ ● ?'],
    options: ['●', '○', '△', '□'],
    answer: 1,
    explanation: 'A sequência alterna círculo cheio e círculo vazio.',
  },
  {
    id: 'p2',
    axis: 'patterns',
    prompt: 'Qual painel mantém a mesma regra de preenchimento?',
    visual: ['■ □ □', '□ ■ □', '□ □ ?'],
    options: ['■', '□', '●', '△'],
    answer: 0,
    explanation: 'O quadrado preenchido avança uma posição por linha.',
  },
  {
    id: 'p3',
    axis: 'patterns',
    prompt: 'Complete a sequência de direções.',
    visual: ['↑  →  ↓  ←  ?'],
    options: ['↑', '→', '↓', '↗'],
    answer: 0,
    explanation: 'A direção gira 90 graus no sentido horário.',
  },
  {
    id: 'p4',
    axis: 'patterns',
    prompt: 'Qual número completa a sequência?',
    visual: ['1, 3, 6, 10, 15, ?'],
    options: ['18', '20', '21', '25'],
    answer: 2,
    explanation: 'Os acréscimos são 2, 3, 4, 5 e depois 6.',
  },
  {
    id: 'p5',
    axis: 'patterns',
    prompt: 'Qual grupo é diferente dos demais?',
    visual: ['A  ▲ ▲ ○', 'B  ■ ■ ○', 'C  ● ● □', 'D  ◆ ◆ ○'],
    options: ['A', 'B', 'C', 'D'],
    answer: 2,
    explanation:
      'No grupo C, os dois primeiros elementos são preenchidos e o terceiro é vazado, invertendo a relação dos demais.',
  },

  {
    id: 'an1',
    axis: 'anticipation',
    prompt:
      'Um veículo à frente aciona a luz de freio e reduz a velocidade. Qual é a conduta mais adequada?',
    visual: ['🚗  →  🚙  🛑'],
    options: [
      'Aproximar rapidamente',
      'Manter distância e observar',
      'Desviar sem verificar',
      'Acelerar para ultrapassar',
    ],
    answer: 1,
    explanation:
      'A redução de velocidade pode indicar um evento adiante; ampliar a margem de segurança permite reagir.',
  },
  {
    id: 'an2',
    axis: 'anticipation',
    prompt:
      'Uma bola surge rolando entre carros estacionados em uma rua residencial. O que deve ser antecipado?',
    visual: ['🚗  🚙  ⚽  →  ?'],
    options: [
      'A via está livre',
      'Uma criança pode surgir atrás da bola',
      'A bola sempre ficará parada',
      'O veículo deve acelerar',
    ],
    answer: 1,
    explanation: 'A bola pode anteceder a entrada de uma criança na pista.',
  },
  {
    id: 'an3',
    axis: 'anticipation',
    prompt:
      'A chuva começa e a pista fica brilhante. Qual mudança deve ser prevista?',
    visual: ['☁️  🌧️  ━━━━━'],
    options: [
      'Maior aderência',
      'Menor distância de frenagem',
      'Possível redução de aderência',
      'Ausência de risco',
    ],
    answer: 2,
    explanation:
      'A água pode reduzir a aderência e aumentar a distância necessária para parar.',
  },
  {
    id: 'an4',
    axis: 'anticipation',
    prompt:
      'Um pedestre olha para a faixa e se aproxima do meio-fio. O que o condutor deve prever?',
    visual: ['🚶  →  ▥ FAIXA ▥'],
    options: [
      'Possível travessia',
      'Que o pedestre desistiu',
      'Que não há necessidade de reduzir',
      'Que o pedestre tem obrigação de esperar',
    ],
    answer: 0,
    explanation:
      'A postura e a aproximação são pistas de uma possível travessia.',
  },
  {
    id: 'an5',
    axis: 'anticipation',
    prompt:
      'O semáforo à frente está verde há algum tempo e há fila se formando depois do cruzamento. O que considerar?',
    visual: ['🟢  🚗 🚗  | 🚙🚙🚙'],
    options: [
      'Acelerar para aproveitar o verde',
      'Pode haver bloqueio após o cruzamento',
      'O fluxo sempre seguirá',
      'A fila não interfere',
    ],
    answer: 1,
    explanation:
      'É necessário observar a área de saída e evitar entrar em cruzamento sem espaço para liberar a passagem.',
  },

  {
    id: 'r1',
    axis: 'risk',
    prompt: 'Qual situação apresenta maior risco imediato?',
    visual: ['A  🚗 ─────', 'B  🚗  🚶‍♂️ ▥', 'C  🚗  🌳', 'D  🚗  ☀️'],
    options: ['A', 'B', 'C', 'D'],
    answer: 1,
    explanation:
      'A proximidade de um pedestre junto à área de travessia exige atenção e redução compatível.',
  },
  {
    id: 'r2',
    axis: 'risk',
    prompt:
      'Um motociclista está no ponto cego do carro. Qual é o risco antes de mudar de faixa?',
    visual: ['🚗  [ ? ]  🏍️'],
    options: [
      'Nenhum risco',
      'Colisão lateral',
      'Somente atraso',
      'Aumento da visibilidade',
    ],
    answer: 1,
    explanation:
      'A mudança de faixa sem verificar o ponto cego pode gerar conflito lateral.',
  },
  {
    id: 'r3',
    axis: 'risk',
    prompt:
      'Em uma curva com árvores e muro limitando a visão, qual fator merece maior atenção?',
    visual: ['🚗  ↗  🌳🧱  ?'],
    options: [
      'Possível obstáculo oculto',
      'Ausência de usuários',
      'Pista necessariamente vazia',
      'Apenas a velocidade do motor',
    ],
    answer: 0,
    explanation:
      'A visibilidade limitada impede confirmar que o espaço adiante está livre.',
  },
  {
    id: 'r4',
    axis: 'risk',
    prompt:
      'Um veículo está parado próximo à faixa de pedestres, encobrindo parte da travessia. Qual risco existe?',
    visual: ['🚗  ▥  🚙', '       🚶  ?'],
    options: [
      'Pedestre oculto pelo veículo',
      'Aumento da iluminação',
      'Redução automática do fluxo',
      'Nenhum risco adicional',
    ],
    answer: 0,
    explanation:
      'Veículos parados podem ocultar pedestres que iniciam a travessia.',
  },
  {
    id: 'r5',
    axis: 'risk',
    prompt:
      'Ao se aproximar de uma escola no horário de saída, qual cenário deve ser considerado?',
    visual: ['🏫  🚸  🧒 🧒  🚗'],
    options: [
      'Movimentação imprevisível de crianças',
      'Ausência de travessias',
      'Velocidade livre',
      'Prioridade absoluta do veículo',
    ],
    answer: 0,
    explanation:
      'Crianças podem mudar de direção ou entrar na via de forma inesperada.',
  },

  {
    id: 'd1',
    axis: 'decision',
    prompt:
      'Você percebe que está cansado e sua atenção oscila. Qual decisão é mais segura?',
    visual: ['🚗  +  😴  →  ?'],
    options: [
      'Aumentar a velocidade',
      'Parar em local seguro e descansar',
      'Abrir a janela e seguir sem avaliar',
      'Usar o celular para se distrair',
    ],
    answer: 1,
    explanation:
      'Interromper a condução em local seguro reduz a exposição ao risco associado à fadiga.',
  },
  {
    id: 'd2',
    axis: 'decision',
    prompt:
      'A sinalização indica velocidade máxima de 40 km/h, mas o fluxo está mais rápido. O que fazer?',
    visual: ['40 km/h  |  🚗🚗🚗'],
    options: [
      'Acompanhar o fluxo',
      'Respeitar o limite e ajustar a condução',
      'Acelerar para não atrapalhar',
      'Ignorar a sinalização',
    ],
    answer: 1,
    explanation:
      'A decisão deve considerar a sinalização e as condições reais da via, não a pressão do fluxo.',
  },
  {
    id: 'd3',
    axis: 'decision',
    prompt:
      'Você perdeu uma entrada e o aplicativo sugere uma conversão imediata em local proibido. Qual decisão tomar?',
    visual: ['🧭  ↩️  🚫'],
    options: [
      'Fazer a conversão',
      'Frear bruscamente',
      'Seguir até um local permitido para reorientar',
      'Recuar na via',
    ],
    answer: 2,
    explanation:
      'É mais seguro seguir até um ponto permitido do que executar manobra proibida ou inesperada.',
  },
  {
    id: 'd4',
    axis: 'decision',
    prompt:
      'Um veículo de emergência se aproxima com sinais sonoros e luminosos. Qual é a melhor decisão?',
    visual: ['🚑  🚨  →  🚗'],
    options: [
      'Disputar espaço',
      'Facilitar a passagem com segurança',
      'Parar no meio do cruzamento',
      'Seguir sem observar',
    ],
    answer: 1,
    explanation:
      'A conduta deve facilitar a passagem sem criar outro conflito viário.',
  },
  {
    id: 'd5',
    axis: 'decision',
    prompt:
      'A visibilidade está muito reduzida por neblina. Qual escolha é mais prudente?',
    visual: ['🌫️  🚗  · · ·'],
    options: [
      'Manter a velocidade habitual',
      'Reduzir a velocidade e ampliar a distância',
      'Usar farol alto continuamente',
      'Aproximar-se do veículo à frente',
    ],
    answer: 1,
    explanation:
      'A redução de velocidade e o aumento da distância ajudam a compensar a menor visibilidade.',
  },
];