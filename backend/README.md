# Backend migration notes

The recovered UI currently imports `auth` and `api` from `@appdeploy/client`.
The recovered backend currently imports `router`, `json`, `error`, `db`, `requireAuth` and `ai` from `@appdeploy/sdk`.

These are AppDeploy-specific and must be replaced before the new application can run independently.

## Planned independent services

- API server: Node.js + Express (or Fastify)
- Database: PostgreSQL (Render managed PostgreSQL)
- ORM: Prisma
- Authentication: secure cookie session with hashed passwords, or a separately hosted identity provider
- AI advisor: server-side provider abstraction, API key stored only as Render secret; optional local Ollama-compatible endpoint for private/local use
- PDF: client print layout or server-generated PDF, with ENAT logos served from `public/resources`

## Existing routes to preserve

- `GET /api/results`: list the authenticated user's saved results
- `POST /api/results`: validate and persist a completed assessment
- `POST /api/advisor`: generate an educational interpretation and 3–5 new practice exercises

## Data ownership

All result reads/writes must be scoped to the authenticated account. Do not use participantCode as an authorization mechanism. Existing AppDeploy records are not automatically available to this independent backend; migration/export must be planned separately before switching users.
