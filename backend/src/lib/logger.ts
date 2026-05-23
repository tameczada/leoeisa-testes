import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type LogAction =
  | "VOTE"
  | "UNVOTE"
  | "VOTE_RETURN"
  | "MOVIE_ADD"
  | "MOVIE_REMOVE"
  | "MOVIE_EDIT"
  | "RESET_ALL"
  | "RESET_MOVIE";

interface LogParams {
  action: LogAction;
  userId?: string;
  movieId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Grava um log de auditoria de forma assíncrona e silenciosa.
 * Nunca lança erro — falha de log não deve travar a requisição.
 */
export async function writeLog(params: LogParams): Promise<void> {
  try {
    await prisma.log.create({
      data: {
        action:  params.action,
        userId:  params.userId  ?? null,
        movieId: params.movieId ?? null,
        meta:    params.meta ? (params.meta as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (err) {
    console.error("[logger] Failed to write log:", err);
  }
}
