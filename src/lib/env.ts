import { parseBounds } from "./geo";

/** Configuración del servidor. Nunca importar desde componentes cliente. */
export function serverEnv() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error("Falta la variable obligatoria DATABASE_URL");
  return {
    isProd: process.env.NODE_ENV === "production",
    appUrl: process.env.APP_URL?.replace(/\/$/, "") || null,
    bounds: parseBounds(process.env.GEO_BOUNDS),
    resendKey: process.env.RESEND_API_KEY || null,
    emailFrom: process.env.EMAIL_FROM || null,
    cloudinary:
      process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
        ? {
            cloud: process.env.CLOUDINARY_CLOUD_NAME,
            key: process.env.CLOUDINARY_API_KEY,
            secret: process.env.CLOUDINARY_API_SECRET,
          }
        : null,
  };
}

export function integrationStatus() {
  const e = serverEnv();
  return {
    email: e.resendKey && e.emailFrom ? "resend" : "pendiente (outbox en BD)",
    images: e.cloudinary ? "cloudinary" : "postgresql (local)",
    maps: "openstreetmap (sin clave)",
  };
}
