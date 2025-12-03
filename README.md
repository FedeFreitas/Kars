# Kars - Locadora de Veículos

Aplicação full stack para gestão de leads, clientes e operações de uma locadora. O monorepo contém:
- **Frontend** em Next.js 15 (React 19) com dashboard, funil de leads, gestão de clientes, carros, movimentações, financeiro e emails.
- **API** em Express + PostgreSQL com autenticação (JWT + refresh tokens + 2FA), permissões/grupos, funil de leads, perfis de cliente, financeiro e upload de arquivos.
- **Infra local** via Docker Compose (Postgres, Mailcatcher) e Dockerfile para build/execução em produção.

## Stack
- Frontend: Next.js 15, React 19, Tailwind CSS 4, Chart.js.
- Backend: Node 20, Express, PostgreSQL 16, JWT, bcrypt, Nodemailer, Sharp/PDFKit.
- Dev/Infra: Docker Compose, Mailcatcher, Nodemon, Concurrently.

## Estrutura
- `apps/web` — frontend Next.js (app router) e serviços de API no cliente.
- `apps/api` — API Express, rotas em `src/routes`, serviços em `src/services`, repositórios em `src/repositories`.
- `docker/db/init.sql` — schema completo (users, permissions, leads, client_profiles, financeiro, carros/movimentações, emails, uploads).
- `docker/db/seed_test_data.sql` — dados de exemplo (opcional).
- `docker-compose.yml` — sobe Postgres + API + Web + Mailcatcher para dev.
- `Dockerfile` — build da aplicação web para produção (porta 3000).

## Requisitos
- Node.js 20+
- npm 10+
- Docker e Docker Compose

## Variáveis de ambiente

Crie arquivos locais:
- `apps/api/.env`
- `apps/web/.env.local`

Exemplo para **API** (`apps/api/.env`):
```
NODE_ENV=development
API_PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/appdb
CORS_ORIGIN=http://localhost:3000
PUBLIC_APP_URL=http://localhost:3000
JWT_ACCESS_SECRET=changeme_access
JWT_REFRESH_SECRET=changeme_refresh
RESET_TOKEN_SECRET=changeme_reset
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
SECURE_COOKIES=false
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM=no-reply@kars.local
```

Exemplo para **Web** (`apps/web/.env.local`):
```
NODE_ENV=development
# Usado no rewrite de /api -> API interna (default já é http://localhost:4000)
API_URL=http://localhost:4000
# Caso sirva o backend em outro domínio, exponha o endpoint público:
# NEXT_PUBLIC_API_BASE=https://seu-backend/api
CHOKIDAR_USEPOLLING=true
WATCHPACK_POLLING=true
```

## Como rodar localmente

### Opção 1: Docker Compose (recomendado)
```sh
docker-compose up --build
```
- Web: http://localhost:3000  
- API: http://localhost:4000/api  
- Mailcatcher (emails de teste): http://localhost:1080

### Opção 2: Sem Docker
```sh
npm install
# Em um terminal
npm run dev:api   # sobe API em 4000
# Em outro terminal
npm run dev:web   # sobe Web em 3000
```

## Banco de dados
- Schema criado por `docker/db/init.sql` (executado automaticamente no primeiro `docker-compose up`).
- Para popular com dados de teste: importe `docker/db/seed_test_data.sql` no Postgres (pode usar `psql` dentro do container).

## Scripts úteis
- `npm run dev` — inicia API e Web juntos (concurrently).
- `npm run dev:api` / `npm run dev:web` — inicia cada serviço separadamente.
- `npm run build` — build do frontend (Next.js).
- `npm start` — inicia API e Web em modo produção (necessita build prévio e variáveis configuradas).

## Deploy
- Há um `Dockerfile` na raiz para construir a imagem do frontend (porta 3000). Para usar com Fly.io ou outro provider, defina `NEXT_PUBLIC_API_BASE` apontando para a API pública e publique a imagem.
- A API pode ser empacotada em outro app/container; garanta que o `DATABASE_URL`, segredos JWT e SMTP estejam definidos no ambiente de produção.
