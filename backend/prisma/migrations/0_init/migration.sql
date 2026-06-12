-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "twitchId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "profileImage" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "poster" TEXT,
    "description" TEXT,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- Migration: add_logs
-- Rode com: npx prisma migrate deploy

CREATE TABLE "logs" (
  "id"        TEXT        NOT NULL,
  "action"    TEXT        NOT NULL,
  "userId"    TEXT,
  "movieId"   TEXT,
  "meta"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- FK para users (nullable — log sobrevive se usuário for deletado)
ALTER TABLE "logs"
  ADD CONSTRAINT "logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FK para movies (nullable — log sobrevive se filme for deletado)
ALTER TABLE "logs"
  ADD CONSTRAINT "logs_movieId_fkey"
  FOREIGN KEY ("movieId") REFERENCES "movies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices para filtros e ordenação na página de logs
CREATE INDEX "logs_action_idx"     ON "logs"("action");
CREATE INDEX "logs_createdAt_idx"  ON "logs"("createdAt" DESC);


-- CreateIndex
CREATE UNIQUE INDEX "users_twitchId_key" ON "users"("twitchId");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- CreateIndex
CREATE UNIQUE INDEX "votes_userId_movieId_key" ON "votes"("userId", "movieId");

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migration: add_reactions

CREATE TABLE "reactions" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "movieId"   TEXT         NOT NULL,
  "emoji"     TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reactions_userId_movieId_emoji_key"
  ON "reactions"("userId", "movieId", "emoji");

ALTER TABLE "reactions"
  ADD CONSTRAINT "reactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reactions"
  ADD CONSTRAINT "reactions_movieId_fkey"
  FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "reactions_movieId_idx" ON "reactions"("movieId");

-- Configurações globais
CREATE TABLE "settings" (
  "key"   TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "settings" ("key", "value") VALUES ('reactions_enabled', 'false');

-- Migration: add_custom_emotes

CREATE TABLE "custom_emotes" (
  "id"        TEXT         NOT NULL,
  "name"      TEXT         NOT NULL,
  "imageUrl"  TEXT         NOT NULL,
  "active"    BOOLEAN      NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_emotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_emotes_name_key" ON "custom_emotes"("name");

INSERT INTO "settings" ("key", "value") VALUES ('bot_enabled', 'false');
INSERT INTO "settings" ("key", "value") VALUES ('bot_message_template', '🎬 Novo filme adicionado: {titulo} ({ano}) - {categoria}');

INSERT INTO "settings" ("key", "value") VALUES ('bot_spawn_count', '1');
INSERT INTO "settings" ("key", "value") VALUES ('bot_spawn_interval', '1');
