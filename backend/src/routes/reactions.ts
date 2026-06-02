import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { writeLog } from "../lib/logger";

const router = Router();

const ALLOWED_EMOJIS = ["🔥", "❤️", "😂", "😮", "👏", "💀"];

// GET /api/reactions — busca contagens de TODOS os filmes de uma vez
router.get("/", async (req: Request, res: Response) => {
  const setting = await prisma.setting.findUnique({ where: { key: "reactions_enabled" } });
  if (!setting || setting.value !== "true") {
    return res.json({ enabled: false, data: {} });
  }

  const raw = await prisma.reaction.groupBy({
    by: ["movieId", "emoji"],
    _count: { emoji: true },
  });

  // Monta { movieId: { emoji: count } }
  const counts: Record<string, Record<string, number>> = {};
  for (const r of raw) {
    if (!counts[r.movieId]) counts[r.movieId] = {};
    counts[r.movieId][r.emoji] = r._count.emoji;
  }

  let userReactions: Record<string, string[]> = {};
  if (req.session.userId) {
    const mine = await prisma.reaction.findMany({
      where: { userId: req.session.userId },
      select: { movieId: true, emoji: true },
    });
    for (const r of mine) {
      if (!userReactions[r.movieId]) userReactions[r.movieId] = [];
      userReactions[r.movieId].push(r.emoji);
    }
  }

  res.json({ enabled: true, counts, userReactions });
});

// GET /api/reactions/:movieId — busca contagens e reações do usuário
router.get("/:movieId", async (req: Request, res: Response) => {
  const { movieId } = req.params;

  // Verifica se reações estão ativas
  const setting = await prisma.setting.findUnique({ where: { key: "reactions_enabled" } });
  if (!setting || setting.value !== "true") {
    return res.json({ enabled: false, counts: {}, userReactions: [] });
  }

  // Agrupa contagem por emoji
  const raw = await prisma.reaction.groupBy({
    by: ["emoji"],
    where: { movieId },
    _count: { emoji: true },
  });

  const counts: Record<string, number> = {};
  for (const r of raw) counts[r.emoji] = r._count.emoji;

  // Reações do usuário atual
  let userReactions: string[] = [];
  if (req.session.userId) {
    const mine = await prisma.reaction.findMany({
      where: { movieId, userId: req.session.userId },
      select: { emoji: true },
    });
    userReactions = mine.map((r) => r.emoji);
  }

  res.json({ enabled: true, counts, userReactions });
});

// POST /api/reactions/:movieId — adiciona ou remove reação (toggle)
router.post("/:movieId", requireAuth, async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const { emoji } = req.body as { emoji: string };
  const userId = req.session.userId!;

  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return res.status(400).json({ error: "Emoji inválido" });
  }

  // Verifica se reações estão ativas
  const setting = await prisma.setting.findUnique({ where: { key: "reactions_enabled" } });
  if (!setting || setting.value !== "true") {
    return res.status(403).json({ error: "Reações desativadas" });
  }

  const existing = await prisma.reaction.findUnique({
    where: { userId_movieId_emoji: { userId, movieId, emoji } },
  });

  if (existing) {
    // Toggle off — remove
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    // Toggle on — adiciona
    await prisma.reaction.create({ data: { userId, movieId, emoji } });
  }

  // Retorna contagem atualizada
  const raw = await prisma.reaction.groupBy({
    by: ["emoji"],
    where: { movieId },
    _count: { emoji: true },
  });

  const counts: Record<string, number> = {};
  for (const r of raw) counts[r.emoji] = r._count.emoji;

  const mine = await prisma.reaction.findMany({
    where: { movieId, userId },
    select: { emoji: true },
  });

  // ── Log ──
  await writeLog({
    action:  "REACTION",
    userId,
    movieId,
    meta: { emoji, removed: !!existing },
  });

  res.json({ counts, userReactions: mine.map((r) => r.emoji) });
});

export default router;
