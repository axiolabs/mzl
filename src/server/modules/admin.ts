import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { appeals, auditLogs, barrios, categories, organizerVerifications, plans, places, reports, sessions, users } from "@/db/schema";
import { integrationStatus, serverEnv } from "@/lib/env";
import { isWithinBounds } from "@/lib/geo";
import { canReviewVerification } from "@/lib/permissions";
import { adminPlanActionSchema, adminReportActionSchema, adminUserActionSchema, catalogSchema, verificationDecisionSchema } from "@/lib/validation";
import { ApiError, audit, forbidden, json, notFound, notify, parseBody, requireAdmin, toActor } from "../core";
import type { Route } from "./types";

const page = (q: URLSearchParams) => Math.max(1, Number(q.get("page")) || 1);
const PS = 20;
const uuidRe = /^[0-9a-f-]{36}$/i;

export const adminRoutes: Route[] = [
  {
    method: "GET",
    path: "admin/stats",
    handler: async () => {
      await requireAdmin();
      const r = await db.execute<Record<string, number>>(sql`select
        (select count(*)::int from users where status='active') as active_users,
        (select count(*)::int from users where status='suspended') as suspended_users,
        (select count(*)::int from users where is_verified_organizer) as organizers,
        (select count(*)::int from plans where status in ('published','full') and starts_at > now()) as upcoming_plans,
        (select count(*)::int from plans where status='pending_review') as pending_plans,
        (select count(*)::int from organizer_verifications where status='pending') as pending_verifications,
        (select count(*)::int from reports where status in ('open','reviewing')) as open_reports,
        (select count(*)::int from plan_participations where status='accepted') as accepted_participations,
        (select count(*)::int from appeals where status='open') as open_appeals`);
      return json({ stats: r.rows[0], integrations: integrationStatus() });
    },
  },
  {
    method: "GET",
    path: "admin/users",
    handler: async ({ query }) => {
      await requireAdmin();
      const conds: (SQL | undefined)[] = [];
      const q = query.get("q")?.slice(0, 80);
      if (q) conds.push(or(ilike(users.username, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.firstName, `%${q}%`)));
      const st = query.get("status");
      if (st === "active" || st === "suspended") conds.push(eq(users.status, st));
      const rows = await db
        .select({ id: users.id, username: users.username, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role, status: users.status, isVerifiedOrganizer: users.isVerifiedOrganizer, organizerName: users.organizerName, emailVerifiedAt: users.emailVerifiedAt, createdAt: users.createdAt })
        .from(users)
        .where(and(...conds))
        .orderBy(desc(users.createdAt))
        .limit(PS)
        .offset((page(query) - 1) * PS);
      return json({ items: rows, page: page(query) });
    },
  },
  {
    method: "PATCH",
    path: "admin/users/:id",
    handler: async ({ req, params }) => {
      const admin = await requireAdmin();
      if (!uuidRe.test(params.id)) throw notFound();
      const { action, note } = await parseBody(req, adminUserActionSchema);
      if (params.id === admin.id) throw forbidden("No puedes ejecutar acciones administrativas sobre tu propia cuenta.");
      const [t] = await db.select().from(users).where(eq(users.id, params.id));
      if (!t || t.status === "deleted") throw notFound();
      const before = { status: t.status, role: t.role, isVerifiedOrganizer: t.isVerifiedOrganizer };
      await db.transaction(async (tx) => {
        let after: Record<string, unknown> = {};
        if (action === "suspend") {
          after = { status: "suspended" };
          await tx.update(users).set({ status: "suspended", updatedAt: new Date() }).where(eq(users.id, t.id));
          await tx.delete(sessions).where(eq(sessions.userId, t.id)); // revoca sesiones activas
        } else if (action === "reactivate") {
          after = { status: "active" };
          await tx.update(users).set({ status: "active", updatedAt: new Date() }).where(eq(users.id, t.id));
        } else if (action === "revoke_verification") {
          if (!t.isVerifiedOrganizer) throw new ApiError(409, "conflict", "El usuario no es organizador verificado.");
          after = { isVerifiedOrganizer: false };
          await tx.update(users).set({ isVerifiedOrganizer: false, updatedAt: new Date() }).where(eq(users.id, t.id));
          await tx.update(organizerVerifications).set({ status: "revoked", reviewedById: admin.id, reviewedAt: new Date(), reviewNote: note }).where(and(eq(organizerVerifications.userId, t.id), eq(organizerVerifications.status, "approved")));
          // Permisos efectivos: sus eventos verificados futuros dejan de estar publicados.
          await tx.execute(sql`update plans set status='pending_review', moderation_note='Verificación del organizador revocada', updated_at=now()
            where creator_id=${t.id} and kind='verified' and status in ('published','full') and starts_at > now()`);
          await notify(t.id, { type: "verification_revoked", title: "Verificación revocada", body: note }, tx);
        } else if (action === "make_admin") {
          after = { role: "admin" };
          await tx.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, t.id));
        } else {
          after = { role: "user" };
          await tx.update(users).set({ role: "user", updatedAt: new Date() }).where(eq(users.id, t.id));
        }
        await audit({ actorId: admin.id, action: `user.${action}`, targetType: "user", targetId: t.id, before, after, note }, tx);
      });
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "admin/verifications",
    handler: async ({ query }) => {
      await requireAdmin();
      const st = query.get("status") || "pending";
      const rows = await db
        .select({ v: organizerVerifications, username: users.username, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
        .from(organizerVerifications)
        .innerJoin(users, eq(users.id, organizerVerifications.userId))
        .where(st === "all" ? undefined : eq(organizerVerifications.status, st as "pending"))
        .orderBy(desc(organizerVerifications.createdAt))
        .limit(PS)
        .offset((page(query) - 1) * PS);
      return json({ items: rows.map((r) => ({ ...r.v, username: r.username, email: r.email, emailVerified: !!r.emailVerifiedAt })) });
    },
  },
  {
    method: "PATCH",
    path: "admin/verifications/:id",
    handler: async ({ req, params }) => {
      const admin = await requireAdmin();
      const { decision, note } = await parseBody(req, verificationDecisionSchema);
      const id = Number(params.id);
      if (!Number.isInteger(id)) throw notFound();
      const [v] = await db.select().from(organizerVerifications).where(eq(organizerVerifications.id, id));
      if (!v) throw notFound();
      if (!canReviewVerification(toActor(admin), v.userId)) throw forbidden("No puedes revisar tu propia verificación.");
      if (v.status !== "pending") throw new ApiError(409, "conflict", "La solicitud ya fue revisada.");
      if (decision === "reject" && !note) throw new ApiError(422, "validation", "Indica la justificación del rechazo.", { note: "Requerida" });
      const newStatus = decision === "approve" ? "approved" : "rejected";
      await db.transaction(async (tx) => {
        await tx.update(organizerVerifications).set({ status: newStatus, reviewedById: admin.id, reviewedAt: new Date(), reviewNote: note ?? null }).where(eq(organizerVerifications.id, v.id));
        if (decision === "approve") await tx.update(users).set({ isVerifiedOrganizer: true, organizerName: v.organizationName, updatedAt: new Date() }).where(eq(users.id, v.userId));
        await audit({ actorId: admin.id, action: `verification.${decision}`, targetType: "organizer_verification", targetId: String(v.id), before: { status: v.status }, after: { status: newStatus, userId: v.userId }, note }, tx);
        await notify(v.userId, { type: "verification_" + newStatus, title: decision === "approve" ? "¡Eres organizador verificado!" : "Verificación no aprobada", body: note ?? undefined, link: "/app/organizador" }, tx);
      });
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "admin/plans",
    handler: async ({ query }) => {
      await requireAdmin();
      const st = query.get("status") || "pending_review";
      const rows = await db
        .select({ id: plans.id, title: plans.title, kind: plans.kind, status: plans.status, startsAt: plans.startsAt, locationName: plans.locationName, moderationNote: plans.moderationNote, creator: users.username, organizerName: users.organizerName })
        .from(plans)
        .innerJoin(users, eq(users.id, plans.creatorId))
        .where(st === "all" ? undefined : eq(plans.status, st as "published"))
        .orderBy(desc(plans.createdAt))
        .limit(PS)
        .offset((page(query) - 1) * PS);
      return json({ items: rows });
    },
  },
  {
    method: "PATCH",
    path: "admin/plans/:id",
    handler: async ({ req, params }) => {
      const admin = await requireAdmin();
      if (!uuidRe.test(params.id)) throw notFound();
      const { action, note } = await parseBody(req, adminPlanActionSchema);
      const [p] = await db.select().from(plans).where(eq(plans.id, params.id));
      if (!p) throw notFound();
      let status = p.status;
      if (action === "approve") {
        if (p.status !== "pending_review") throw new ApiError(409, "conflict", "El plan no está pendiente de revisión.");
        const [c] = await db.select({ v: users.isVerifiedOrganizer }).from(users).where(eq(users.id, p.creatorId));
        if (p.kind === "verified" && !c?.v) throw new ApiError(409, "conflict", "El creador ya no es organizador verificado.");
        status = p.acceptedCount >= p.capacity ? "full" : "published";
      } else if (action === "reject") status = "draft";
      else if (action === "cancel") status = "cancelled";
      else status = p.acceptedCount >= p.capacity ? "full" : "published";
      await db.transaction(async (tx) => {
        await tx.update(plans).set({ status, moderationNote: note ?? null, updatedAt: new Date() }).where(eq(plans.id, p.id));
        await audit({ actorId: admin.id, action: `plan.${action}`, targetType: "plan", targetId: p.id, before: { status: p.status }, after: { status }, note }, tx);
        await notify(p.creatorId, { type: "plan_moderated", title: `Moderación: «${p.title}»`, body: `Nuevo estado: ${status}${note ? ` — ${note}` : ""}`, link: "/app/mis-parches" }, tx);
      });
      return json({ ok: true, status });
    },
  },
  {
    method: "GET",
    path: "admin/reports",
    handler: async ({ query }) => {
      await requireAdmin();
      const st = query.get("status");
      const rows = await db
        .select({ r: reports, reporter: users.username, planTitle: plans.title })
        .from(reports)
        .innerJoin(users, eq(users.id, reports.reporterId))
        .leftJoin(plans, eq(plans.id, reports.targetPlanId))
        .where(st ? eq(reports.status, st as "open") : inArray(reports.status, ["open", "reviewing"]))
        .orderBy(desc(reports.createdAt))
        .limit(PS)
        .offset((page(query) - 1) * PS);
      const targetIds = rows.map((r) => r.r.targetUserId).filter((x): x is string => !!x);
      const targets = targetIds.length ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, targetIds)) : [];
      return json({ items: rows.map((r) => ({ ...r.r, reporter: r.reporter, planTitle: r.planTitle, targetUsername: targets.find((t) => t.id === r.r.targetUserId)?.username ?? null })) });
    },
  },
  {
    method: "PATCH",
    path: "admin/reports/:id",
    handler: async ({ req, params }) => {
      const admin = await requireAdmin();
      const b = await parseBody(req, adminReportActionSchema);
      const id = Number(params.id);
      const [r] = await db.select().from(reports).where(eq(reports.id, id));
      if (!r) throw notFound();
      await db.transaction(async (tx) => {
        await tx.update(reports).set({ status: b.status, resolution: b.resolution ?? null, resolvedById: admin.id, updatedAt: new Date() }).where(eq(reports.id, id));
        await audit({ actorId: admin.id, action: `report.${b.status}`, targetType: "report", targetId: String(id), before: { status: r.status }, after: { status: b.status }, note: b.resolution }, tx);
      });
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "admin/catalog",
    handler: async () => {
      await requireAdmin();
      const [c, b, p] = await Promise.all([
        db.select().from(categories).orderBy(asc(categories.name)),
        db.select().from(barrios).orderBy(asc(barrios.name)),
        db.select().from(places).orderBy(asc(places.name)),
      ]);
      return json({ categories: c, barrios: b, places: p });
    },
  },
  {
    method: "POST",
    path: "admin/catalog",
    handler: async ({ req }) => {
      const admin = await requireAdmin();
      const b = await parseBody(req, catalogSchema);
      const bounds = serverEnv().bounds;
      if ((b.type === "place" || (b.type === "barrio" && b.lat != null && b.lng != null)) && !isWithinBounds(b.lat!, b.lng!, bounds))
        throw new ApiError(422, "validation", "Coordenadas fuera de Manizales.", { lat: "Fuera del área" });
      let id: number;
      try {
        if (b.type === "category") {
          const vals = { slug: b.slug, name: b.name, icon: b.icon ?? "sparkles", active: b.active ?? true };
          id = b.id ? (await db.update(categories).set(vals).where(eq(categories.id, b.id)).returning())[0]?.id : (await db.insert(categories).values(vals).returning())[0].id;
        } else if (b.type === "barrio") {
          const vals = { name: b.name, sector: b.sector ?? null, lat: b.lat ?? null, lng: b.lng ?? null, active: b.active ?? true };
          id = b.id ? (await db.update(barrios).set(vals).where(eq(barrios.id, b.id)).returning())[0]?.id : (await db.insert(barrios).values(vals).returning())[0].id;
        } else {
          const vals = { name: b.name, description: b.description ?? null, barrioId: b.barrioId ?? null, lat: b.lat, lng: b.lng, active: b.active ?? true };
          id = b.id ? (await db.update(places).set(vals).where(eq(places.id, b.id)).returning())[0]?.id : (await db.insert(places).values(vals).returning())[0].id;
        }
      } catch (e) {
        if (e instanceof Error && /unique|duplicate/i.test(e.message + String((e as { cause?: unknown }).cause ?? ""))) throw new ApiError(409, "duplicate", "Ya existe un elemento con ese nombre.");
        throw e;
      }
      if (!id) throw notFound();
      await audit({ actorId: admin.id, action: `catalog.${b.type}.${b.id ? "update" : "create"}`, targetType: b.type, targetId: String(id), after: b });
      return json({ ok: true, id });
    },
  },
  {
    method: "GET",
    path: "admin/audit",
    handler: async ({ query }) => {
      await requireAdmin();
      const rows = await db
        .select({ a: auditLogs, actor: users.username })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(PS)
        .offset((page(query) - 1) * PS);
      return json({ items: rows.map((r) => ({ ...r.a, actor: r.actor })), page: page(query) });
    },
  },
  {
    method: "GET",
    path: "admin/appeals",
    handler: async () => {
      await requireAdmin();
      const rows = await db.select({ a: appeals, username: users.username, status: users.status }).from(appeals).innerJoin(users, eq(users.id, appeals.userId)).where(eq(appeals.status, "open")).orderBy(desc(appeals.createdAt)).limit(50);
      return json({ items: rows.map((r) => ({ ...r.a, username: r.username, userStatus: r.status })) });
    },
  },
  {
    method: "PATCH",
    path: "admin/appeals/:id",
    handler: async ({ req, params }) => {
      const admin = await requireAdmin();
      const b = await parseBody(req, verificationDecisionSchema);
      const [a] = await db.select().from(appeals).where(eq(appeals.id, Number(params.id)));
      if (!a || a.status !== "open") throw notFound();
      await db.transaction(async (tx) => {
        await tx.update(appeals).set({ status: b.decision === "approve" ? "accepted" : "rejected" }).where(eq(appeals.id, a.id));
        if (b.decision === "approve") await tx.update(users).set({ status: "active", updatedAt: new Date() }).where(eq(users.id, a.userId));
        await audit({ actorId: admin.id, action: `appeal.${b.decision}`, targetType: "user", targetId: a.userId, note: b.note }, tx);
      });
      return json({ ok: true });
    },
  },
];
