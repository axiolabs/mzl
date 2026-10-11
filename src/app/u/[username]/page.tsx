import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { barrios, categories, userInterests, userPreferences, users } from "@/db/schema";
import { PlanCard } from "@/components/plan-card";
import { ReportDialog } from "@/components/plan-actions";
import { Avatar, Badge, Card, EmptyState, VerifiedBadge } from "@/components/ui";
import { getSessionUser } from "@/server/core";
import { listPlansByCreator } from "@/server/plans";
import { publicUser } from "@/server/serializers";

export const dynamic = "force-dynamic";

export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [row] = await db.select().from(users).leftJoin(userPreferences, eq(userPreferences.userId, users.id)).leftJoin(barrios, eq(barrios.id, users.barrioId)).where(and(eq(users.username, username.toLowerCase()), eq(users.status, "active")));
  if (!row) notFound();
  const viewer = await getSessionUser();
  const u = publicUser(row.users);
  const prefs = row.user_preferences;
  const ints = prefs?.showInterests === false ? [] : await db.select({ name: categories.name }).from(userInterests).innerJoin(categories, eq(categories.id, userInterests.categoryId)).where(eq(userInterests.userId, u.id));
  const plans = prefs?.showUpcoming === false ? [] : await listPlansByCreator(u.id, { publicOnly: true });
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Card className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <Avatar src={u.avatarUrl} name={u.displayName} size={112} />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-extrabold">{u.organizerName ?? u.displayName}</h1>
          <p className="text-black/55">@{u.username}{prefs?.showBarrio && row.barrios ? ` · ${row.barrios.name}, Manizales` : " · Manizales"}</p>
          {u.isVerifiedOrganizer && <div className="mt-2"><VerifiedBadge label="Organizador verificado" /></div>}
          {row.users.bio && <p className="mt-3 text-black/75">{row.users.bio}</p>}
          {ints.length > 0 && <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">{ints.map((i) => <Badge key={i.name} tone="accent">{i.name}</Badge>)}</div>}
        </div>
        {viewer && viewer.id !== u.id && <div className="w-full sm:w-auto"><ReportDialog targetType="user" targetId={u.id} label="Reportar perfil" /></div>}
      </Card>
      <h2 className="mb-4 mt-8 text-xl font-bold">Próximos parches públicos</h2>
      {plans.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{plans.map((p) => <PlanCard key={p.id} plan={p} href={`/parches/${p.id}`} />)}</div> : <EmptyState title="Sin parches públicos próximos" />}
    </div>
  );
}
