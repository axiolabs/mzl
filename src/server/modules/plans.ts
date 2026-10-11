import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { barrios, blocks, categories, favorites, planParticipations, plans, places, userInterests, userPreferences, users } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { clampBbox, isWithinBounds } from "@/lib/geo";
import { canCreateVerifiedPlan, canManagePlan, canRequestToJoin, effectiveStatus, isPlanPubliclyVisible } from "@/lib/permissions";
import { recommend } from "@/lib/recommend";
import { checkPlanDates, participationDecisionSchema, participationRequestSchema, planCreateSchema, planUpdateSchema } from "@/lib/validation";
import { ApiError, audit, forbidden, getSessionUser, json, notFound, notify, parseBody, rateLimit, requireUser, toActor } from "../core";
import { getPlanRow, getViewerParticipation, listParticipants, listPlansByCreator, listPublicPlans, sweepFinishedPlans, toPlanDTO } from "../plans";
import type { Route } from "./types";

const num = (v: string | null) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

function assertGeo(lat: number, lng: number) {
  if (!isWithinBounds(lat, lng, serverEnv().bounds))
    throw new ApiError(422, "validation", "La ubicación debe estar dentro de Manizales.", { lat: "Ubicación fuera del área permitida" });
}

async function assertCategory(id: number) {
  const [c] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.active, true)));
  if (!c) throw new ApiError(422, "validation", "Categoría no válida.", { categoryId: "Categoría no válida" });
}

async function isBlockedEitherWay(a: string, b: string) {
  const rows = await db
    .select()
    .from(blocks)
    .where(sql`(${blocks.blockerId} = ${a} and ${blocks.blockedId} = ${b}) or (${blocks.blockerId} = ${b} and ${blocks.blockedId} = ${a})`)
    .limit(1);
  return rows.length > 0;
}

export async function getMeta() {
  const [cats, bars, pls] = await Promise.all([
    db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.name)),
    db.select({ id: barrios.id, name: barrios.name }).from(barrios).where(eq(barrios.active, true)).orderBy(asc(barrios.name)),
    db.select({ id: places.id, name: places.name, lat: places.lat, lng: places.lng, description: places.description }).from(places).where(eq(places.active, true)).orderBy(asc(places.name)),
  ]);
  return { categories: cats, barrios: bars, places: pls, city: "Manizales, Caldas, Colombia", bounds: serverEnv().bounds };
}

export async function computeRecommendations(userId: string | null, limit = 12) {
  await sweepFinishedPlans();
  const { items } = await listPublicPlans({ onlyAvailable: true, pageSize: 200, viewerId: userId, from: new Date() });
  let ctx = { interestCategoryIds: [] as number[], favoriteCategoryIds: [] as number[], participatedCategoryIds: [] as number[], zone: null as null | { name: string; lat: number; lng: number } };
  if (userId) {
    const [ints, favs, parts, prefRow] = await Promise.all([
      db.select({ id: userInterests.categoryId }).from(userInterests).where(eq(userInterests.userId, userId)),
      db.select({ id: plans.categoryId }).from(favorites).innerJoin(plans, eq(plans.id, favorites.planId)).where(eq(favorites.userId, userId)),
      db.select({ id: plans.categoryId }).from(planParticipations).innerJoin(plans, eq(plans.id, planParticipations.planId)).where(and(eq(planParticipations.userId, userId), eq(planParticipations.status, "accepted"))),
      db.select({ use: userPreferences.useBarrioForRecommendations, name: barrios.name, lat: barrios.lat, lng: barrios.lng })
        .from(users).leftJoin(userPreferences, eq(userPreferences.userId, users.id)).leftJoin(barrios, eq(barrios.id, users.barrioId)).where(eq(users.id, userId)),
    ]);
    const pr = prefRow[0];
    ctx = {
      interestCategoryIds: ints.map((i) => i.id),
      favoriteCategoryIds: [...new Set(favs.map((f) => f.id))],
      participatedCategoryIds: [...new Set(parts.map((p) => p.id))],
      zone: pr?.use && pr.lat != null && pr.lng != null && pr.name ? { name: pr.name, lat: pr.lat, lng: pr.lng } : null,
    };
  }
  const own = items.filter((p) => p.creator.id !== userId);
  const recs = recommend(
    own.map((p) => ({ ...p, categoryId: p.category.id, categoryName: p.category.name, startsAt: new Date(p.startsAt), dto: p })),
    ctx,
    limit,
  );
  return recs.map((r) => ({ plan: r.plan.dto, reasons: r.reasons, score: r.score }));
}

