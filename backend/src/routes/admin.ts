import { Router, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";
import { writeLog } from "../lib/logger";

const router = Router();

router.use(requireAdmin);

// ── Multer config ──
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (e: Error | null, dest: string) => void) =>
    cb(null, UPLOAD_DIR),
  filename: (_req: Request, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});

// GET /api/admin/stats
router.get("/stats", async (_req: Request, res: Response) => {
  const [movieCount, totalVotes, topMovie] = await Promise.all([
    prisma.movie.count({ where: { active: true } }),
    prisma.vote.count(),
    prisma.movie.findFirst({ where: { active: true }, orderBy: { voteCount: "desc" } }),
  ]);

  const avgVotes = movieCount > 0 ? Math.round(totalVotes / movieCount) : 0;
  res.json({ movieCount, totalVotes, topMovie, avgVotes });
});

// GET /api/admin/movies
router.get("/movies", async (_req: Request, res: Response) => {
  const movies = await prisma.movie.findMany({
    orderBy: [{ active: "desc" }, { voteCount: "desc" }],
  });
  res.json(movies);
});

// POST /api/admin/movies — criar
router.post("/movies", upload.single("poster"), async (req: Request, res: Response) => {
  const { title, year, category, description, voteCount, posterUrl } = req.body;

  if (!title || !category) {
    return res.status(400).json({ error: "title and category are required" });
  }

  let poster: string | undefined = posterUrl || undefined;
  if (req.file) poster = `/uploads/${req.file.filename}`;

  const movie = await prisma.movie.create({
    data: {
      title:     String(title).trim(),
      year:      parseInt(year) || new Date().getFullYear(),
      category:  String(category),
      description: description ? String(description).trim() : undefined,
      poster,
      voteCount: Math.max(0, parseInt(voteCount) || 0),
    },
  });

  // ── Log ──
  await writeLog({
    action:  "MOVIE_ADD",
    userId:  req.session.userId,
    movieId: movie.id,
    meta:    { title: movie.title, year: movie.year, category: movie.category },
  });

  res.status(201).json(movie);
});

// PUT /api/admin/movies/:id — editar
router.put("/movies/:id", upload.single("poster"), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, year, category, description, voteCount, posterUrl, active } = req.body;

  const existing = await prisma.movie.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Movie not found" });

  let poster = existing.poster;
  if (req.file) {
    poster = `/uploads/${req.file.filename}`;
    if (existing.poster?.startsWith("/uploads/")) {
      const old = path.join(process.cwd(), "public", existing.poster);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
  } else if (posterUrl !== undefined) {
    poster = posterUrl || null;
  }

  const movie = await prisma.movie.update({
    where: { id },
    data: {
      ...(title     && { title: String(title).trim() }),
      ...(year      && { year: parseInt(year) }),
      ...(category  && { category: String(category) }),
      ...(description !== undefined && { description: String(description).trim() }),
      poster,
      ...(voteCount !== undefined && { voteCount: Math.max(0, parseInt(voteCount) || 0) }),
      ...(active    !== undefined && { active: active === "true" || active === true }),
    },
  });

  // ── Log ──
  await writeLog({
    action:  "MOVIE_EDIT",
    userId:  req.session.userId,
    movieId: id,
    meta:    { title: movie.title },
  });

  res.json(movie);
});

// DELETE /api/admin/movies/:id
router.delete("/movies/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const movie = await prisma.movie.findUnique({ where: { id } });

  await prisma.vote.deleteMany({ where: { movieId: id } });
  await prisma.movie.delete({ where: { id } });

  // ── Log ──
  await writeLog({
    action: "MOVIE_REMOVE",
    userId: req.session.userId,
    meta:   { movieId: id, title: movie?.title ?? "?" },
  });

  res.json({ success: true });
});

// POST /api/admin/movies/:id/reset-votes
router.post("/movies/:id/reset-votes", async (req: Request, res: Response) => {
  const { id } = req.params;

  const movie = await prisma.movie.findUnique({ where: { id } });

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { movieId: id } }),
    prisma.movie.update({ where: { id }, data: { voteCount: 0 } }),
  ]);

  // ── Log ──
  await writeLog({
    action:  "RESET_MOVIE",
    userId:  req.session.userId,
    movieId: id,
    meta:    { title: movie?.title ?? "?" },
  });

  res.json({ success: true });
});

// POST /api/admin/reset-all-votes
router.post("/reset-all-votes", async (req: Request, res: Response) => {
  await prisma.$transaction([
    prisma.vote.deleteMany(),
    prisma.movie.updateMany({ data: { voteCount: 0 } }),
  ]);

  // ── Log ──
  await writeLog({
    action: "RESET_ALL",
    userId: req.session.userId,
  });

  res.json({ success: true });
});

// DELETE /api/admin/logs — limpar logs (todos ou por tipo)
router.delete("/logs", async (req: Request, res: Response) => {
  const { action } = req.query as { action?: string };
  const where = action ? { action } : {};
  const { count } = await prisma.log.deleteMany({ where });
  res.json({ success: true, deleted: count });
});

// POST /api/admin/movies/:id/adjust-votes
router.post("/movies/:id/adjust-votes", async (req: Request, res: Response) => {
  const { id } = req.params;
  const delta = parseInt(req.body.delta) || 0;

  const movie = await prisma.movie.findUnique({ where: { id } });
  if (!movie) return res.status(404).json({ error: "Movie not found" });

  const newCount = Math.max(0, movie.voteCount + delta);
  const updated = await prisma.movie.update({
    where: { id },
    data: { voteCount: newCount },
  });

  res.json(updated);
});

// POST /api/admin/users/:id/toggle-admin
router.post("/users/:id/toggle-admin", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isAdmin } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: { isAdmin: Boolean(isAdmin) },
  });

  res.json({ success: true, isAdmin: user.isAdmin });
});

// GET /api/admin/users
router.get("/users", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { votes: true } } },
  });
  res.json(users);
});

// POST /api/admin/users/:id/reset-votes
router.post("/users/:id/reset-votes", async (req: Request, res: Response) => {
  const { id } = req.params;

  const targetUser = await prisma.user.findUnique({ where: { id } });

  const userVotes = await prisma.vote.findMany({
    where: { userId: id },
    select: { movieId: true },
  });

  if (userVotes.length === 0) {
    return res.json({ success: true, message: "Usuário não tinha votos.", votesReturned: 0 });
  }

  const decrements = userVotes.map((v) =>
    prisma.movie.update({
      where: { id: v.movieId },
      data:  { voteCount: { decrement: 1 } },
    })
  );

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { userId: id } }),
    ...decrements,
  ]);

  await prisma.movie.updateMany({
    where: { voteCount: { lt: 0 } },
    data:  { voteCount: 0 },
  });

  // ── Log ──
  await writeLog({
    action: "VOTE_RETURN",
    userId: req.session.userId,
    meta:   {
      targetUserId:      id,
      targetDisplayName: targetUser?.displayName ?? "?",
      votesReturned:     userVotes.length,
    },
  });

  res.json({ success: true, votesReturned: userVotes.length });
});

export default router;
