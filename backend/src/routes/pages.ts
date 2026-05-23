import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";
import { Category } from "@prisma/client";

const router = Router();

const CAT_LABELS: Record<string, string> = {
  todos:    "Todos",
  acao:     "⚔️ Ação",
  comedia:  "😂 Comédia",
  terror:   "👻 Terror",
  drama:    "🎭 Drama",
  ficcao:   "🚀 Ficção Científica",
  animacao: "🎨 Animação",
};

const CATEGORIES = ["todos", ...Object.values(Category)];

// ── Public pages ──────────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { category = "todos", error } = req.query as { category?: string; error?: string };

  const where: { active: boolean; category?: Category } = { active: true };
  if (category !== "todos" && Object.values(Category).includes(category as Category)) {
    where.category = category as Category;
  }

  const movies = await prisma.movie.findMany({ where, orderBy: { voteCount: "desc" } });

  let userVotedIds: Set<string> = new Set();
  if (req.session.userId) {
    const votes = await prisma.vote.findMany({
      where: { userId: req.session.userId },
      select: { movieId: true },
    });
    userVotedIds = new Set(votes.map((v) => v.movieId));
  }

  const total = movies.reduce((s, m) => s + m.voteCount, 0);
  const max   = movies.length ? Math.max(...movies.map((m) => m.voteCount)) : 0;

  const enriched = movies.map((m, i) => ({
    ...m,
    hasVoted:  userVotedIds.has(m.id),
    pct:       total > 0 ? Math.round((m.voteCount / total) * 100) : 0,
    barW:      max   > 0 ? Math.round((m.voteCount / max)   * 100) : 0,
    rank:      i + 1,
    rankClass: i === 0 ? "gold" : i === 1 ? "green" : "",
  }));

  res.render("index", {
    movies:         enriched,
    total,
    activeCategory: category,
    categories:     CATEGORIES,
    catLabels:      CAT_LABELS,
    user: req.session.userId
      ? {
          id:           req.session.userId,
          username:     req.session.username,
          displayName:  req.session.displayName,
          profileImage: req.session.profileImage,
          isAdmin:      req.session.isAdmin,
        }
      : null,
    error:          error || null,
    twitchClientId: process.env.TWITCH_CLIENT_ID,
  });
});

// ── Admin pages ───────────────────────────────────────────────────────────────

router.get("/admin", requireAdmin, async (req: Request, res: Response) => {
  const [movies, totalVotesResult] = await Promise.all([
    prisma.movie.findMany({ orderBy: { voteCount: "desc" } }),
    prisma.vote.count(),
  ]);

  const total = totalVotesResult;
  const max   = movies.length ? Math.max(...movies.map((m) => m.voteCount)) : 0;

  const enriched = movies.map((m) => ({
    ...m,
    pct:  total > 0 ? Math.round((m.voteCount / total) * 100) : 0,
    barW: max   > 0 ? Math.round((m.voteCount / max)   * 100) : 0,
  }));

  res.render("admin/index", {
    movies:     enriched,
    total,
    categories: Object.values(Category),
    catLabels:  CAT_LABELS,
    user: {
      id:           req.session.userId,
      username:     req.session.username,
      displayName:  req.session.displayName,
      profileImage: req.session.profileImage,
      isAdmin:      req.session.isAdmin,
    },
    activeTab: req.query.tab || "overview",
  });
});

// GET /admin/edit/:id
router.get("/admin/edit/:id", requireAdmin, async (req: Request, res: Response) => {
  const movie = await prisma.movie.findUnique({ where: { id: req.params.id } });
  if (!movie) {
    return res.status(404).render("404", {
      user: req.session.userId ? { displayName: req.session.displayName, isAdmin: true } : null,
    });
  }

  res.render("admin/edit", {
    movie,
    categories: Object.values(Category),
    catLabels:  CAT_LABELS,
    flash:      req.query.saved ? { type: "success", message: "Filme salvo com sucesso!" } : null,
    user: {
      id:           req.session.userId,
      username:     req.session.username,
      displayName:  req.session.displayName,
      profileImage: req.session.profileImage,
      isAdmin:      req.session.isAdmin,
    },
  });
});

// GET /admin/users
router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { votes: true } } },
  });

  res.render("admin/users", {
    users,
    user: {
      id:           req.session.userId,
      username:     req.session.username,
      displayName:  req.session.displayName,
      profileImage: req.session.profileImage,
      isAdmin:      req.session.isAdmin,
    },
  });
});

// GET /admin/logs
router.get("/admin/logs", requireAdmin, async (req: Request, res: Response) => {
  const PAGE_SIZE   = 50;
  const page        = Math.max(1, parseInt(req.query.page  as string) || 1);
  const action      = (req.query.action as string) || "";
  const search      = ((req.query.search as string) || "").trim();

  const where: any = {};
  if (action) where.action = action;
  if (search) {
    where.OR = [
      { user:  { OR: [
        { displayName: { contains: search, mode: "insensitive" } },
        { username:    { contains: search, mode: "insensitive" } },
      ]}},
      { movie: { title: { contains: search, mode: "insensitive" } } },
      { meta:  { path: ["title"],            string_contains: search } },
      { meta:  { path: ["targetDisplayName"], string_contains: search } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy:  { createdAt: "desc" },
      skip:     (page - 1) * PAGE_SIZE,
      take:     PAGE_SIZE,
      include:  {
        user:  { select: { displayName: true, username: true, profileImage: true } },
        movie: { select: { title: true } },
      },
    }),
    prisma.log.count({ where }),
  ]);

  res.render("admin/logs", {
    logs,
    total,
    page,
    pageSize:   PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    activeAction: action,
    search,
    user: {
      id:           req.session.userId,
      username:     req.session.username,
      displayName:  req.session.displayName,
      profileImage: req.session.profileImage,
      isAdmin:      req.session.isAdmin,
    },
  });
});

export default router;
