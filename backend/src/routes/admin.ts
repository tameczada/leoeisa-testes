import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";
import { writeLog } from "../lib/logger";
import { upload, getUploadedUrl, deleteOldImage } from "../lib/cloudinary";
import { Category } from "@prisma/client";

const router = Router();
router.use(requireAdmin);

const PAGE_SIZE_MOVIES = 20;
const PAGE_SIZE_USERS  = 30;

// ── Stats ──────────────────────────────────────────────────────────────────

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

// ── Movies ─────────────────────────────────────────────────────────────────

// GET /api/admin/movies?page=1&search=&category=&active=
router.get("/movies", async (req: Request, res: Response) => {
  const page     = Math.max(1, parseInt(req.query.page as string) || 1);
  const search   = ((req.query.search as string) || "").trim();
  const category = (req.query.category as string) || "";
  const activeQ  = req.query.active as string;

  const where: any = {};
  if (search)   where.title    = { contains: search, mode: "insensitive" };
  if (category && Object.values(Category).includes(category as Category)) {
    where.category = category as Category;
  }
  if (activeQ === "true")  where.active = true;
  if (activeQ === "false") where.active = false;

  const [movies, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      orderBy: [{ active: "desc" }, { voteCount: "desc" }],
      skip:  (page - 1) * PAGE_SIZE_MOVIES,
      take:  PAGE_SIZE_MOVIES,
    }),
    prisma.movie.count({ where }),
  ]);

  res.json({ movies, total, page, pageSize: PAGE_SIZE_MOVIES, totalPages: Math.ceil(total / PAGE_SIZE_MOVIES) });
});

// POST /api/admin/movies — criar
router.post("/movies", upload.single("poster"), async (req: Request, res: Response) => {
  const { title, year, category, description, voteCount, posterUrl } = req.body;

  if (!title || !category) {
    return res.status(400).json({ error: "title and category are required" });
  }
  if (!Object.values(Category).includes(category as Category)) {
    return res.status(400).json({ error: `Invalid category. Valid values: ${Object.values(Category).join(", ")}` });
  }

  let poster: string | undefined = posterUrl || undefined;
  if (req.file) poster = getUploadedUrl(req.file);

  const movie = await prisma.movie.create({
    data: {
      title:       String(title).trim(),
      year:        parseInt(year) || new Date().getFullYear(),
      category:    category as Category,
      description: description ? String(description).trim() : undefined,
      poster,
      voteCount:   Math.max(0, parseInt(voteCount) || 0),
    },
  });

  await writeLog({ action: "MOVIE_ADD", userId: req.session.userId, movieId: movie.id,
    meta: { title: movie.title, year: movie.year, category: movie.category } });

  res.status(201).json(movie);
});

// PUT /api/admin/movies/:id — editar
router.put("/movies/:id", upload.single("poster"), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, year, category, description, voteCount, posterUrl, active } = req.body;

  const existing = await prisma.movie.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Movie not found" });

  if (category && !Object.values(Category).includes(category as Category)) {
    return res.status(400).json({ error: `Invalid category. Valid values: ${Object.values(Category).join(", ")}` });
  }

  let poster = existing.poster;
  if (req.file) {
    await deleteOldImage(existing.poster);
    poster = getUploadedUrl(req.file);
  } else if (posterUrl !== undefined) {
    if (posterUrl === "" || posterUrl === null) await deleteOldImage(existing.poster);
    poster = posterUrl || null;
  }

  const movie = await prisma.movie.update({
    where: { id },
    data: {
      ...(title       && { title: String(title).trim() }),
      ...(year        && { year: parseInt(year) }),
      ...(category    && { category: category as Category }),
      ...(description !== undefined && { description: String(description).trim() }),
      poster,
      ...(voteCount   !== undefined && { voteCount: Math.max(0, parseInt(voteCount) || 0) }),
      ...(active      !== undefined && { active: active === "true" || active === true }),
    },
  });

  await writeLog({ action: "MOVIE_EDIT", userId: req.session.userId, movieId: id, meta: { title: movie.title } });

  res.json(movie);
});

