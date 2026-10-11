import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { appeals, authTokens, barrios, sessions, userPreferences, users } from "@/db/schema";
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  tokenSchema,
} from "@/lib/validation";
import {
  ApiError,
  appBaseUrl,
  audit,
  clientIp,
  createSession,
  destroyCurrentSession,
  dummyVerify,
  getSessionUser,
  hashPassword,
  json,
  parseBody,
  rateLimit,
  randomToken,
  requireUser,
  sendEmail,
  sha256,
  verifyPassword,
} from "../core";
import { publicUser } from "../serializers";
import type { Route } from "./types";

const NEUTRAL_REGISTER = "Si los datos son válidos, tu cuenta quedó creada. Revisa tu correo para verificarla.";

async function issueToken(userId: string, type: "verify_email" | "reset_password", ttlMin: number) {
  const token = randomToken();
  // Invalida tokens anteriores del mismo tipo
  await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt)));
  await db.insert(authTokens).values({ userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMin * 60_000) });
  return token;
}

async function consumeToken(token: string, type: "verify_email" | "reset_password") {
  const rows = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.type, type), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .returning({ userId: authTokens.userId });
  return rows[0]?.userId ?? null;
}

export const authRoutes: Route[] = [
  {
    method: "POST",
    path: "auth/register",
    handler: async ({ req }) => {
      await rateLimit(`register:${clientIp(req)}`, 10, 3600);
      const body = await parseBody(req, registerSchema);
      const [barrio] = await db.select().from(barrios).where(and(eq(barrios.id, body.barrioId), eq(barrios.active, true)));
      if (!barrio) throw new ApiError(422, "validation", "Revisa los datos del formulario.", { barrioId: "Barrio no válido" });
      const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, body.username));
      if (taken) throw new ApiError(422, "validation", "Revisa los datos del formulario.", { username: "Ese nombre de usuario no está disponible" });
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
      if (existing) {
        // No revelamos que el correo existe: respondemos igual y avisamos al titular por correo.
        await sendEmail(body.email, "Intento de registro en MZL Parchado", "Alguien intentó registrarse con tu correo. Si eras tú, inicia sesión o recupera tu contraseña.");
        return json({ ok: true, message: NEUTRAL_REGISTER }, 201);
      }
      const passwordHash = await hashPassword(body.password);
      const created = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(users)
          .values({
            email: body.email,
            username: body.username,
            firstName: body.firstName,
            lastName: body.lastName,
            passwordHash,
            birthDate: body.birthDate,
            barrioId: body.barrioId,
            termsAcceptedAt: new Date(),
          })
          .returning();
        await tx.insert(userPreferences).values({ userId: u.id });
        return u;
      });
      const token = await issueToken(created.id, "verify_email", 24 * 60);
      await sendEmail(body.email, "Verifica tu correo en MZL Parchado", `Hola ${body.firstName}, confirma tu correo aquí: ${appBaseUrl(req)}/verificar-correo?token=${token}\nEl enlace vence en 24 horas.`);
      await createSession(created.id, req.headers.get("user-agent"), req);
      return json({ ok: true, message: NEUTRAL_REGISTER }, 201);
    },
  },
  {
    method: "POST",
    path: "auth/login",
    handler: async ({ req }) => {
      const body = await parseBody(req, loginSchema);
      await rateLimit(`login-ip:${clientIp(req)}`, 30, 900);
      await rateLimit(`login-email:${body.email}`, 8, 900);
      const [u] = await db.select().from(users).where(eq(users.email, body.email));
      const generic = new ApiError(401, "invalid_credentials", "Correo o contraseña incorrectos.");
      if (!u) {
        await dummyVerify(body.password);
        throw generic;
      }
      if (!(await verifyPassword(u.passwordHash, body.password))) throw generic;
      if (u.status === "deleted") throw generic;
      if (u.status === "suspended") {
        if (body.appealMessage && body.appealMessage.trim().length >= 10) {
          await rateLimit(`appeal:${u.id}`, 3, 86400);
          await db.insert(appeals).values({ userId: u.id, message: body.appealMessage.trim() });
          throw new ApiError(403, "suspended", "Tu apelación fue enviada. Un administrador la revisará.");
        }
        throw new ApiError(403, "suspended", "Tu cuenta está suspendida. Puedes enviar una apelación desde este formulario.");
      }
      await createSession(u.id, req.headers.get("user-agent"), req);
      return json({ ok: true, user: { username: u.username, role: u.role } });
    },
  },
  {
    method: "POST",
    path: "auth/logout",
    handler: async () => {
      await destroyCurrentSession();
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "auth/me",
    handler: async () => {
      const u = await getSessionUser();
      if (!u) return json({ user: null });
      return json({
        user: { ...publicUser(u), email: u.email, role: u.role, emailVerified: !!u.emailVerifiedAt, barrioId: u.barrioId },
      });
    },
  },
  {
    method: "POST",
    path: "auth/verify-email",
    handler: async ({ req }) => {
      await rateLimit(`verify:${clientIp(req)}`, 20, 3600);
      const { token } = await parseBody(req, tokenSchema);
      const userId = await consumeToken(token, "verify_email");
      if (!userId) throw new ApiError(400, "invalid_token", "El enlace no es válido o ya venció.");
      await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "auth/resend-verification",
    handler: async ({ req }) => {
      const u = await requireUser();
      await rateLimit(`resend:${u.id}`, 3, 3600);
      if (u.emailVerifiedAt) return json({ ok: true });
      const token = await issueToken(u.id, "verify_email", 24 * 60);
      await sendEmail(u.email, "Verifica tu correo en MZL Parchado", `Confirma tu correo: ${appBaseUrl(req)}/verificar-correo?token=${token}`);
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "auth/forgot-password",
    handler: async ({ req }) => {
      const { email } = await parseBody(req, forgotSchema);
      await rateLimit(`forgot-ip:${clientIp(req)}`, 10, 3600);
      await rateLimit(`forgot-email:${email}`, 3, 3600);
      const [u] = await db.select().from(users).where(eq(users.email, email));
      if (u && u.status === "active") {
        const token = await issueToken(u.id, "reset_password", 30);
        await sendEmail(email, "Restablece tu contraseña", `Usa este enlace (vence en 30 minutos, un solo uso): ${appBaseUrl(req)}/restablecer?token=${token}`);
      }
      return json({ ok: true, message: "Si existe una cuenta con ese correo, enviaremos instrucciones." });
    },
  },
  {
    method: "POST",
    path: "auth/reset-password",
    handler: async ({ req }) => {
      await rateLimit(`reset:${clientIp(req)}`, 10, 3600);
      const { token, password } = await parseBody(req, resetSchema);
      const userId = await consumeToken(token, "reset_password");
      if (!userId) throw new ApiError(400, "invalid_token", "El enlace no es válido o ya venció.");
      await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, userId));
      await db.delete(sessions).where(eq(sessions.userId, userId)); // revoca todas las sesiones
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "auth/change-password",
    handler: async ({ req }) => {
      const u = await requireUser();
      await rateLimit(`chpw:${u.id}`, 5, 3600);
      const b = await parseBody(req, changePasswordSchema);
      if (!(await verifyPassword(u.passwordHash, b.currentPassword)))
        throw new ApiError(422, "validation", "Contraseña actual incorrecta.", { currentPassword: "Incorrecta" });
      await db.update(users).set({ passwordHash: await hashPassword(b.newPassword), updatedAt: new Date() }).where(eq(users.id, u.id));
      await db.delete(sessions).where(and(eq(sessions.userId, u.id), ne(sessions.id, u.sessionId)));
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "auth/sessions",
    handler: async () => {
      const u = await requireUser();
      const rows = await db
        .select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
        .from(sessions)
        .where(and(eq(sessions.userId, u.id), gt(sessions.expiresAt, new Date())));
      return json({ sessions: rows.map((s) => ({ ...s, id: s.id.slice(0, 8), current: s.id === u.sessionId })) });
    },
  },
  {
    method: "POST",
    path: "auth/revoke-other-sessions",
    handler: async () => {
      const u = await requireUser();
      await db.delete(sessions).where(and(eq(sessions.userId, u.id), ne(sessions.id, u.sessionId)));
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "account/delete",
    handler: async ({ req }) => {
      const u = await requireUser();
      const b = await parseBody(req, deleteAccountSchema);
      if (!(await verifyPassword(u.passwordHash, b.password)))
        throw new ApiError(422, "validation", "Contraseña incorrecta.", { password: "Incorrecta" });
      // Eliminación: se borra la cuenta y en cascada sus datos (planes, solicitudes, favoritos, notificaciones, fotos).
      await db.transaction(async (tx) => {
        await audit({ actorId: null, action: "account.deleted", targetType: "user", targetId: u.id, note: "Eliminación solicitada por el titular" }, tx);
        await tx.delete(users).where(eq(users.id, u.id));
      });
      await destroyCurrentSession();
      return json({ ok: true });
    },
  },
];
