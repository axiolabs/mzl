export type ImageKind = "image/jpeg" | "image/png" | "image/webp";
export const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
export const MIN_AVATAR_DIM = 128;
export const MAX_AVATAR_DIM = 6000;

/** Detecta el tipo REAL por firma (magic bytes); ignora extensión y Content-Type declarados. */
export function detectImageType(buf: Uint8Array): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => buf[i] === b)) return "image/png";
  const ascii = (s: number, e: number) => String.fromCharCode(...buf.slice(s, e));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function validateDimensions(w: number | undefined, h: number | undefined): string | null {
  if (!w || !h) return "No se pudieron leer las dimensiones de la imagen.";
  if (w < MIN_AVATAR_DIM || h < MIN_AVATAR_DIM) return `La imagen debe medir al menos ${MIN_AVATAR_DIM}px por lado.`;
  if (w > MAX_AVATAR_DIM || h > MAX_AVATAR_DIM) return `La imagen no puede superar ${MAX_AVATAR_DIM}px por lado.`;
  return null;
}
