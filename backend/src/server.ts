import "./types/session";
import express from "express";
import path from "path";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

import authRouter   from "./routes/auth";
import moviesRouter from "./routes/movies";
import adminRouter  from "./routes/admin";
import pagesRouter  from "./routes/pages";

const app    = express();
const PORT   = parseInt(process.env.PORT || "3000", 10);
const isDev  = process.env.NODE_ENV !== "production";

// ── Trust proxy (necessário no Render) ──────────────────────────────────────
app.set("trust proxy", 1);

// ── View engine ─────────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

// ── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
        styleSrc:    ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        fontSrc:     ["'self'", "fonts.gstatic.com"],
        imgSrc:      ["'self'", "data:", "image.tmdb.org", "static-cdn.jtvnw.net", "res.cloudinary.com", "*"],
        connectSrc:  ["'self'"],
      },
    },
  })
);

app.use(
  cors({
    origin:      process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Session (PostgreSQL store) ────────────────────────────────────────────────
const PgSession = ConnectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      conString:          process.env.DATABASE_URL,
      tableName:          "session",
      createTableIfMissing: true,
    }),
    secret:           process.env.SESSION_SECRET || "change-me-in-production",
    resave:           false,
    saveUninitialized: false,
    cookie: {
      secure:   !isDev,
      httpOnly: true,
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 dias
      sameSite: "lax",
    },
    name: "cv.sid",
  })
);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(isDev ? "dev" : "combined"));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Votação: 5 req/min por IP
app.use("/api/movies/:id/vote",
  rateLimit({ windowMs: 60_000, max: 5, message: { error: "Too many votes, slow down." } })
);
// API geral: 120 req/min por IP
app.use("/api/",
  rateLimit({ windowMs: 60_000, max: 120 })
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// ── Setup admin via secret (GET → informativo, POST → ação) ──────────────────
// Uso: POST /setup com body { secret: "SUA_SETUP_SECRET" }
// Requer estar logado. Remova SETUP_SECRET após usar.
app.post("/setup", async (req, res) => {
  const secret = process.env.SETUP_SECRET;
  if (!secret || req.body.secret !== secret) return res.status(403).json({ error: "Proibido." });
  if (!req.session.userId) return res.status(401).json({ error: "Faça login primeiro em /auth/twitch." });

  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const user = await p.user.update({ where: { id: req.session.userId }, data: { isAdmin: true } });
  req.session.isAdmin = true;
  await p.$disconnect();
  res.json({ ok: true, message: `${user.displayName} agora é admin.` });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/auth",        authRouter);
app.use("/api/movies",  moviesRouter);
app.use("/api/admin",   adminRouter);
app.use("/",            pagesRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).render("404", { user: null });
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).render("500", { user: null, message: isDev ? err.message : "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🎬  CineVote running on http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || "development"}\n`);
});

export default app;
