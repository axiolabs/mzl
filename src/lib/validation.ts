import { z } from "zod";

const name = z.string().trim().min(1, "Requerido").max(60).regex(/^[\p{L}][\p{L} '.-]*$/u, "Sólo letras");
export const MIN_AGE = 18;

export function ageFrom(dateStr: string, now = new Date()) {
  const d = new Date(dateStr + "T00:00:00Z");
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export const passwordSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Incluye letras y números");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Mínimo 3 caracteres")
  .max(30)
  .regex(/^[a-z0-9_.]+$/, "Sólo letras minúsculas, números, punto y guion bajo");

export const emailSchema = z.string().trim().toLowerCase().email("Correo no válido").max(254);

export const registerSchema = z
  .object({
    firstName: name,
    lastName: name,
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida")
      .refine((v) => ageFrom(v) >= MIN_AGE, `Debes tener al menos ${MIN_AGE} años`)
      .refine((v) => ageFrom(v) <= 110, "Fecha no válida"),
    barrioId: z.coerce.number().int().positive("Elige tu barrio o sector"),
    acceptTerms: z.literal(true, { message: "Debes aceptar los términos y la política de privacidad" }),
  })
  .strict();

export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128), appealMessage: z.string().max(1000).optional() })
  .strict();
export const forgotSchema = z.object({ email: emailSchema }).strict();
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema }).strict();
export const tokenSchema = z.object({ token: z.string().min(20).max(200) }).strict();

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

export const planBase = z
  .object({
    title: z.string().trim().min(4, "Mínimo 4 caracteres").max(100),
    description: z.string().trim().min(10, "Mínimo 10 caracteres").max(2000),
    categoryId: z.coerce.number().int().positive("Elige una categoría"),
    kind: z.enum(["community", "verified"]).default("community"),
    coverUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === "" || /^https:\/\/[^\s"'<>]+$/.test(v) || /^\/images\/[a-z0-9_-]+\.(jpg|png|webp)$/.test(v), "Usa una URL https")
      .optional()
      .or(z.literal("")),
    startsAt: isoDate,
    endsAt: isoDate.optional().or(z.literal("")),
    placeId: z.coerce.number().int().positive().optional().nullable(),
    locationName: z.string().trim().min(3, "Indica el punto de encuentro").max(140),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    capacity: z.coerce.number().int().min(2, "Mínimo 2").max(500, "Máximo 500"),
    requirements: z.string().trim().max(500).optional().or(z.literal("")),
    visibility: z.enum(["public", "unlisted"]).default("public"),
    publish: z.boolean().default(true),
  })
  .strict();

export function checkPlanDates(v: { startsAt: string; endsAt?: string }, now = new Date()): string | null {
  const s = new Date(v.startsAt).getTime();
  if (s < now.getTime() + 10 * 60_000) return "La fecha de inicio debe ser futura (al menos 10 minutos).";
  if (s > now.getTime() + 365 * 86400_000) return "La fecha no puede superar un año.";
  if (v.endsAt) {
    const e = new Date(v.endsAt).getTime();
    if (e <= s) return "La finalización debe ser posterior al inicio.";
    if (e - s > 7 * 86400_000) return "La duración máxima es de 7 días.";
  }
  return null;
}

export const planCreateSchema = planBase;
export const planUpdateSchema = planBase.omit({ kind: true }).partial().strict();

export const participationRequestSchema = z.object({ message: z.string().trim().max(300).optional() }).strict();
export const participationDecisionSchema = z.object({ action: z.enum(["accept", "reject", "remove"]) }).strict();

export const profileSchema = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    bio: z.string().trim().max(280).optional(),
    barrioId: z.coerce.number().int().positive().nullable().optional(),
    interests: z.array(z.coerce.number().int().positive()).max(12).optional(),
    showBarrio: z.boolean().optional(),
    showInterests: z.boolean().optional(),
    showUpcoming: z.boolean().optional(),
    useBarrioForRecommendations: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
  })
  .strict();

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }).strict();
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128), confirm: z.literal("ELIMINAR") }).strict();

export const REPORT_REASONS = ["spam", "acoso", "contenido_inapropiado", "suplantacion", "riesgo_seguridad", "fraude", "otro"] as const;
export const reportSchema = z
  .object({
    targetType: z.enum(["user", "plan"]),
    targetId: z.string().uuid(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
  })
  .strict();

export const blockSchema = z.object({ userId: z.string().uuid() }).strict();

export const verificationRequestSchema = z
  .object({
    organizationName: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20, "Describe tu organización (mínimo 20 caracteres)").max(1000),
    evidenceUrl: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === "" || /^https:\/\/[^\s"'<>]+$/.test(v), "Usa una URL https")
      .optional(),
  })
  .strict();

export const verificationDecisionSchema = z
  .object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() })
  .strict();

export const adminUserActionSchema = z
  .object({
    action: z.enum(["suspend", "reactivate", "revoke_verification", "make_admin", "remove_admin"]),
    note: z.string().trim().min(3, "Indica una justificación").max(500),
  })
  .strict();

export const adminPlanActionSchema = z
  .object({ action: z.enum(["approve", "reject", "cancel", "restore"]), note: z.string().trim().max(500).optional() })
  .strict();

export const adminReportActionSchema = z
  .object({ status: z.enum(["reviewing", "resolved", "dismissed"]), resolution: z.string().trim().max(500).optional() })
  .strict();

export const catalogSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("category"), id: z.number().int().positive().optional(), slug: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(60), icon: z.string().regex(/^[a-z-]{2,40}$/).optional(), active: z.boolean().optional() }).strict(),
  z.object({ type: z.literal("barrio"), id: z.number().int().positive().optional(), name: z.string().trim().min(2).max(80), sector: z.string().trim().max(80).optional(), lat: z.number().optional(), lng: z.number().optional(), active: z.boolean().optional() }).strict(),
  z.object({ type: z.literal("place"), id: z.number().int().positive().optional(), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional(), barrioId: z.number().int().positive().nullable().optional(), lat: z.number(), lng: z.number(), active: z.boolean().optional() }).strict(),
]);

export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
