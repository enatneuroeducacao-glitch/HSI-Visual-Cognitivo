# HSI Visual Cognitivo — API independente

API Node.js/Express + Prisma + PostgreSQL. Não utiliza SDKs do AppDeploy.

## Ambiente
- Node.js 22+ e PostgreSQL 16+
- Obrigatórias: `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres aleatórios)
- `CORS_ORIGINS`: origens exatas do frontend, separadas por vírgulas
- `PUBLIC_APP_URL`: URL pública do frontend para recuperação de senha
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`

Nunca reutilize banco de outro projeto. Não versione arquivos `.env` nem credenciais.

## Render — arquitetura isolada
Crie um PostgreSQL exclusivo para HSI e um Web Service para a API.
- API Root Directory: `backend`
- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && npm start`
- Health Check: `/api/health`
- Frontend Static Site: build `npm ci && npm run build`, Publish Directory `dist`, variável `VITE_API_URL` com a URL HTTPS pública da API.

Configure `DATABASE_URL` com a URL interna do PostgreSQL HSI, `JWT_SECRET` com segredo aleatório de pelo menos 32 caracteres, `CORS_ORIGINS` com a URL exata do frontend e `PUBLIC_APP_URL` com essa mesma URL pública. Não use credenciais de produção ou bancos MB Óptica/SIGES.

## Primeiro administrador
Defina temporariamente `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 12 caracteres) e execute `npm run db:seed-admin` uma única vez. O comando é um upsert e pode redefinir a senha e reativar o administrador se executado novamente. Remova `ADMIN_PASSWORD` após a criação.

## Segurança e rotas
- JWT HS256 exige o emissor `hsi-visual-cognitivo`; validade padrão de 30 minutos.
- Participantes consultam apenas os próprios resultados.
- Analistas acessam indicadores coletivos sem nomes/códigos individuais; dados cadastrais ficam restritos a administradores.
- `GET /api/questions` exige autenticação e entrega enunciados e alternativas, nunca gabarito ou explicações.
- Pontuação e indicadores são calculados no backend a partir do banco oficial de questões.
- Identificadores de resultados são únicos; reenvios recebem HTTP 409.
- `POST /api/advisor` produz orientação educativa automatizada somente a partir de resultados pertencentes à conta autenticada; não é um serviço de IA generativa.
- `GET /api/health` verifica conexão real com PostgreSQL.

Rotas principais: `/api/health`, `/api/auth/*`, `/api/questions`, `/api/users`, `/api/groups`, `/api/results`, `/api/analytics`, `/api/advisor`.

## Bloqueios antes de liberar participantes
A automação não substitui homologação funcional, revisão LGPD, análise de segurança independente, configuração/teste SMTP nem validação completa em navegador. Não importar registros antigos sem exportação e reconciliação verificadas. O HSI Visual Cognitivo é experimental: não constitui diagnóstico, laudo ou avaliação de aptidão para dirigir e não substitui o HSI-DOTH-P.
