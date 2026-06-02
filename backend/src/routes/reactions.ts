import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const ALLOWED_EMOJIS = ["🔥", "❤️", "😂", "😮", "👏", "💀","💕","🙏","👀","🤓","😠","💩","🥱","💯","👌","👍"];

// Cache para evitar query repetida em settings
let cachedReactionSetting: boolean | null = null;
let cacheTime = 0;

async function reactionsEnabledCached() {
  const now = Date.now();

  // Cache por 60 segundos
  if (cachedReactionSetting !== null && now - cacheTime < 60000) {
    return cachedReactionSetting;
  }

  const setting = await prisma.setting.findUnique({
    where: { key: "reactions_enabled" },
  });

  cachedReactionSetting = setting?.value === "true";
  cacheTime = now;

  return cachedReactionSetting;
}

// GET /api/reactions/:movieId — busca contagens e reações do usuário
router.get("/:movieId", async (req: Request, res: Response) => {
  try {
    const { movieId } = req.params;

    // usa cache
    const enabled = await reactionsEnabledCached();

    if (!enabled) {
      return res.json({
        enabled: false,
        counts: {},
        userReactions: [],
      });
    }

    // queries paralelas
    const [raw, mine] = await Promise.all([
      prisma.reaction.groupBy({
        by: ["emoji"],
        where: { movieId },
        _count: { emoji: true },
      }),

      req.session.userId
        ? prisma.reaction.findMany({
            where: {
              movieId,
              userId: req.session.userId,
            },
            select: { emoji: true },
          })
        : Promise.resolve([]),
    ]);

    const counts: Record<string, number> = {};

    for (const r of raw) {
      counts[r.emoji] = r._count.emoji;
    }

    res.json({
      enabled: true,
      counts,
      userReactions: mine.map((r) => r.emoji),
    });
  } catch (err) {
    console.error("Reaction GET error:", err);

    res.status(500).json({
      enabled: false,
      counts: {},
      userReactions: [],
    });
  }
});

// POST /api/reactions/:movieId — adiciona ou remove reação (toggle)
router.post("/:movieId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { movieId } = req.params;
    const { emoji } = req.body as { emoji: string };
    const userId = req.session.userId!;

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({ error: "Emoji inválido" });
    }

    // usa cache
    const enabled = await reactionsEnabledCached();

    if (!enabled) {
      return res.status(403).json({ error: "Reações desativadas" });
    }

    const existing = await prisma.reaction.findUnique({
      where: { userId_movieId_emoji: { userId, movieId, emoji } },
    });

    if (existing) {
      await prisma.reaction.delete({
        where: { id: existing.id },
      });
    } else {
      await prisma.reaction.create({
        data: { userId, movieId, emoji },
      });
    }

    // Atualiza contagem
    const [raw, mine] = await Promise.all([
      prisma.reaction.groupBy({
        by: ["emoji"],
        where: { movieId },
        _count: { emoji: true },
      }),

      prisma.reaction.findMany({
        where: { movieId, userId },
        select: { emoji: true },
      }),
    ]);

    const counts: Record<string, number> = {};

    for (const r of raw) {
      counts[r.emoji] = r._count.emoji;
    }

    res.json({
      counts,
      userReactions: mine.map((r) => r.emoji),
    });
  } catch (err) {
    console.error("Reaction POST error:", err);

    res.status(500).json({
      error: "Erro interno",
    });
  }
});

export default router;
