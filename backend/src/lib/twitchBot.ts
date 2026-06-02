import * as tmi from "tmi.js";
import { prisma } from "./prisma";

let client: tmi.Client | null = null;
let isConnected = false;

export async function startBot(): Promise<void> {
  const channel  = process.env.TWITCH_CHANNEL;
  const username = process.env.TWITCH_BOT_USERNAME;
  const token    = process.env.TWITCH_BOT_TOKEN;

  if (!channel || !username || !token) {
    console.log("[bot] Variáveis de ambiente não configuradas — bot não iniciado.");
    return;
  }

  // Verifica se bot está ativado no banco
  const setting = await prisma.setting.findUnique({ where: { key: "bot_enabled" } });
  if (!setting || setting.value !== "true") {
    console.log("[bot] Bot desativado nas configurações — não iniciado.");
    return;
  }

  if (isConnected) {
    console.log("[bot] Já conectado.");
    return;
  }

  client = new tmi.Client({
    identity: {
      username,
      password: token.startsWith("oauth:") ? token : `oauth:${token}`,
    },
    channels: [channel],
  });

  client.on("message", async (ch, tags, message, self) => {
    if (self) return;
    const msg = message.trim().toLowerCase();
    if (msg !== "!ranking") return;

    // Só moderadores e broadcaster
    const isMod        = tags.mod === true;
    const isBroadcaster = tags.badges?.broadcaster === "1";
    if (!isMod && !isBroadcaster) return;

    try {
      const topSetting = await prisma.setting.findUnique({ where: { key: "bot_top_count" } });
      const topN = parseInt(topSetting?.value || "3");

      const movies = await prisma.movie.findMany({
        where:   { active: true },
        orderBy: { voteCount: "desc" },
        take:    topN,
      });

      if (movies.length === 0) {
        client?.say(ch, "🎬 Nenhum filme na votação ainda.");
        return;
      }

      const ranking = movies
        .map((m, i) => `#${i + 1} ${m.title} (${m.voteCount} votos)`)
        .join(" | ");

      client?.say(ch, `🎬 Top ${topN}: ${ranking}`);
    } catch (err) {
      console.error("[bot] Erro ao buscar ranking:", err);
    }
  });

  client.on("connected", () => {
    isConnected = true;
    console.log(`[bot] Conectado ao canal #${channel}`);
  });

  client.on("disconnected", (reason) => {
    isConnected = false;
    console.log(`[bot] Desconectado: ${reason}`);
  });

  await client.connect().catch((err) => {
    console.error("[bot] Erro ao conectar:", err);
  });
}

export async function stopBot(): Promise<void> {
  if (client && isConnected) {
    await client.disconnect().catch(() => {});
    isConnected = false;
    client = null;
    console.log("[bot] Desconectado.");
  }
}

export async function restartBot(): Promise<void> {
  await stopBot();
  await startBot();
}

export function getBotStatus(): boolean {
  return isConnected;
}
