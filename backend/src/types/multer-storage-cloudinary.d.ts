declare module "multer-storage-cloudinary" {
  import { StorageEngine } from "multer";
  import { v2 as CloudinaryType } from "cloudinary";

  interface CloudinaryStorageOptions {
    cloudinary: typeof CloudinaryType;
    params?: Record<string, unknown> | ((req: any, file: any) => Promise<Record<string, unknown>>);
  }

  export class CloudinaryStorage implements StorageEngine {
    constructor(options: CloudinaryStorageOptions);
    _handleFile(req: any, file: any, cb: (error?: any, info?: any) => void): void;
    _removeFile(req: any, file: any, cb: (error: Error | null) => void): void;
  }
}
