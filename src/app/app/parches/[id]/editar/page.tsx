import { notFound } from "next/navigation";
import { PlanForm } from "@/components/plan-form";
import { Card, PageTitle } from "@/components/ui";
import { pageUser } from "@/server/core";
import { getMeta } from "@/server/modules/plans";
import { getPlanRow } from "@/server/plans";

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await pageUser();
  const row = await getPlanRow(id);
  if (!row || row.p.creatorId !== u.id) notFound(); // sólo el creador
  const meta = await getMeta();
  const p = row.p;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Editar parche" subtitle={p.title} />
      <Card>
        <PlanForm meta={meta} canVerified={false} planId={p.id} initial={{ title: p.title, description: p.description, categoryId: String(p.categoryId), kind: p.kind, coverUrl: p.coverUrl ?? "", startsAtIso: p.startsAt.toISOString(), endsAtIso: p.endsAt?.toISOString() ?? null, placeId: p.placeId ? String(p.placeId) : "", locationName: p.locationName, lat: p.lat, lng: p.lng, capacity: String(p.capacity), requirements: p.requirements ?? "", visibility: p.visibility }} />
      </Card>
    </div>
  );
}
