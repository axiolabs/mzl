import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PlanCard } from "@/components/plan-card";
import { EmptyState, PageTitle, linkBtn } from "@/components/ui";
import { pageUser } from "@/server/core";
import { computeRecommendations } from "@/server/modules/plans";
import { listPublicPlans } from "@/server/plans";

export const metadata = { title: "Inicio" };

export default async function AppHome() {
  const u = await pageUser();
  const [recs, upcoming] = await Promise.all([computeRecommendations(u.id, 6), listPublicPlans({ pageSize: 6, viewerId: u.id })]);
  return (
    <div className="space-y-10">
      <PageTitle title={`¡Hola, ${u.firstName}! 👋`} subtitle="¿Qué parche armamos hoy?" action={<Link href="/app/crear" className={linkBtn()}>Crear parche</Link>} />
      <section id="recomendaciones" aria-labelledby="rec-title">
        <h2 id="rec-title" className="mb-1 flex items-center gap-2 text-xl font-bold"><Sparkles className="h-5 w-5 text-accent" aria-hidden />Recomendados para ti</h2>
        <p className="mb-4 text-sm text-black/60">Calculado con tus intereses, favoritos, participaciones y fechas próximas. <Link href="/app/perfil" className="font-semibold text-accent-dark">Ajusta tus intereses</Link>.</p>
        {recs.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recs.map((r) => <PlanCard key={r.plan.id} plan={r.plan} href={`/parches/${r.plan.id}`} reasons={r.reasons} />)}</div> : <EmptyState title="Aún no hay planes para recomendarte">Cuando haya parches con cupos, aparecerán aquí.</EmptyState>}
      </section>
      <section aria-labelledby="up-title">
        <div className="mb-4 flex items-end justify-between"><h2 id="up-title" className="text-xl font-bold">Lo que viene en Manizales</h2><Link href="/explorar" className="font-semibold text-accent-dark">Explorar →</Link></div>
        {upcoming.items.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{upcoming.items.map((p) => <PlanCard key={p.id} plan={p} href={`/parches/${p.id}`} />)}</div> : <EmptyState title="Sin planes próximos" />}
      </section>
    </div>
  );
}
