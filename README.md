# 🎬 votofilm

Enquete de filmes com autenticação Twitch, painel admin e deploy  para **Render** (backend + PostgreSQL).

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Banco | PostgreSQL 16 |
| Views | EJS (SSR) |
| Auth | Twitch OAuth 2.0 |
| Deploy | Render (Docker) |

---

## Desenvolvimento local

### Pré-requisitos
- Node.js ≥ 20
- Docker + Docker Compose
- Conta no [Twitch Developer Console](https://dev.twitch.tv/console)

### 1. Clone e instale
```bash
git clone https://github.com/seu-usuario/cinevote.git
cd cinevote/backend
npm install
```

### 2. Configure variáveis de ambiente
```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Suba o banco com Docker
```bash
cd ..
docker compose up postgres -d
```

### 4. Rode as migrations e seed
```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Inicie o servidor
```bash
npm run dev
# → http://localhost:3000
```

---

## Deploy no Render

### Opção A — Blueprint (recomendado)

1. Fork este repositório
2. Acesse [render.com](https://render.com) → **New → Blueprint**
3. Selecione o repositório → Render detecta o `render.yaml` automaticamente
4. Configure as variáveis secretas no dashboard:
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
   - `TWITCH_REDIRECT_URI` → `https://SEU-APP.onrender.com/auth/twitch/callback`
   - `FRONTEND_URL` → `https://SEU-APP.onrender.com`
5. Clique **Apply**

### Opção B — Manual

1. Render → **New Web Service** → Docker
2. Dockerfile path: `./backend/Dockerfile`
3. Docker context: `./backend`
4. Crie um **PostgreSQL** no Render e conecte via `DATABASE_URL`
5. Adicione todas as variáveis do `.env.example`

### Tornar-se Admin

Após o primeiro login com Twitch, execute no banco:
```sql
UPDATE users SET "isAdmin" = true WHERE "twitchId" = 'SEU_TWITCH_ID';
```

No Render, use o **PSQL Console** do serviço de banco de dados.

---

## Configurar Twitch OAuth

1. Acesse [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
2. **Register Your Application**:
   - Name: `CineVote`
   - OAuth Redirect URLs:
     - Dev: `http://localhost:3000/auth/twitch/callback`
     - Prod: `https://seu-app.onrender.com/auth/twitch/callback`
   - Category: **Website Integration**
3. Copie **Client ID** e gere um **Client Secret**

---

## Estrutura do projeto

```
cinevote/
├── backend/
│   ├── src/
│   │   ├── server.ts          # Entry point
│   │   ├── routes/
│   │   │   ├── auth.ts        # Twitch OAuth
│   │   │   ├── movies.ts      # API pública + votação
│   │   │   ├── admin.ts       # API admin (protegida)
│   │   │   └── pages.ts       # Rotas SSR (EJS)
│   │   ├── middleware/
│   │   │   └── auth.ts        # requireAuth, requireAdmin
│   │   └── lib/
│   │       ├── prisma.ts      # Singleton client
│   │       ├── twitch.ts      # OAuth helpers
│   │       └── seed.ts        # Seed inicial
│   ├── prisma/
│   │   └── schema.prisma      # Models: User, Movie, Vote, Session
│   ├── views/                 # EJS templates
│   │   ├── index.ejs          # Página principal
│   │   ├── admin/index.ejs    # Painel admin
│   │   └── partials/          # head, header
│   ├── public/
│   │   ├── css/               # main.css, admin.css
│   │   ├── js/                # main.js, admin.js
│   │   └── uploads/           # Imagens enviadas (local)
│   ├── Dockerfile
│   └── .env.example
├── render.yaml                # Deploy IaC
├── docker-compose.yml         # Dev local
└── README.md
```

---

## API Endpoints

### Pública
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/movies` | Lista filmes (query: `?category=acao`) |
| `POST` | `/api/movies/:id/vote` | Registra voto (requer auth) |

### Admin (requer `isAdmin: true`)
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/admin/stats` | Estatísticas gerais |
| `GET` | `/api/admin/movies` | Lista todos os filmes |
| `POST` | `/api/admin/movies` | Cria novo filme (multipart) |
| `PUT` | `/api/admin/movies/:id` | Edita filme |
| `DELETE` | `/api/admin/movies/:id` | Apaga filme |
| `POST` | `/api/admin/movies/:id/reset-votes` | Zera votos do filme |
| `POST` | `/api/admin/movies/:id/adjust-votes` | Ajusta votos (`{ delta: N }`) |
| `POST` | `/api/admin/reset-all-votes` | Zera todos os votos |

---

## Notas de produção

- **Uploads de imagem**: No Render Free, o disco é efêmero. Para produção use [Cloudinary](https://cloudinary.com) ou [AWS S3] e ajuste `admin.ts` para fazer upload para cloud.
- **Sessions**: Armazenadas no PostgreSQL via `connect-pg-simple` — sobrevivem a reinicializações.
- **Rate limiting**: Votação limitada a 5 req/min por IP. Ajuste em `server.ts`.
- **Admin inicial**: Defina `isAdmin=true` manualmente no banco após o primeiro login.
