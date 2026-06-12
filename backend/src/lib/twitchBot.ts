import * as tmi from "tmi.js";
import { prisma } from "./prisma";

let client: tmi.Client | null = null;
let isConnected = false;

export async function startBot(): Promise<void> {
  const channel  = process.env.TWITCH_BOT_CHANNEL  || "";
  const username = process.env.TWITCH_BOT_USERNAME  || "";
  const token    = process.env.TWITCH_BOT_TOKEN     || "";

  if (!channel || !username || !token) {
    console.log("[bot] Variáveis TWITCH_BOT_CHANNEL, TWITCH_BOT_USERNAME ou TWITCH_BOT_TOKEN não configuradas.");
    return;
  }

  const setting = await prisma.setting.findUnique({ where: { key: "bot_enabled" } });
  if (!setting || setting.value !== "true") {
    console.log("[bot] Bot desativado nas configurações.");
    return;
  }

  if (isConnected) return;

  client = new tmi.Client({
    identity: {
      username,
      password: token.startsWith("oauth:") ? token : `oauth:${token}`,
    },
    channels: [channel],
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

/**
 * Notifica o chat quando um filme é adicionado.
 * Substitui variáveis no template: {titulo}, {ano}, {categoria}
 */
export async function notifyMovieAdded(movie: {
  title: string;
  year: number;
  category: string;
}): Promise<void> {
  if (!isConnected || !client) return;

  const channel  = process.env.TWITCH_BOT_CHANNEL || "";
  const setting  = await prisma.setting.findUnique({ where: { key: "bot_message_template" } });
  const template = setting?.value || "🎬 Novo filme adicionado: {titulo} ({ano}) - {categoria}";

  const message = template
    .replace(/\{titulo\}/gi,    movie.title)
    .replace(/\{ano\}/gi,       String(movie.year))
    .replace(/\{categoria\}/gi, movie.category);

  try {
    await client.say(`#${channel}`.replace("##", "#"), message);
  } catch (err) {
    console.error("[bot] Erro ao enviar mensagem:", err);
  }
}