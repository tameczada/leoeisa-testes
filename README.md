# 🎬 CineVote

Enquete de filmes com autenticação Twitch, painel admin e deploy para **Render** (backend + PostgreSQL).

---

## Stack

| Camada     | Tecnologia                          |
|------------|-------------------------------------|
| Runtime    | Node.js 20 + TypeScript             |
| Framework  | Express 4                           |
| ORM        | Prisma 5                            |
| Banco      | PostgreSQL 16                       |
| Views      | EJS (SSR)                           |
| Auth       | Twitch OAuth 2.0                    |
| Upload     | Cloudinary (ou disco local)         |
| Deploy     | Render (Docker)                     |

---

## Changelog v1.1.0

- **Cloudinary**: uploads de imagem persistentes em produção (fallback para disco local se não configurado)
- **UNVOTE**: usuários podem desfazer votos clicando novamente no botão "Votado!"
- **Categoria como enum**: categorias validadas no banco e na API (`acao`, `comedia`, `terror`, `drama`, `ficcao`, `animacao`)
- **Paginação**: endpoints `/api/admin/movies` e `/api/admin/users` suportam `?page=&search=`
- **Segurança**: rota `/setup` movida para POST; rotas GET destrutivas removidas
- **API `/api/admin/categories`**: retorna categorias válidas para uso em formulários externos

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
cp .env .env.local
# Edite com suas credenciais (Twitch obrigatório; Cloudinary opcional)
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
3. Selecione o repositório → Render detecta o `render.yaml`
4. Configure as variáveis secretas:
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
   - `TWITCH_REDIRECT_URI` → `https://SEU-APP.onrender.com/auth/twitch/callback`
   - `FRONTEND_URL` → `https://SEU-APP.onrender.com`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` *(opcional)*
5. Clique **Apply**

### Configurar Cloudinary (recomendado para produção)

1. Crie conta gratuita em [cloudinary.com](https://cloudinary.com)
2. Dashboard → **Settings → API Keys**
3. Copie `Cloud Name`, `API Key` e `API Secret`
4. Adicione as três variáveis no Render

> Sem Cloudinary, uploads funcionam localmente mas são perdidos ao fazer novo deploy no Render Free (disco efêmero).

---

## Tornar-se Admin

Após o primeiro login com Twitch:

```bash
curl -X POST https://SEU-APP.onrender.com/setup \
  -H "Content-Type: application/json" \
  -d '{"secret":"SUA_SETUP_SECRET"}' \
  --cookie "cv.sid=SEU_COOKIE"
```

> Você precisa estar logado. Copie o cookie `cv.sid` do navegador após fazer login.  
> Remova `SETUP_SECRET` do Render após usar para desativar a rota.

---

## API Endpoints

### Pública
| Método   | Rota                      | Descrição                                 |
|----------|---------------------------|-------------------------------------------|
| `GET`    | `/api/movies`             | Lista filmes (`?category=acao`)           |
| `POST`   | `/api/movies/:id/vote`    | Registra voto (requer auth)               |
| `DELETE` | `/api/movies/:id/vote`    | Desfaz voto (requer auth)                 |

### Admin (requer `isAdmin: true`)
| Método   | Rota                                   | Descrição                                      |
|----------|----------------------------------------|------------------------------------------------|
| `GET`    | `/api/admin/stats`                     | Estatísticas gerais                            |
| `GET`    | `/api/admin/movies`                    | Lista filmes (`?page=&search=&category=`)      |
| `POST`   | `/api/admin/movies`                    | Cria filme (multipart)                         |
| `PUT`    | `/api/admin/movies/:id`                | Edita filme                                    |
| `DELETE` | `/api/admin/movies/:id`                | Apaga filme + imagem do Cloudinary             |
| `POST`   | `/api/admin/movies/:id/reset-votes`    | Zera votos do filme                            |
| `POST`   | `/api/admin/movies/:id/adjust-votes`   | Ajusta votos (`{ delta: N }`)                  |
| `POST`   | `/api/admin/reset-all-votes`           | Zera todos os votos                            |
| `GET`    | `/api/admin/users`                     | Lista usuários (`?page=&search=`)              |
| `POST`   | `/api/admin/users/:id/toggle-admin`    | Promove/rebaixa admin                          |
| `POST`   | `/api/admin/users/:id/reset-votes`     | Devolve votos do usuário                       |
| `DELETE` | `/api/admin/logs`                      | Limpa logs (`?action=VOTE`)                    |
| `GET`    | `/api/admin/categories`                | Lista categorias válidas                       |

### Categorias válidas
`acao` · `comedia` · `terror` · `drama` · `ficcao` · `animacao`

---

## Estrutura do projeto

```
cinevote/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Entry point
│   │   ├── routes/
│   │   │   ├── auth.ts            # Twitch OAuth
│   │   │   ├── movies.ts          # API pública + votação + unvote
│   │   │   ├── admin.ts           # API admin (protegida, paginada)
│   │   │   └── pages.ts           # Rotas SSR (EJS)
│   │   ├── middleware/
│   │   │   └── auth.ts            # requireAuth, requireAdmin
│   │   └── lib/
│   │       ├── prisma.ts          # Singleton client
│   │       ├── cloudinary.ts      # Upload helper (Cloudinary + fallback local)
│   │       ├── twitch.ts          # OAuth helpers
│   │       ├── logger.ts          # Audit log
│   │       └── seed.ts            # Seed inicial
│   ├── prisma/
│   │   └── schema.prisma          # Models + enum Category
│   ├── views/                     # EJS templates
│   ├── public/                    # CSS, JS, uploads locais
│   ├── Dockerfile
│   └── .env
├── render.yaml
├── docker-compose.yml
└── README.md
```

---

## Notas de produção

- **Sessions**: armazenadas no PostgreSQL via `connect-pg-simple` — sobrevivem a reinicializações.
- **Rate limiting**: votação limitada a 5 req/min por IP; API geral 120 req/min.
- **Categorias**: validadas por enum no Prisma — não é possível criar filme com categoria inválida.
- **Imagens**: Cloudinary faz crop automático para 500×281px com `quality: auto`.
