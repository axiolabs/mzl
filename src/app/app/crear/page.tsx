import { PlanForm } from "@/components/plan-form";
import { Card, PageTitle } from "@/components/ui";
import { pageUser } from "@/server/core";
import { getMeta } from "@/server/modules/plans";

export const metadata = { title: "Crear parche" };

export default async function Crear() {
  const u = await pageUser();
  const meta = await getMeta();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Crear parche" subtitle="Arma un plan presencial en Manizales." />
      <Card><PlanForm meta={meta} canVerified={u.isVerifiedOrganizer} /></Card>
    </div>
  );
}
