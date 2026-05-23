import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configura o Cloudinary com as variáveis de ambiente
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage Cloudinary — salva na pasta "cinevote/posters"
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         "cinevote/posters",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 500, height: 281, crop: "fill", quality: "auto" }],
  } as any,
});

// Storage local — fallback quando Cloudinary não está configurado
import path from "path";
import fs from "fs";
import multerLib from "multer";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });

const localStorage = multerLib.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOCAL_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const isCloudinaryConfigured =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

export const upload = multer({
  storage: isCloudinaryConfigured ? cloudinaryStorage : localStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});

/**
 * Retorna a URL pública do arquivo enviado.
 * Funciona tanto com Cloudinary (req.file.path) quanto com disco local.
 */
export function getUploadedUrl(file: Express.Multer.File): string {
  // Cloudinary coloca a URL pública em `file.path`
  if (isCloudinaryConfigured && file.path) return file.path;
  // Local: monta caminho relativo
  return `/uploads/${file.filename}`;
}

/**
 * Remove uma imagem antiga do Cloudinary pelo public_id ou ignora silenciosamente.
 */
export async function deleteOldImage(posterUrl: string | null | undefined): Promise<void> {
  if (!posterUrl || !isCloudinaryConfigured) return;
  try {
    // URLs Cloudinary contêm "/upload/" seguido do public_id
    const match = posterUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    if (match) await cloudinary.uploader.destroy(match[1]);
  } catch {
    // Falha silenciosa — não bloqueia a requisição
  }
}
