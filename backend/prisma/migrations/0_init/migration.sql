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
