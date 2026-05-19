import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { writeLog } from "../lib/logger";

const router = Router();

// GET /api/movies — fetch all active movies with vote status for current user
router.get("/", async (req: Request, res: Response) => {
  const { category } = req.query as { category?: string };

  const where: { active: boolean; category?: string } = { active: true };
  if (category && category !== "todos") where.category = category;

  const movies = await prisma.movie.findMany({
    where,
    orderBy: { voteCount: "desc" },
  });

  let userVotedIds: Set<string> = new Set();
  if (req.session.userId) {
    const votes = await prisma.vote.findMany({
      where: { userId: req.session.userId },
      select: { movieId: true },
    });
    userVotedIds = new Set(votes.map((v: { movieId: string }) => v.movieId));
  }

  const total = movies.reduce((s: number, m) => s + m.voteCount, 0);
  const max = movies.length ? Math.max(...movies.map((m) => m.voteCount)) : 0;

  const result = movies.map((m) => ({
    ...m,
    hasVoted: userVotedIds.has(m.id),
    pct: total > 0 ? Math.round((m.voteCount / total) * 100) : 0,
    barW: max > 0 ? Math.round((m.voteCount / max) * 100) : 0,
  }));

  res.json({ movies: result, total, max });
});

// POST /api/movies/:id/vote
router.post("/:id/vote", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.session.userId!;

  const movie = await prisma.movie.findUnique({ where: { id, active: true } });
  if (!movie) return res.status(404).json({ error: "Movie not found" });

  const existing = await prisma.vote.findUnique({
    where: { userId_movieId: { userId, movieId: id } },
  });
  if (existing) return res.status(409).json({ error: "Already voted" });

  await prisma.$transaction([
    prisma.vote.create({ data: { userId, movieId: id } }),
    prisma.movie.update({ where: { id }, data: { voteCount: { increment: 1 } } }),
  ]);

  // ── Log ──
  await writeLog({
    action:  "VOTE",
    userId,
    movieId: id,
    meta:    { movieTitle: movie.title },
  });

  const updated = await prisma.movie.findUnique({ where: { id } });
  res.json({ success: true, voteCount: updated?.voteCount });
});

export default router;
