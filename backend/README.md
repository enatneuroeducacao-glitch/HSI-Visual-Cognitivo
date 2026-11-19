# HSI Visual Cognitivo — API independente

API Node.js/Express + Prisma + PostgreSQL. Não utiliza SDKs do AppDeploy.

## Ambiente
- Node.js 22+
- PostgreSQL 16+
- Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres)
- Variáveis de e-mail para recuperação: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- `CORS_ORIGINS`: lista separada por vírgulas
- `PUBLIC_APP_URL`: URL da aplicação usada no link de recuperação

## Render
Root Directory: `backend`
Build Command: `npm install && npx prisma generate && npm run build`
Start Command: `npx prisma migrate deploy && npm start`
Health Check Path: `/api/health`

## Primeiro administrador
Configurar temporariamente `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 12 caracteres) como variáveis e executar `npm run db:seed-admin` uma única vez. Remover `ADMIN_PASSWORD` após a criação.

## Rotas
- `GET /api/health`
- `POST /api/auth/login`, `GET /api/auth/me`
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- `GET/POST /api/users`, `PATCH /api/users/:id`
- `GET/POST /api/groups`
- `GET/POST /api/results`
- `GET /api/analytics?from=ISO&to=ISO&groupId=id`

As rotas verificam o token e os papéis no servidor. Analistas podem consultar dados coletivos e participantes; somente administradores gerenciam contas e grupos. Participantes consultam apenas os próprios resultados.

## Limitações e gates de homologação
Este primeiro corte persiste resultados recebidos e verifica coerência aritmética básica. Ainda são obrigatórios: validar respostas no servidor contra o banco oficial de questões, integrar o frontend, configurar SMTP real, criar testes automatizados de autenticação e isolamento entre usuários, revisar LGPD e executar testes de segurança. Não importar registros antigos sem exportação e reconciliação verificadas.
