import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, emailOutbox, notifications, sessions, users } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { fieldErrors } from "@/lib/validation";
import type { Actor } from "@/lib/permissions";

export const SESSION_COOKIE = "mzl_session";
const SESSION_DAYS = 30;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export const unauthorized = () => new ApiError(401, "unauthorized", "Debes iniciar sesión.");
export const forbidden = (m = "No tienes permiso para esta acción.") => new ApiError(403, "forbidden", m);
export const notFound = (m = "Recurso no encontrado.") => new ApiError(404, "not_found", m);

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) return json({ error: { code: err.code, message: err.message, fields: err.fields } }, err.status);
  if (err instanceof SyntaxError) return json({ error: { code: "bad_json", message: "Cuerpo JSON inválido." } }, 400);
  // Log mínimo, sin cuerpos de petición ni secretos.
  console.error("[api] error interno:", err instanceof Error ? err.message : "desconocido");
  return json({ error: { code: "internal", message: "Ocurrió un error inesperado. Intenta de nuevo." } }, 500);
}

export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T, maxBytes = 32_000): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new ApiError(413, "too_large", "La petición es demasiado grande.");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "too_large", "La petición es demasiado grande.");
  const data = text ? JSON.parse(text) : {};
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(422, "validation", "Revisa los datos del formulario.", fieldErrors(r.error));
  return r.data;
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

// Parámetros OWASP para Argon2id: m=19 MiB, t=2, p=1 (algorithm 2 = Argon2id)
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 as const };
export const hashPassword = (p: string) => argonHash(p, ARGON);
export async function verifyPassword(hash: string, p: string) {
  try {
    return await argonVerify(hash, p);
  } catch {
    return false;
  }
}
// Hash ficticio para igualar tiempos cuando el usuario no existe.
let dummyHash: string | null = null;
export async function dummyVerify(p: string) {
  dummyHash ??= await hashPassword("dummy-password-0000");
  await verifyPassword(dummyHash, p);
}

/** Protección CSRF: toda petición mutante debe venir del mismo origen. */
export function assertSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const allowed = new Set<string>();
  const env = serverEnv();
  if (env.appUrl) allowed.add(new URL(env.appUrl).host);
  if (host) allowed.add(host);
  if (origin) {
    let oh = "";
    try {
      oh = new URL(origin).host;
    } catch {}
    if (allowed.has(oh)) return;
    throw new ApiError(403, "csrf", "Origen no permitido.");
  }
  if (site === "same-origin") return;
  throw new ApiError(403, "csrf", "Origen no permitido.");
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim().slice(0, 60);
}

/** Rate limit atómico en PostgreSQL (ventana fija). */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const res = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning count`);
  const count = Number(res.rows[0]?.count ?? 0);
  if (count > limit) throw new ApiError(429, "rate_limited", "Demasiados intentos. Espera un momento e inténtalo de nuevo.");
}

/** Secure: "always" | "never" | "auto" (por defecto: https detectado, o producción fuera de localhost). */
export function cookieShouldBeSecure(req: Request) {
  const mode = process.env.COOKIE_SECURE ?? "auto";
  if (mode === "always") return true;
  if (mode === "never" && !serverEnv().isProd) return false;
  const xf = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (xf) return xf === "https";
  const url = new URL(req.url);
  if (url.protocol === "https:") return true;
  const host = (req.headers.get("host") ?? url.host).split(":")[0];
  return serverEnv().isProd && host !== "localhost" && host !== "127.0.0.1";
}

export async function createSession(userId: string, userAgent: string | null, req: Request) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieShouldBeSecure(req),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = typeof users.$inferSelect & { sessionId: string };

/** Lee la sesión desde la cookie. Funciona en route handlers y Server Components. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const sid = sha256(token);
  const rows = await db
    .select({ u: users, s: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sid), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.u.status !== "active") return null;
  if (Date.now() - row.s.lastSeenAt.getTime() > 3600_000) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, sid));
  }
  return { ...row.u, sessionId: sid };
}

export async function requireUser() {
  const u = await getSessionUser();
  if (!u) throw unauthorized();
  return u;
}
export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") throw forbidden();
  return u;
}
export const toActor = (u: SessionUser): Actor => ({
  id: u.id,
  role: u.role,
  status: u.status,
  isVerifiedOrganizer: u.isVerifiedOrganizer,
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function audit(
  e: { actorId: string | null; action: string; targetType: string; targetId: string; before?: unknown; after?: unknown; note?: string | null },
  tx?: Tx,
) {
  await (tx ?? db).insert(auditLogs).values({
    actorId: e.actorId,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    before: e.before ?? null,
    after: e.after ?? null,
    note: e.note ?? null,
  });
}

export async function notify(userId: string, n: { type: string; title: string; body?: string; link?: string }, tx?: Tx) {
  await (tx ?? db).insert(notifications).values({ userId, ...n });
}

export function appBaseUrl(req?: Request) {
  const env = serverEnv();
  if (env.appUrl) return env.appUrl;
  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";
    if (host) return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}

/** Envía correo vía Resend si está configurado; si no, lo deja en email_outbox (sólo accesible desde la BD). */
export async function sendEmail(to: string, subject: string, body: string) {
  const env = serverEnv();
  if (!env.resendKey || !env.emailFrom) {
    await db.insert(emailOutbox).values({ to, subject, body, provider: "outbox" });
    if (!env.isProd) console.info(`[email] pendiente de proveedor; mensaje guardado en email_outbox para ${to.replace(/(.).+@/, "$1***@")}`);
    return;
  }
  let error: string | null = null;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to, subject, text: body }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) error = `HTTP ${r.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 200) : "error";
  }
  // No se guarda el cuerpo cuando el envío tuvo éxito (contiene enlaces de un solo uso).
  await db.insert(emailOutbox).values({ to, subject, body: error ? "[omitido]" : "[enviado]", provider: "resend", sentAt: error ? null : new Date(), error });
}

/** Para Server Components: redirige a login si no hay sesión válida. */
export async function pageUser() {
  const { redirect } = await import("next/navigation");
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u!;
}
