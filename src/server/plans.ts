import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { blocks, categories, planParticipations, plans, users } from "@/db/schema";
import { effectiveStatus } from "@/lib/permissions";
import { publicUser, type PublicUser } from "./serializers";

export type PlanDTO = {
  id: string;
  title: string;
  description: string;
  category: { id: number; name: string; slug: string; icon: string };
  kind: "community" | "verified";
  coverUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  locationName: string;
  lat: number;
  lng: number;
  approximateLocation: boolean;
  capacity: number;
  acceptedCount: number;
  spotsLeft: number;
  requirements: string | null;
  visibility: "public" | "unlisted";
  status: string;
  creator: PublicUser;
  createdAt: string;
  updatedAt: string;
};

const planSelect = { p: plans, c: categories, u: users };
type Row = { p: typeof plans.$inferSelect; c: typeof categories.$inferSelect; u: typeof users.$inferSelect };

/**
 * Para planes comunitarios, quien no es creador ni participante aceptado ve coordenadas aproximadas (~100 m).
 */
export function toPlanDTO(r: Row, opts: { exact?: boolean } = {}): PlanDTO {
  const exact = opts.exact || r.p.kind === "verified";
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    id: r.p.id,
    title: r.p.title,
    description: r.p.description,
    category: { id: r.c.id, name: r.c.name, slug: r.c.slug, icon: r.c.icon },
    kind: r.p.kind,
    coverUrl: r.p.coverUrl,
    startsAt: r.p.startsAt.toISOString(),
    endsAt: r.p.endsAt?.toISOString() ?? null,
    locationName: r.p.locationName,
    lat: exact ? r.p.lat : round(r.p.lat),
    lng: exact ? r.p.lng : round(r.p.lng),
    approximateLocation: !exact,
    capacity: r.p.capacity,
    acceptedCount: r.p.acceptedCount,
    spotsLeft: Math.max(0, r.p.capacity - r.p.acceptedCount),
    requirements: r.p.requirements,
    visibility: r.p.visibility,
    status: effectiveStatus(r.p),
    creator: publicUser(r.u),
    createdAt: r.p.createdAt.toISOString(),
    updatedAt: r.p.updatedAt.toISOString(),
  };
}

let lastFinishSweep = 0;
/** Marca como finalizados los planes vencidos (como máximo una vez por minuto). */
export async function sweepFinishedPlans() {
  if (Date.now() - lastFinishSweep < 60_000) return;
  lastFinishSweep = Date.now();
  await db.execute(sql`update plans set status = 'finished', updated_at = now()
    where status in ('published','full') and coalesce(ends_at, starts_at + interval '3 hours') < now()`);
}

export type PlanFilters = {
  q?: string;
  categoryId?: number;
  kind?: "community" | "verified";
  from?: Date;
  to?: Date;
  onlyAvailable?: boolean;
  bbox?: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  page?: number;
  pageSize?: number;
  viewerId?: string | null;
};

const activeCond = () =>
  and(
    inArray(plans.status, ["published", "full"]),
    eq(plans.visibility, "public"),
    gte(sql`coalesce(${plans.endsAt}, ${plans.startsAt} + interval '3 hours')`, sql`now()`),
    eq(users.status, "active"),
  );

export async function listPublicPlans(f: PlanFilters) {
  await sweepFinishedPlans();
  const conds: (SQL | undefined)[] = [activeCond()];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    conds.push(or(ilike(plans.title, like), ilike(plans.locationName, like), ilike(plans.description, like)));
  }
  if (f.categoryId) conds.push(eq(plans.categoryId, f.categoryId));
  if (f.kind) conds.push(eq(plans.kind, f.kind));
  if (f.from) conds.push(gte(plans.startsAt, f.from));
  if (f.to) conds.push(lte(plans.startsAt, f.to));
  if (f.onlyAvailable) conds.push(sql`${plans.acceptedCount} < ${plans.capacity}`);
  if (f.bbox) {
    conds.push(gte(plans.lat, f.bbox.minLat), lte(plans.lat, f.bbox.maxLat), gte(plans.lng, f.bbox.minLng), lte(plans.lng, f.bbox.maxLng));
  }
  if (f.viewerId) {
    const blocked = db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, f.viewerId));
    const blockedBy = db.select({ id: blocks.blockerId }).from(blocks).where(eq(blocks.blockedId, f.viewerId));
    conds.push(notInArray(plans.creatorId, blocked), notInArray(plans.creatorId, blockedBy));
  }
  const pageSize = Math.min(Math.max(f.pageSize ?? 12, 1), 200);
  const page = Math.max(f.page ?? 1, 1);
  const where = and(...conds);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(planSelect)
      .from(plans)
      .innerJoin(categories, eq(categories.id, plans.categoryId))
      .innerJoin(users, eq(users.id, plans.creatorId))
      .where(where)
      .orderBy(asc(plans.startsAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(plans)
      .innerJoin(users, eq(users.id, plans.creatorId))
      .where(where),
  ]);
  return { items: rows.map((r) => toPlanDTO(r)), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getPlanRow(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select(planSelect)
    .from(plans)
    .innerJoin(categories, eq(categories.id, plans.categoryId))
    .innerJoin(users, eq(users.id, plans.creatorId))
    .where(eq(plans.id, id));
  return row ?? null;
}

export async function getViewerParticipation(planId: string, userId: string) {
  const [p] = await db
    .select()
    .from(planParticipations)
    .where(and(eq(planParticipations.planId, planId), eq(planParticipations.userId, userId)));
  return p ?? null;
}

/** Visibilidad de participantes: el creador ve todas las solicitudes; un aceptado ve a los demás aceptados; el resto sólo el número. */
export async function listParticipants(planId: string, mode: "owner" | "accepted") {
  const rows = await db
    .select({ part: planParticipations, u: users })
    .from(planParticipations)
    .innerJoin(users, eq(users.id, planParticipations.userId))
    .where(
      mode === "owner"
        ? eq(planParticipations.planId, planId)
        : and(eq(planParticipations.planId, planId), eq(planParticipations.status, "accepted")),
    )
    .orderBy(desc(planParticipations.createdAt));
  return rows.map((r) => ({
    id: r.part.id,
    status: r.part.status,
    message: mode === "owner" ? r.part.message : null,
    createdAt: r.part.createdAt.toISOString(),
    user: publicUser(r.u),
  }));
}

export async function listPlansByCreator(creatorId: string, opts: { publicOnly?: boolean } = {}) {
  const conds: (SQL | undefined)[] = [eq(plans.creatorId, creatorId)];
  if (opts.publicOnly) conds.push(activeCond());
  const rows = await db
    .select(planSelect)
    .from(plans)
    .innerJoin(categories, eq(categories.id, plans.categoryId))
    .innerJoin(users, eq(users.id, plans.creatorId))
    .where(and(...conds))
    .orderBy(desc(plans.startsAt))
    .limit(100);
  return rows.map((r) => toPlanDTO(r, { exact: !opts.publicOnly }));
}
