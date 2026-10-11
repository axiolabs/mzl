import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizerVerifications, plans } from "@/db/schema";
import { OrganizerPanel } from "@/components/app-client";
import { PageTitle } from "@/components/ui";
import { pageUser } from "@/server/core";

export const metadata = { title: "Panel de organizador" };

export default async function Organizador() {
  const u = await pageUser();
  const [reqs, stats] = await Promise.all([
    db.select().from(organizerVerifications).where(eq(organizerVerifications.userId, u.id)).orderBy(desc(organizerVerifications.createdAt)),
    db.select({ id: plans.id, title: plans.title, status: plans.status, kind: plans.kind, startsAt: plans.startsAt, capacity: plans.capacity, acceptedCount: plans.acceptedCount,
      pending: sql<number>`(select count(*)::int from plan_participations pp where pp.plan_id = ${plans.id} and pp.status = 'pending')`,
      rejected: sql<number>`(select count(*)::int from plan_participations pp where pp.plan_id = ${plans.id} and pp.status = 'rejected')`,
      favorites: sql<number>`(select count(*)::int from favorites f where f.plan_id = ${plans.id})` }).from(plans).where(eq(plans.creatorId, u.id)).orderBy(desc(plans.startsAt)),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Panel de organizador" subtitle="Verificación, actividades, cupos y estadísticas." />
      <OrganizerPanel isVerified={u.isVerifiedOrganizer} organizerName={u.organizerName} emailVerified={!!u.emailVerifiedAt}
        requests={reqs.map((r) => ({ id: r.id, organizationName: r.organizationName, status: r.status, reviewNote: r.reviewNote, createdAt: r.createdAt.toISOString() }))}
        stats={stats.map((s) => ({ ...s, startsAt: s.startsAt.toISOString() }))} />
    </div>
  );
}
