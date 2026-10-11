import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import {
  barrios,
  blocks,
  categories,
  favorites,
  media,
  notifications,
  organizerVerifications,
  planParticipations,
  plans,
  reports,
  userInterests,
  userPreferences,
  users,
} from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { detectImageType, MAX_AVATAR_BYTES, validateDimensions } from "@/lib/image";
import { blockSchema, profileSchema, reportSchema, verificationRequestSchema } from "@/lib/validation";
import { ApiError, assertSameOrigin, forbidden, json, notFound, parseBody, rateLimit, requireUser } from "../core";
import { toPlanDTO } from "../plans";
import { publicUser } from "../serializers";
import type { Route } from "./types";

const uuidRe = /^[0-9a-f-]{36}$/i;

async function cloudinaryCall(path: "upload" | "destroy", params: Record<string, string>, file?: string) {
  const c = serverEnv().cloudinary!;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = { ...params, timestamp };
  const toSign = Object.keys(signed).sort().map((k) => `${k}=${signed[k as keyof typeof signed]}`).join("&");
  const signature = createHash("sha1").update(toSign + c.secret).digest("hex");
  const form = new FormData();
  for (const [k, v] of Object.entries(signed)) form.append(k, v);
  form.append("api_key", c.key);
  form.append("signature", signature);
  if (file) form.append("file", file);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/image/${path}`, { method: "POST", body: form, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new ApiError(502, "upstream", "El servicio de imágenes no respondió. Intenta más tarde.");
  return (await r.json()) as { public_id?: string; secure_url?: string; result?: string };
}

async function removeMedia(id: string) {
  const [m] = await db.select().from(media).where(eq(media.id, id));
  if (!m) return;
  if (m.provider === "cloudinary" && m.externalId && serverEnv().cloudinary) {
    try {
      await cloudinaryCall("destroy", { public_id: m.externalId });
    } catch {
      console.warn("[media] no se pudo borrar recurso remoto; queda registrado para limpieza");
      return; // se mantiene la fila (sin referencia) para limpieza posterior de huérfanos
    }
  }
  await db.delete(media).where(eq(media.id, id));
}

export const socialRoutes: Route[] = [
  // ---------- Favoritos ----------
  {
    method: "GET",
    path: "favorites",
    handler: async () => {
      const u = await requireUser();
      const rows = await db
        .select({ p: plans, c: categories, u: users })
        .from(favorites)
        .innerJoin(plans, eq(plans.id, favorites.planId))
        .innerJoin(categories, eq(categories.id, plans.categoryId))
        .innerJoin(users, eq(users.id, plans.creatorId))
        .where(eq(favorites.userId, u.id))
        .orderBy(desc(favorites.createdAt));
      return json({ items: rows.map((r) => toPlanDTO(r)) });
    },
  },
  {
    method: "PUT",
    path: "favorites/:planId",
    handler: async ({ params }) => {
      const u = await requireUser();
      await rateLimit(`fav:${u.id}`, 120, 3600);
      if (!uuidRe.test(params.planId)) throw notFound();
      const [p] = await db.select({ id: plans.id, visibility: plans.visibility, status: plans.status }).from(plans).where(eq(plans.id, params.planId));
      if (!p || p.status === "draft" || p.status === "pending_review") throw notFound();
      await db.insert(favorites).values({ userId: u.id, planId: p.id }).onConflictDoNothing();
      return json({ ok: true, favorite: true });
    },
  },
  {
    method: "DELETE",
    path: "favorites/:planId",
    handler: async ({ params }) => {
      const u = await requireUser();
      if (!uuidRe.test(params.planId)) throw notFound();
      await db.delete(favorites).where(and(eq(favorites.userId, u.id), eq(favorites.planId, params.planId)));
      return json({ ok: true, favorite: false });
    },
  },
  // ---------- Notificaciones ----------
  {
    method: "GET",
    path: "notifications",
    handler: async () => {
      const u = await requireUser();
      const items = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(50);
      return json({ items, unread: items.filter((n) => !n.readAt).length });
    },
  },
  {
    method: "POST",
    path: "notifications/read-all",
    handler: async () => {
      const u = await requireUser();
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, u.id), isNull(notifications.readAt)));
      return json({ ok: true });
    },
  },
  // ---------- Reportes ----------
  {
    method: "POST",
    path: "reports",
    handler: async ({ req }) => {
      const u = await requireUser();
      await rateLimit(`report:${u.id}`, 10, 86400);
      const b = await parseBody(req, reportSchema);
      if (b.targetType === "user") {
        if (b.targetId === u.id) throw new ApiError(422, "validation", "No puedes reportarte a ti.");
        const [t] = await db.select({ id: users.id }).from(users).where(eq(users.id, b.targetId));
        if (!t) throw notFound();
      } else {
        const [t] = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, b.targetId));
        if (!t) throw notFound();
      }
      await db.insert(reports).values({
        reporterId: u.id,
        targetType: b.targetType,
        targetUserId: b.targetType === "user" ? b.targetId : null,
        targetPlanId: b.targetType === "plan" ? b.targetId : null,
        reason: b.reason,
        details: b.details || null,
      });
      return json({ ok: true, message: "Gracias. El equipo de moderación revisará el reporte." }, 201);
    },
  },
  // ---------- Bloqueos ----------
  {
    method: "GET",
    path: "blocks",
    handler: async () => {
      const u = await requireUser();
      const rows = await db.select({ u: users }).from(blocks).innerJoin(users, eq(users.id, blocks.blockedId)).where(eq(blocks.blockerId, u.id));
      return json({ items: rows.map((r) => publicUser(r.u)) });
    },
  },
  {
    method: "POST",
    path: "blocks",
    handler: async ({ req }) => {
      const u = await requireUser();
      await rateLimit(`block:${u.id}`, 50, 86400);
      const { userId } = await parseBody(req, blockSchema);
      if (userId === u.id) throw new ApiError(422, "validation", "No puedes bloquearte a ti.");
      const [t] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!t) throw notFound();
      await db.transaction(async (tx) => {
        await tx.insert(blocks).values({ blockerId: u.id, blockedId: userId }).onConflictDoNothing();
        // Las solicitudes pendientes del bloqueado a mis planes se rechazan automáticamente.
        const myPlans = tx.select({ id: plans.id }).from(plans).where(eq(plans.creatorId, u.id));
        await tx
          .update(planParticipations)
          .set({ status: "rejected", updatedAt: new Date() })
          .where(and(eq(planParticipations.userId, userId), eq(planParticipations.status, "pending"), inArray(planParticipations.planId, myPlans)));
      });
      return json({ ok: true });
    },
  },
  {
    method: "DELETE",
    path: "blocks/:userId",
    handler: async ({ params }) => {
      const u = await requireUser();
      if (!uuidRe.test(params.userId)) throw notFound();
      await db.delete(blocks).where(and(eq(blocks.blockerId, u.id), eq(blocks.blockedId, params.userId)));
      return json({ ok: true });
    },
  },
  // ---------- Perfil ----------
  {
    method: "GET",
    path: "profile",
    handler: async () => {
      const u = await requireUser();
      const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, u.id));
      const ints = await db.select({ id: userInterests.categoryId }).from(userInterests).where(eq(userInterests.userId, u.id));
      const [barrio] = u.barrioId ? await db.select().from(barrios).where(eq(barrios.id, u.barrioId)) : [];
      return json({
        profile: {
          ...publicUser(u),
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          emailVerified: !!u.emailVerifiedAt,
          bio: u.bio,
          city: u.city,
          barrioId: u.barrioId,
          barrioName: barrio?.name ?? null,
          role: u.role,
          interests: ints.map((i) => i.id),
          preferences: prefs ?? null,
        },
      });
    },
  },
  {
    method: "PATCH",
    path: "profile",
    handler: async ({ req }) => {
      const u = await requireUser();
      const b = await parseBody(req, profileSchema);
      if (b.barrioId) {
        const [br] = await db.select().from(barrios).where(and(eq(barrios.id, b.barrioId), eq(barrios.active, true)));
        if (!br) throw new ApiError(422, "validation", "Barrio no válido.", { barrioId: "Barrio no válido" });
      }
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ firstName: b.firstName, lastName: b.lastName, bio: b.bio === undefined ? undefined : b.bio || null, barrioId: b.barrioId, updatedAt: new Date() })
          .where(eq(users.id, u.id));
        const prefs = {
          showBarrio: b.showBarrio,
          showInterests: b.showInterests,
          showUpcoming: b.showUpcoming,
          useBarrioForRecommendations: b.useBarrioForRecommendations,
          emailNotifications: b.emailNotifications,
        };
        if (Object.values(prefs).some((v) => v !== undefined)) {
          await tx.insert(userPreferences).values({ userId: u.id, ...prefs }).onConflictDoUpdate({ target: userPreferences.userId, set: prefs });
        }
        if (b.interests) {
          const valid = b.interests.length ? await tx.select({ id: categories.id }).from(categories).where(inArray(categories.id, b.interests)) : [];
          await tx.delete(userInterests).where(eq(userInterests.userId, u.id));
          if (valid.length) await tx.insert(userInterests).values(valid.map((v) => ({ userId: u.id, categoryId: v.id })));
        }
      });
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "profile/avatar",
    handler: async ({ req }) => {
      const u = await requireUser();
      await rateLimit(`avatar:${u.id}`, 10, 3600);
      const len = Number(req.headers.get("content-length") || 0);
      if (len > MAX_AVATAR_BYTES + 64_000) throw new ApiError(413, "too_large", "La imagen supera 3 MB.");
      const form = await req.formData().catch(() => null);
      const file = form?.get("file");
      if (!file || typeof file === "string") throw new ApiError(422, "validation", "Adjunta una imagen.");
      if (file.size > MAX_AVATAR_BYTES) throw new ApiError(413, "too_large", "La imagen supera 3 MB.");
      const buf = Buffer.from(await file.arrayBuffer());
      const kind = detectImageType(buf);
      if (!kind) throw new ApiError(415, "bad_type", "Formato no permitido. Usa JPG, PNG o WebP.");
      let meta;
      try {
        meta = await sharp(buf, { limitInputPixels: 40_000_000 }).metadata();
      } catch {
        throw new ApiError(415, "bad_image", "El archivo no es una imagen válida.");
      }
      const dimErr = validateDimensions(meta.width, meta.height);
      if (dimErr) throw new ApiError(422, "validation", dimErr);
      // Re-codificación: elimina EXIF/GPS y cualquier contenido no-imagen.
      const out = await sharp(buf).rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
      const env = serverEnv();
      let row: { id: string };
      if (env.cloudinary) {
        const publicId = `${u.id}-${randomBytes(6).toString("hex")}`;
        const up = await cloudinaryCall("upload", { folder: "mzl-parchado/avatars", public_id: publicId }, `data:image/webp;base64,${out.toString("base64")}`);
        if (!up.public_id || !up.secure_url) throw new ApiError(502, "upstream", "No se pudo guardar la imagen.");
        try {
          [row] = await db.insert(media).values({ ownerId: u.id, provider: "cloudinary", mime: "image/webp", width: 512, height: 512, size: out.length, externalId: up.public_id, url: up.secure_url }).returning({ id: media.id });
        } catch (e) {
          await cloudinaryCall("destroy", { public_id: up.public_id }).catch(() => null); // evita huérfanos remotos
          throw e;
        }
      } else {
        [row] = await db.insert(media).values({ ownerId: u.id, provider: "db", mime: "image/webp", width: 512, height: 512, size: out.length, data: out }).returning({ id: media.id });
      }
      const previous = u.avatarMediaId;
      await db.update(users).set({ avatarMediaId: row.id, updatedAt: new Date() }).where(eq(users.id, u.id));
      if (previous) await removeMedia(previous);
      return json({ ok: true, avatarUrl: `/api/v1/media/${row.id}` }, 201);
    },
  },
  {
    method: "DELETE",
    path: "profile/avatar",
    handler: async () => {
      const u = await requireUser();
      if (!u.avatarMediaId) return json({ ok: true });
      await db.update(users).set({ avatarMediaId: null, updatedAt: new Date() }).where(eq(users.id, u.id));
      await removeMedia(u.avatarMediaId);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "media/:id",
    handler: async ({ params, query }) => {
      if (!uuidRe.test(params.id)) throw notFound();
      const [m] = await db.select().from(media).where(eq(media.id, params.id));
      if (!m) throw notFound();
      const size = Math.min(Math.max(Number(query.get("s")) || 512, 32), 512);
      if (m.provider === "cloudinary" && m.url) {
        return Response.redirect(m.url.replace("/upload/", `/upload/c_fill,w_${size},h_${size},f_auto,q_auto/`), 302);
      }
      if (!m.data) throw notFound();
      const body = size < 512 ? await sharp(m.data).resize(size, size).webp({ quality: 80 }).toBuffer() : m.data;
      return new Response(new Uint8Array(body), {
        headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
      });
    },
  },
  // ---------- Organizadores ----------
  {
    method: "GET",
    path: "organizer/status",
    handler: async () => {
      const u = await requireUser();
      const items = await db.select().from(organizerVerifications).where(eq(organizerVerifications.userId, u.id)).orderBy(desc(organizerVerifications.createdAt));
      return json({ isVerifiedOrganizer: u.isVerifiedOrganizer, organizerName: u.organizerName, emailVerified: !!u.emailVerifiedAt, requests: items.map(({ reviewedById: _r, ...rest }) => (void _r, rest)) });
    },
  },
  {
    method: "POST",
    path: "organizer/verification",
    handler: async ({ req }) => {
      const u = await requireUser();
      await rateLimit(`verif-req:${u.id}`, 3, 86400 * 7);
      const b = await parseBody(req, verificationRequestSchema);
      if (!u.emailVerifiedAt) throw forbidden("Verifica tu correo antes de solicitar la verificación.");
      if (u.isVerifiedOrganizer) throw new ApiError(409, "conflict", "Ya eres organizador verificado.");
      const [pending] = await db.select().from(organizerVerifications).where(and(eq(organizerVerifications.userId, u.id), eq(organizerVerifications.status, "pending")));
      if (pending) throw new ApiError(409, "conflict", "Ya tienes una solicitud en revisión.");
      await db.insert(organizerVerifications).values({ userId: u.id, organizationName: b.organizationName, description: b.description, evidenceUrl: b.evidenceUrl || null });
      return json({ ok: true }, 201);
    },
  },
  {
    method: "GET",
    path: "organizer/stats",
    handler: async () => {
      const u = await requireUser();
      const rows = await db
        .select({
          id: plans.id,
          title: plans.title,
          status: plans.status,
          kind: plans.kind,
          startsAt: plans.startsAt,
          capacity: plans.capacity,
          acceptedCount: plans.acceptedCount,
          pending: sql<number>`(select count(*)::int from plan_participations pp where pp.plan_id = ${plans.id} and pp.status = 'pending')`,
          rejected: sql<number>`(select count(*)::int from plan_participations pp where pp.plan_id = ${plans.id} and pp.status = 'rejected')`,
          favorites: sql<number>`(select count(*)::int from favorites f where f.plan_id = ${plans.id})`,
        })
        .from(plans)
        .where(eq(plans.creatorId, u.id))
        .orderBy(desc(plans.startsAt));
      return json({ items: rows });
    },
  },
];
void assertSameOrigin;
