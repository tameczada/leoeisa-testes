# ───────────────── Builder ─────────────────
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --ignore-scripts

COPY . .

RUN npx prisma generate

RUN npm run build


# ───────────────── Runner ─────────────────
FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/node_modules ./node_modules

RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views
COPY --from=builder /app/public ./public

RUN mkdir -p public/uploads

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]