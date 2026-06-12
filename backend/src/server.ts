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

import authRouter from "./routes/auth";
import moviesRouter from "./routes/movies";
import adminRouter from "./routes/admin";
import pagesRouter from "./routes/pages";
import reactionsRouter from "./routes/reactions";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const isDev = process.env.NODE_ENV !== "production";

app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        fontSrc: ["'self'", "fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "image.tmdb.org", "static-cdn.jtvnw.net", "*"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = (process.env.FRONTEND_URL || "http://localhost:3000")
        .split(",")
        .map(o => o.trim());
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PgSession = ConnectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: !isDev,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
    name: "cv.sid",
  })
);

app.use(morgan(isDev ? "dev" : "combined"));

app.use("/api/movies/:id/vote", rateLimit({ windowMs: 60_000, max: 5, message: { error: "Too many votes, slow down." } }));
app.use("/api/reactions", rateLimit({ windowMs: 60_000, max: 60 }));
app.use("/api/", rateLimit({ windowMs: 60_000, max: 120 }));

app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// Setup/admin helper routes (unchanged)
app.get("/setup", async (req, res) => {
  const secret = process.env.SETUP_SECRET;
  if (!secret || req.query.secret !== secret) return res.status(403).send("Proibido.");
  if (!req.session.userId) return res.send(`<p>Você não está logado. <a href="/auth/twitch">Entre com a Twitch primeiro</a></p>`);
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const user = await p.user.update({ where: { id: req.session.userId }, data: { isAdmin: true } });
  req.session.isAdmin = true;
  await p.$disconnect();
  res.send(`✅ <b>${user.displayName}</b> agora é admin. <a href="/admin">Ir para o painel</a>`);
});

app.get("/remove-admin", async (req, res) => {
  const secret = process.env.SETUP_SECRET;
  if (!secret || req.query.secret !== secret) return res.status(403).send("Proibido.");
  const userId = req.query.id as string;
  if (!userId) return res.status(400).send("Faltou ?id=");
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const user = await p.user.update({ where: { id: userId }, data: { isAdmin: false } });
  await p.$disconnect();
  res.send(`✅ Admin removido de <b>${user.displayName}</b>. <a href="/admin">Voltar</a>`);
});

app.get("/add-admin", async (req, res) => {
  const secret = process.env.SETUP_SECRET;
  if (!secret || req.query.secret !== secret) return res.status(403).send("Proibido.");
  const userId = req.query.id as string;
  if (!userId) return res.status(400).send("Faltou ?id=");
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const user = await p.user.update({ where: { id: userId }, data: { isAdmin: true } });
  await p.$disconnect();
  res.send(`✅ Admin adicionado a <b>${user.displayName}</b>. <a href="/admin">Voltar</a>`);
});

app.get("/delete-user", async (req, res) => {
  const secret = process.env.SETUP_SECRET;
  if (!secret || req.query.secret !== secret) return res.status(403).send("Proibido.");
  const userId = req.query.id as string;
  if (!userId) return res.status(400).send("Faltou ?id=");
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const user = await p.user.findUnique({ where: { id: userId } });
  if (!user) { await p.$disconnect(); return res.status(404).send("Usuário não encontrado."); }
  await p.vote.deleteMany({ where: { userId } });
  await p.user.delete({ where: { id: userId } });
  await p.$disconnect();
  res.send(`✅ Usuário <b>${user.displayName}</b> excluído. <a href="/admin/users">Ver usuários</a>`);
});

// ── Routes ──
app.use("/auth", authRouter);
app.use("/api/movies", moviesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/reactions", reactionsRouter);
app.use("/", pagesRouter);
app.use("/filmes", pagesRouter);

app.use((_req, res) => res.status(404).render("404", { user: null }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).render("500", { user: null, message: isDev ? err.message : "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🎬  CineVote running on http://cinevote.onrender.com`);
  console.log(`   ENV: ${process.env.NODE_ENV || "development"}\n`);
});

export default app;
