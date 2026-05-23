import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { writeLog } from "../lib/logger";
import { Category } from "@prisma/client";

const router = Router();

// GET /api/movies — lista filmes ativos com status de voto do usuário
router.get("/", async (req: Request, res: Response) => {
  const { category } = req.query as { category?: string };

  const where: { active: boolean; category?: Category } = { active: true };
  if (category && category !== "todos" && Object.values(Category).includes(category as Category)) {
    where.category = category as Category;
  }

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
    userVotedIds = new Set(votes.map((v) => v.movieId));
  }

  const total = movies.reduce((s, m) => s + m.voteCount, 0);
  const max   = movies.length ? Math.max(...movies.map((m) => m.voteCount)) : 0;

  const result = movies.map((m) => ({
    ...m,
    hasVoted: userVotedIds.has(m.id),
    pct:  total > 0 ? Math.round((m.voteCount / total) * 100) : 0,
    barW: max   > 0 ? Math.round((m.voteCount / max)   * 100) : 0,
  }));

  res.json({ movies: result, total, max });
});

// POST /api/movies/:id/vote — registra voto
router.post("/:id/vote", requireAuth, async (req: Request, res: Response) => {
  const { id }   = req.params;
  const userId   = req.session.userId!;

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

  await writeLog({ action: "VOTE", userId, movieId: id, meta: { movieTitle: movie.title } });

  const updated = await prisma.movie.findUnique({ where: { id } });
  res.json({ success: true, voteCount: updated?.voteCount });
});

// DELETE /api/movies/:id/vote — desfaz voto
router.delete("/:id/vote", requireAuth, async (req: Request, res: Response) => {
  const { id }  = req.params;
  const userId  = req.session.userId!;

  const movie = await prisma.movie.findUnique({ where: { id, active: true } });
  if (!movie) return res.status(404).json({ error: "Movie not found" });

  const existing = await prisma.vote.findUnique({
    where: { userId_movieId: { userId, movieId: id } },
  });
  if (!existing) return res.status(404).json({ error: "Vote not found" });

  await prisma.$transaction([
    prisma.vote.delete({ where: { userId_movieId: { userId, movieId: id } } }),
    prisma.movie.update({ where: { id }, data: { voteCount: { decrement: 1 } } }),
  ]);

  // Garante que voteCount não fique negativo
  await prisma.movie.updateMany({ where: { id, voteCount: { lt: 0 } }, data: { voteCount: 0 } });

  await writeLog({ action: "UNVOTE", userId, movieId: id, meta: { movieTitle: movie.title } });

  const updated = await prisma.movie.findUnique({ where: { id } });
  res.json({ success: true, voteCount: updated?.voteCount });
});

export default router;
