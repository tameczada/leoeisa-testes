import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET           = "emotes";

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    throw new Error("Supabase não configurado — defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    realtime: { log_level: "info" } as any,
  });
}

/**
 * Faz upload de um buffer de imagem pro bucket `emotes` e retorna a URL pública.
 */
export async function uploadEmote(
  filename: string,
  buffer: Buffer,
  mimetype: string
): Promise<string> {
  const supabase = getSupabaseClient();
  const path     = `${Date.now()}-${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimetype, upsert: false });

  if (error) throw new Error(`Upload falhou: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Remove um emote do bucket pelo path da URL pública.
 */
export async function deleteEmote(publicUrl: string): Promise<void> {
  const supabase = getSupabaseClient();
  const path     = publicUrl.split(`/storage/v1/object/public/${BUCKET}/`)[1];
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
