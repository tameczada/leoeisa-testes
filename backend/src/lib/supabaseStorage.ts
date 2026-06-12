import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "";

const SUPABASE_SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const BUCKET = "emotes";

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    throw new Error(
      "Supabase não configurado — defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    realtime: {
      log_level: "info",
      transport: ws,
    } as any,
  });
}

export async function uploadEmote(
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const supabase = getSupabaseClient();

  const path = `emotes/${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function deleteEmote(path: string) {
  const supabase = getSupabaseClient();

  const cleanPath = path.replace(/^emotes\//, "");

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([cleanPath]);

  if (error) {
    throw error;
  }

  return true;
}