export const planRoutes: Route[] = [
  { method: "GET", path: "meta", handler: async () => json(await getMeta(), 200, { "Cache-Control": "public, max-age=60" }) },
  {
    method: "GET",
    path: "plans",
    handler: async ({ query }) => {
      const viewer = await getSessionUser();
      let bbox;
      if (query.get("bbox")) {
        const p = query.get("bbox")!.split(",").map(Number);
        if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) throw new ApiError(400, "bad_bbox", "bbox inválido");
        bbox = clampBbox({ minLat: p[0], minLng: p[1], maxLat: p[2], maxLng: p[3] }, serverEnv().bounds);
        if (!bbox) return json({ items: [], total: 0, page: 1, pageSize: 0, pages: 1 });
      }
      const kind = query.get("kind");
      const from = query.get("from");
      const to = query.get("to");
      const result = await listPublicPlans({
        q: query.get("q")?.slice(0, 80) || undefined,
        categoryId: num(query.get("category")),
        kind: kind === "community" || kind === "verified" ? kind : undefined,
        from: from && !Number.isNaN(Date.parse(from)) ? new Date(from) : undefined,
        to: to && !Number.isNaN(Date.parse(to)) ? new Date(to) : undefined,
        onlyAvailable: query.get("available") === "1",
        bbox,
        page: num(query.get("page")),
        pageSize: Math.min(num(query.get("pageSize")) ?? 12, 200),
        viewerId: viewer?.id,
      });
      return json(result);
    },
  },
  {
    method: "POST",
    path: "plans",
    handler: async ({ req }) => {
      const u = await requireUser();
      await rateLimit(`plan-create:${u.id}`, 10, 86400);
      const b = await parseBody(req, planCreateSchema);
      if (b.kind === "verified" && !canCreateVerifiedPlan(toActor(u))) throw forbidden("Sólo organizadores verificados pueden crear eventos verificados.");
      const dateErr = checkPlanDates({ startsAt: b.startsAt, endsAt: b.endsAt || undefined });
      if (dateErr) throw new ApiError(422, "validation", dateErr, { startsAt: dateErr });
      assertGeo(b.lat, b.lng);
      await assertCategory(b.categoryId);
      // Política: eventos verificados requieren revisión de un administrador antes de publicarse.
      const status = !b.publish ? "draft" : b.kind === "verified" ? "pending_review" : "published";
      const [p] = await db
        .insert(plans)
        .values({
          title: b.title,
          description: b.description,
          categoryId: b.categoryId,
          kind: b.kind,
          coverUrl: b.coverUrl || null,
          startsAt: new Date(b.startsAt),
          endsAt: b.endsAt ? new Date(b.endsAt) : null,
          placeId: b.placeId ?? null,
          locationName: b.locationName,
          lat: b.lat,
          lng: b.lng,
          capacity: b.capacity,
          requirements: b.requirements || null,
          visibility: b.visibility,
          status,
          creatorId: u.id,
        })
        .returning({ id: plans.id, status: plans.status });
      return json({ ok: true, plan: p }, 201);
    },
  },
  {
    method: "GET",
    path: "plans/:id",
    handler: async ({ params }) => {
      const row = await getPlanRow(params.id);
      const viewer = await getSessionUser();
      if (!row) throw notFound();
      const isOwner = viewer?.id === row.p.creatorId;
      const isAdminViewer = viewer?.role === "admin";
      if (!isOwner && !isAdminViewer && (!isPlanPubliclyVisible(row.p, { direct: true }) || row.u.status !== "active")) throw notFound();
      const participation = viewer ? await getViewerParticipation(row.p.id, viewer.id) : null;
      const accepted = participation?.status === "accepted";
      const fav = viewer ? (await db.select().from(favorites).where(and(eq(favorites.userId, viewer.id), eq(favorites.planId, row.p.id)))).length > 0 : false;
      return json({
        plan: toPlanDTO(row, { exact: isOwner || accepted || isAdminViewer }),
        viewer: viewer ? { isOwner, participation: participation?.status ?? null, favorite: fav } : null,
        participants: isOwner ? await listParticipants(row.p.id, "owner") : accepted ? await listParticipants(row.p.id, "accepted") : null,
      });
    },
  },
  {
    method: "PATCH",
    path: "plans/:id",
    handler: async ({ req, params }) => {
      const u = await requireUser();
      const row = await getPlanRow(params.id);
      if (!row) throw notFound();
      if (!canManagePlan(toActor(u), row.p)) throw forbidden("Sólo quien creó el plan puede editarlo.");
      const st = effectiveStatus(row.p);
      if (st === "cancelled" || st === "finished") throw new ApiError(409, "not_editable", "Este plan ya no se puede editar.");
      const b = await parseBody(req, planUpdateSchema);
      const startsAt = b.startsAt ?? row.p.startsAt.toISOString();
      const endsAt = b.endsAt === "" ? undefined : (b.endsAt ?? row.p.endsAt?.toISOString());
      if (b.startsAt || b.endsAt) {
        const dateErr = checkPlanDates({ startsAt, endsAt });
        if (dateErr) throw new ApiError(422, "validation", dateErr, { startsAt: dateErr });
      }
      if (b.lat != null || b.lng != null) assertGeo(b.lat ?? row.p.lat, b.lng ?? row.p.lng);
      if (b.categoryId) await assertCategory(b.categoryId);
      if (b.capacity != null && b.capacity < row.p.acceptedCount)
        throw new ApiError(422, "validation", "El cupo no puede ser menor que los participantes aceptados.", { capacity: `Mínimo ${row.p.acceptedCount}` });
      const capacity = b.capacity ?? row.p.capacity;
      let status = row.p.status;
      if (status === "full" && capacity > row.p.acceptedCount) status = "published";
      if (status === "published" && capacity <= row.p.acceptedCount) status = "full";
      if (status === "draft" && b.publish) status = row.p.kind === "verified" ? "pending_review" : "published";
      const { publish: _p, ...rest } = b;
      void _p;
      await db
        .update(plans)
        .set({
          ...rest,
          coverUrl: b.coverUrl === undefined ? undefined : b.coverUrl || null,
          requirements: b.requirements === undefined ? undefined : b.requirements || null,
          startsAt: b.startsAt ? new Date(b.startsAt) : undefined,
          endsAt: b.endsAt === undefined ? undefined : b.endsAt ? new Date(b.endsAt) : null,
          status,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, row.p.id));
      if (b.startsAt || b.locationName || b.lat != null) {
        const acc = await db.select({ userId: planParticipations.userId }).from(planParticipations).where(and(eq(planParticipations.planId, row.p.id), eq(planParticipations.status, "accepted")));
        for (const a of acc) await notify(a.userId, { type: "plan_updated", title: "Un plan cambió", body: `«${row.p.title}» actualizó fecha o lugar.`, link: `/parches/${row.p.id}` });
      }
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "plans/:id/cancel",
    handler: async ({ params }) => {
      const u = await requireUser();
      const row = await getPlanRow(params.id);
      if (!row) throw notFound();
      if (!canManagePlan(toActor(u), row.p)) throw forbidden("Sólo quien creó el plan puede cancelarlo.");
      if (row.p.status === "cancelled" || effectiveStatus(row.p) === "finished") throw new ApiError(409, "conflict", "El plan ya no está activo.");
      await db.transaction(async (tx) => {
        await tx.update(plans).set({ status: "cancelled", updatedAt: new Date() }).where(eq(plans.id, row.p.id));
        const affected = await tx
          .select({ userId: planParticipations.userId })
          .from(planParticipations)
          .where(and(eq(planParticipations.planId, row.p.id), inArray(planParticipations.status, ["pending", "accepted"])));
        for (const a of affected) await notify(a.userId, { type: "plan_cancelled", title: "Plan cancelado", body: `«${row.p.title}» fue cancelado por quien lo organiza.`, link: `/parches/${row.p.id}` }, tx);
      });
      return json({ ok: true });
    },
  },
  {
    method: "DELETE",
    path: "plans/:id",
    handler: async ({ params }) => {
      const u = await requireUser();
      const row = await getPlanRow(params.id);
      if (!row) throw notFound();
      if (!canManagePlan(toActor(u), row.p)) throw forbidden("Sólo quien creó el plan puede eliminarlo.");
      const active = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(planParticipations)
        .where(and(eq(planParticipations.planId, row.p.id), inArray(planParticipations.status, ["pending", "accepted"])));
      if (active[0].n > 0) throw new ApiError(409, "has_participants", "Este plan tiene solicitudes o participantes. Cancélalo en lugar de eliminarlo para que reciban aviso.");
      await db.delete(plans).where(eq(plans.id, row.p.id));
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "plans/:id/join",
    handler: async ({ req, params }) => {
      const u = await requireUser();
      await rateLimit(`join:${u.id}`, 30, 3600);
      const b = await parseBody(req, participationRequestSchema);
      const row = await getPlanRow(params.id);
      if (!row || !isPlanPubliclyVisible(row.p, { direct: true })) throw notFound();
      const check = canRequestToJoin(toActor(u), row.p);
      if (!check.ok) throw new ApiError(409, "cannot_join", check.reason);
      if (await isBlockedEitherWay(u.id, row.p.creatorId)) throw forbidden("No puedes unirte a este plan.");
      const existing = await getViewerParticipation(row.p.id, u.id);
      if (existing && (existing.status === "pending" || existing.status === "accepted")) throw new ApiError(409, "duplicate", "Ya tienes una solicitud activa para este plan.");
      if (existing && (existing.status === "rejected" || existing.status === "removed")) throw new ApiError(409, "not_allowed", "Quien organiza no aceptó tu participación en este plan.");
      await db
        .insert(planParticipations)
        .values({ planId: row.p.id, userId: u.id, message: b.message || null })
        .onConflictDoUpdate({ target: [planParticipations.planId, planParticipations.userId], set: { status: "pending", message: b.message || null, updatedAt: new Date() } });
      await notify(row.p.creatorId, { type: "join_request", title: "Nueva solicitud", body: `@${u.username} quiere unirse a «${row.p.title}».`, link: `/app/mis-parches` });
      return json({ ok: true, status: "pending" }, 201);
    },
  },
  {
    method: "DELETE",
    path: "plans/:id/join",
    handler: async ({ params }) => {
      const u = await requireUser();
      const row = await getPlanRow(params.id);
      if (!row) throw notFound();
      await db.transaction(async (tx) => {
        await tx.execute(sql`select id from plans where id = ${row.p.id} for update`);
        const [part] = await tx.select().from(planParticipations).where(and(eq(planParticipations.planId, row.p.id), eq(planParticipations.userId, u.id))).for("update");
        if (!part || (part.status !== "pending" && part.status !== "accepted")) throw new ApiError(409, "no_request", "No tienes una solicitud activa.");
        await tx.update(planParticipations).set({ status: "withdrawn", updatedAt: new Date() }).where(eq(planParticipations.id, part.id));
        if (part.status === "accepted") {
          await tx.execute(sql`update plans set accepted_count = accepted_count - 1, status = case when status = 'full' then 'published'::plan_status else status end, updated_at = now() where id = ${row.p.id}`);
          await notify(row.p.creatorId, { type: "participant_left", title: "Un participante se retiró", body: `@${u.username} ya no asistirá a «${row.p.title}».`, link: "/app/mis-parches" }, tx);
        }
      });
      return json({ ok: true });
    },
  },
  {
    method: "PATCH",
    path: "participations/:id",
    handler: async ({ req, params }) => {
      const u = await requireUser();
      const { action } = await parseBody(req, participationDecisionSchema);
      if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
      const result = await db.transaction(async (tx) => {
        const [part] = await tx.select().from(planParticipations).where(eq(planParticipations.id, params.id));
        if (!part) throw notFound();
        // Bloqueo pesimista de la fila del plan: serializa aceptaciones concurrentes y evita superar el cupo.
        const locked = await tx.execute<{ creator_id: string; capacity: number; accepted_count: number; status: string; title: string; starts_at: Date; ends_at: Date | null; visibility: string }>(
          sql`select creator_id, capacity, accepted_count, status, title, starts_at, ends_at, visibility from plans where id = ${part.planId} for update`,
        );
        const p = locked.rows[0];
        if (!p || p.creator_id !== u.id) throw forbidden("Sólo quien organiza puede gestionar solicitudes.");
        const eff = effectiveStatus({ status: p.status, startsAt: p.starts_at, endsAt: p.ends_at, visibility: p.visibility, creatorId: p.creator_id });
        if (action === "accept") {
          if (part.status !== "pending") throw new ApiError(409, "conflict", "La solicitud ya no está pendiente.");
          if (eff !== "published") throw new ApiError(409, "conflict", "El plan no admite más participantes.");
          if (p.accepted_count >= p.capacity) throw new ApiError(409, "full", "El cupo está completo.");
          await tx.update(planParticipations).set({ status: "accepted", updatedAt: new Date() }).where(eq(planParticipations.id, part.id));
          await tx.execute(sql`update plans set accepted_count = accepted_count + 1,
            status = case when accepted_count + 1 >= capacity then 'full'::plan_status else status end, updated_at = now() where id = ${part.planId}`);
          await notify(part.userId, { type: "request_accepted", title: "¡Solicitud aceptada!", body: `Ya haces parte de «${p.title}».`, link: `/parches/${part.planId}` }, tx);
        } else if (action === "reject") {
          if (part.status !== "pending") throw new ApiError(409, "conflict", "La solicitud ya no está pendiente.");
          await tx.update(planParticipations).set({ status: "rejected", updatedAt: new Date() }).where(eq(planParticipations.id, part.id));
          await notify(part.userId, { type: "request_rejected", title: "Solicitud no aceptada", body: `Tu solicitud a «${p.title}» no fue aceptada esta vez.` }, tx);
        } else {
          if (part.status !== "accepted") throw new ApiError(409, "conflict", "Sólo se puede retirar a participantes aceptados.");
          await tx.update(planParticipations).set({ status: "removed", updatedAt: new Date() }).where(eq(planParticipations.id, part.id));
          await tx.execute(sql`update plans set accepted_count = accepted_count - 1, status = case when status = 'full' then 'published'::plan_status else status end, updated_at = now() where id = ${part.planId}`);
          await notify(part.userId, { type: "participant_removed", title: "Ya no participas en un plan", body: `Quien organiza «${p.title}» retiró tu participación.` }, tx);
        }
        return { ok: true };
      });
      return json(result);
    },
  },
  {
    method: "GET",
    path: "me/plans",
    handler: async () => {
      const u = await requireUser();
      const items = await listPlansByCreator(u.id);
      const counts = await db
        .select({ planId: planParticipations.planId, status: planParticipations.status, n: sql<number>`count(*)::int` })
        .from(planParticipations)
        .innerJoin(plans, eq(plans.id, planParticipations.planId))
        .where(eq(plans.creatorId, u.id))
        .groupBy(planParticipations.planId, planParticipations.status);
      return json({ items: items.map((p) => ({ ...p, pending: counts.find((c) => c.planId === p.id && c.status === "pending")?.n ?? 0 })) });
    },
  },
  {
    method: "GET",
    path: "plans/:id/participants",
    handler: async ({ params }) => {
      const u = await requireUser();
      const row = await getPlanRow(params.id);
      if (!row) throw notFound();
      if (row.p.creatorId !== u.id) throw forbidden();
      return json({ items: await listParticipants(row.p.id, "owner") });
    },
  },
  {
    method: "GET",
    path: "me/participations",
    handler: async () => {
      const u = await requireUser();
      const rows = await db
        .select({ part: planParticipations, p: plans, c: categories, u: users })
        .from(planParticipations)
        .innerJoin(plans, eq(plans.id, planParticipations.planId))
        .innerJoin(categories, eq(categories.id, plans.categoryId))
        .innerJoin(users, eq(users.id, plans.creatorId))
        .where(eq(planParticipations.userId, u.id))
        .orderBy(desc(planParticipations.updatedAt))
        .limit(100);
      return json({ items: rows.map((r) => ({ id: r.part.id, status: r.part.status, createdAt: r.part.createdAt, plan: toPlanDTO(r, { exact: r.part.status === "accepted" }) })) });
    },
  },
  {
    method: "GET",
    path: "recommendations",
    handler: async () => {
      const u = await getSessionUser();
      return json({ items: await computeRecommendations(u?.id ?? null) });
    },
  },
  {
    method: "GET",
    path: "users/:username",
    handler: async ({ params }) => {
      const [u] = await db.select().from(users).leftJoin(userPreferences, eq(userPreferences.userId, users.id)).where(and(eq(users.username, params.username.toLowerCase()), eq(users.status, "active")));
      if (!u) throw notFound();
      const prefs = u.user_preferences;
      const ints = prefs?.showInterests === false ? [] : await db.select({ name: categories.name }).from(userInterests).innerJoin(categories, eq(categories.id, userInterests.categoryId)).where(eq(userInterests.userId, u.users.id));
      const upcoming = prefs?.showUpcoming === false ? [] : await listPlansByCreator(u.users.id, { publicOnly: true });
      return json({ user: { ...(await import("../serializers")).publicUser(u.users), bio: u.users.bio, interests: ints.map((i) => i.name) }, plans: upcoming });
    },
  },
];
void gte;
