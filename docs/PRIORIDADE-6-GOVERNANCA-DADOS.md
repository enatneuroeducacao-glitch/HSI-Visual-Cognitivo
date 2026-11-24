# Prioridade 6 — Governança e proteção de dados

Versão operacional inicial: 1.1  
Status: controles de aplicação implementados; validação jurídica, configuração dos provedores e testes operacionais pendentes.

## 1. Papéis e responsabilidades a confirmar

Antes da expansão, a entidade que efetivamente determina as finalidades e os meios do tratamento deve ser formalmente identificada como controladora. ENAT é o projeto/iniciativa apresentado na interface, mas isso, isoladamente, não define a pessoa jurídica controladora.

Preencher e aprovar:
- Razão social/nome e CNPJ/CPF do controlador:
- Endereço e canal oficial:
- Encarregado ou canal de privacidade:
- Operadores e suboperadores: hospedagem/API, banco de dados, e-mail transacional, analytics/monitoramento.
- Países/regiões de armazenamento e transferências internacionais:
- Contatos para incidentes e solicitações.

Não publicar o aviso como versão final enquanto esses campos não forem confirmados.

## 2. Separação de finalidades e consentimento

- Aviso de privacidade: informa o tratamento necessário à conta, segurança, execução do instrumento e prestação do serviço.
- Consentimento de pesquisa: opção livre, destacada, específica e revogável, separada do uso necessário para registrar e devolver a avaliação.
- Cada submissão HSI-DOTH-P e HSI Visual Cognitivo envia uma escolha booleana explícita, inclusive quando negativa.
- Cada aplicação guarda a escolha, a versão do termo e a data/hora. A trilha ConsentEvent guarda concessões, recusas e retiradas.
- A recusa não impede a aplicação nem a devolutiva individual.
- Agregados de pesquisa consultam o snapshot da aplicação (researchConsentGranted=true), não a preferência atual do perfil. Assim, a retirada bloqueia aplicações futuras sem reescrever a decisão histórica da aplicação anterior.
- Aplicações antigas sem evidência verificável permanecem não consentidas para fins de novos agregados.

Versões vigentes na interface: ENAT-PRIVACY-1.1 e ENAT-RESEARCH-1.1.

## 3. Acesso, pseudonimização e exportação

- Diretório de dados cadastrais e fila de titulares: perfil ADMIN apenas.
- ANALYST recebe resultados agregados e não tem endpoint de diretório cadastral.
- Participantes públicos são apresentados com nome genérico e sem e-mail; o código privado continua sendo identificador pseudônimo, não dado anônimo.
- Exportação de dados pessoais: endpoint autenticado restrito ao próprio titular.
- Exportações de pesquisa continuam agregadas, com supressão de grupos abaixo de cinco participantes distintos.
- Acesso ao diretório, exportação pessoal e decisões administrativas geram eventos de auditoria.
- Nunca exportar lista de participantes, respostas individualizadas ou identificadores para relatórios de pesquisa.

## 4. Solicitações dos titulares

Fluxo: participante abre solicitação no centro de privacidade → sistema registra data, tipo e descrição → ADMIN analisa → registra status e justificativa/resposta → titular acompanha o andamento.

Tipos suportados: confirmação/acesso, correção, anonimização, bloqueio, exclusão, portabilidade, retirada do consentimento e informação.

A exclusão não é executada automaticamente pelo formulário. Antes de atender, verificar identidade, obrigações legais/regulatórias, direitos de terceiros, necessidade de preservação e eventuais hipóteses legais de conservação. Registrar fundamento e escopo da decisão.

## 5. Retenção e descarte — aprovação obrigatória

O módulo permite cadastrar políticas por categoria, mas não executa exclusão automática. Não adotar prazo universal sem inventário de finalidades, obrigações legais, acordos de pesquisa, necessidade de defesa de direitos e parecer jurídico.

Categorias a deliberar:
- ACCOUNT_DATA
- ASSESSMENT_RESULTS
- CONSENT_EVIDENCE
- AUDIT_LOGS
- PRIVACY_REQUESTS
- BACKUP_COPIES

Para cada categoria, documentar: finalidade, base legal, evento inicial do prazo, prazo aprovado, exceções, responsável, procedimento de descarte e evidência de execução. Aplicar descarte seguro também a cópias derivadas e backups após o ciclo de expiração tecnicamente possível.

## 6. Backups e restauração

A aplicação não deve armazenar credenciais de backup. A rotina deve ser configurada nos provedores e documentada:
1. Confirmar plano/recursos de backup e recuperação do PostgreSQL no provedor de banco.
2. Habilitar backup automatizado e, se disponível, recuperação point-in-time; definir RPO/RTO aprovados.
3. Manter cópia protegida, criptografada, com acesso mínimo e separação de credenciais.
4. Registrar cada execução, resultado, retenção e falha.
5. Pelo menos trimestralmente, restaurar uma cópia em ambiente isolado, nunca sobre produção.
6. Validar integridade relacional, contagens, migrações Prisma, autenticação, submissão de teste, agregados com consentimento e trilha de auditoria.
7. Registrar data, operador, origem do backup, duração, resultado, divergências e ação corretiva.
8. Testar também revogação de acesso e descarte no fim da retenção.

Estado atual: este repositório fornece o procedimento, mas não comprova que backups automáticos estejam habilitados no Render/Neon nem que uma restauração tenha sido executada. Isso exige conferência dos painéis e teste no ambiente do provedor.

## 7. Resposta a incidentes

Manter canal interno para suspeita de acesso indevido, perda, alteração ou divulgação. Preservar evidências, restringir credenciais comprometidas, identificar dados/titulares afetados, avaliar risco/dano, documentar decisões e acionar controlador/encarregado para avaliar comunicações exigidas pela LGPD e regulamentação da ANPD.

## 8. Checklist de liberação nacional

- [ ] Controlador, encarregado/canal e operadores formalmente identificados.
- [ ] Aviso e termo de pesquisa revisados por assessoria jurídica/encarregado.
- [ ] Bases legais mapeadas por finalidade, inclusive dados pessoais sensíveis quando aplicável.
- [ ] Inventário de dados, fluxos, compartilhamentos e transferências internacionais.
- [ ] Prazos de retenção aprovados e rotina de descarte implementada.
- [ ] Backup automatizado confirmado no provedor.
- [ ] Restauração testada e evidenciada.
- [ ] Controle de acesso e trilha de auditoria revisados.
- [ ] Exportações testadas contra vazamento de dados individuais.
- [ ] Solicitações de titulares testadas de ponta a ponta.
- [ ] Plano de incidentes e responsáveis definidos.

## Referências legais oficiais

- Lei nº 13.709/2018 (LGPD), texto compilado: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- ANPD, Guia Orientativo sobre Segurança da Informação para Agentes de Tratamento de Pequeno Porte: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-vf.pdf/%40%40download/file

Documento técnico-operacional. Não substitui avaliação jurídica do controlador nem análise de risco/impacto do tratamento.