// DELETE /api/admin/movies/:id
router.delete("/movies/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const movie = await prisma.movie.findUnique({ where: { id } });
  if (!movie) return res.status(404).json({ error: "Movie not found" });

  await deleteOldImage(movie.poster);

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { movieId: id } }),
    prisma.movie.delete({ where: { id } }),
  ]);

  await writeLog({ action: "MOVIE_REMOVE", userId: req.session.userId, meta: { movieId: id, title: movie.title } });

  res.json({ success: true });
});

// POST /api/admin/movies/:id/reset-votes
router.post("/movies/:id/reset-votes", async (req: Request, res: Response) => {
  const { id } = req.params;

  const movie = await prisma.movie.findUnique({ where: { id } });
  if (!movie) return res.status(404).json({ error: "Movie not found" });

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { movieId: id } }),
    prisma.movie.update({ where: { id }, data: { voteCount: 0 } }),
  ]);

  await writeLog({ action: "RESET_MOVIE", userId: req.session.userId, movieId: id, meta: { title: movie.title } });

  res.json({ success: true });
});

// POST /api/admin/movies/:id/adjust-votes
router.post("/movies/:id/adjust-votes", async (req: Request, res: Response) => {
  const { id }  = req.params;
  const delta   = parseInt(req.body.delta) || 0;

  const movie = await prisma.movie.findUnique({ where: { id } });
  if (!movie) return res.status(404).json({ error: "Movie not found" });

  const newCount = Math.max(0, movie.voteCount + delta);
  const updated  = await prisma.movie.update({ where: { id }, data: { voteCount: newCount } });

  res.json(updated);
});

// POST /api/admin/reset-all-votes
router.post("/reset-all-votes", async (req: Request, res: Response) => {
  await prisma.$transaction([
    prisma.vote.deleteMany(),
    prisma.movie.updateMany({ data: { voteCount: 0 } }),
  ]);

  await writeLog({ action: "RESET_ALL", userId: req.session.userId });

  res.json({ success: true });
});

// ── Users ──────────────────────────────────────────────────────────────────

// GET /api/admin/users?page=1&search=
router.get("/users", async (req: Request, res: Response) => {
  const page   = Math.max(1, parseInt(req.query.page as string) || 1);
  const search = ((req.query.search as string) || "").trim();

  const where: any = {};
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { username:    { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { votes: true } } },
      skip: (page - 1) * PAGE_SIZE_USERS,
      take: PAGE_SIZE_USERS,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page, pageSize: PAGE_SIZE_USERS, totalPages: Math.ceil(total / PAGE_SIZE_USERS) });
});

// POST /api/admin/users/:id/toggle-admin
router.post("/users/:id/toggle-admin", async (req: Request, res: Response) => {
  const { id }    = req.params;
  const { isAdmin } = req.body;

  const user = await prisma.user.update({ where: { id }, data: { isAdmin: Boolean(isAdmin) } });

  res.json({ success: true, isAdmin: user.isAdmin });
});

// POST /api/admin/users/:id/reset-votes
router.post("/users/:id/reset-votes", async (req: Request, res: Response) => {
  const { id } = req.params;

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  const userVotes = await prisma.vote.findMany({ where: { userId: id }, select: { movieId: true } });

  if (userVotes.length === 0) {
    return res.json({ success: true, message: "Usuário não tinha votos.", votesReturned: 0 });
  }

  const decrements = userVotes.map((v) =>
    prisma.movie.update({ where: { id: v.movieId }, data: { voteCount: { decrement: 1 } } })
  );

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { userId: id } }),
    ...decrements,
  ]);

  await prisma.movie.updateMany({ where: { voteCount: { lt: 0 } }, data: { voteCount: 0 } });

  await writeLog({ action: "VOTE_RETURN", userId: req.session.userId,
    meta: { targetUserId: id, targetDisplayName: targetUser.displayName, votesReturned: userVotes.length } });

  res.json({ success: true, votesReturned: userVotes.length });
});

// ── Logs ───────────────────────────────────────────────────────────────────

// DELETE /api/admin/logs
router.delete("/logs", async (req: Request, res: Response) => {
  const { action } = req.query as { action?: string };
  const where = action ? { action } : {};
  const { count } = await prisma.log.deleteMany({ where });
  res.json({ success: true, deleted: count });
});

// ── Categories (enum) ──────────────────────────────────────────────────────

// GET /api/admin/categories — retorna categorias válidas
router.get("/categories", (_req: Request, res: Response) => {
  res.json({ categories: Object.values(Category) });
});

export default router;
