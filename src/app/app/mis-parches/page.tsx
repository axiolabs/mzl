import Link from "next/link";
import { sql, eq, and } from "drizzle-orm";
import { CalendarPlus } from "lucide-react";
import { db } from "@/db";
import { planParticipations } from "@/db/schema";
import { Badge, Card, EmptyState, PageTitle, STATUS_LABEL, fmtDate, linkBtn } from "@/components/ui";
import { pageUser } from "@/server/core";
import { listPlansByCreator } from "@/server/plans";

export const metadata = { title: "Mis parches" };

export default async function MisParches() {
  const u = await pageUser();
  const items = await listPlansByCreator(u.id);
  const pend = await db.select({ planId: planParticipations.planId, n: sql<number>`count(*)::int` }).from(planParticipations).where(and(eq(planParticipations.status, "pending"), sql`${planParticipations.planId} in (select id from plans where creator_id = ${u.id})`)).groupBy(planParticipations.planId);
  return (
    <div>
      <PageTitle title="Mis parches" subtitle="Planes que organizas. Entra a cada uno para gestionar solicitudes." action={<Link href="/app/crear" className={linkBtn()}>Crear parche</Link>} />
      {items.length === 0 ? <EmptyState icon={<CalendarPlus className="h-8 w-8" />} title="Todavía no has creado parches"><Link href="/app/crear" className="font-semibold text-accent-dark">Crea el primero</Link></EmptyState> : (
        <ul className="space-y-3">
          {items.map((p) => {
            const n = pend.find((x) => x.planId === p.id)?.n ?? 0;
            return (
              <li key={p.id}><Card className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/parches/${p.id}`} className="font-bold hover:text-accent-dark">{p.title}</Link>
                  <p className="text-sm text-black/60">{fmtDate(p.startsAt)} · {p.locationName}</p>
                </div>
                {p.kind === "verified" && <Badge tone="teal">Verificado</Badge>}
                <Badge tone={p.status === "published" ? "teal" : p.status === "cancelled" ? "danger" : "neutral"}>{STATUS_LABEL[p.status]}</Badge>
                <span className="text-sm">{p.acceptedCount}/{p.capacity}</span>
                {n > 0 && <Badge tone="warn">{n} pendientes</Badge>}
                <Link href={`/parches/${p.id}`} className="rounded-full bg-black/5 px-3 py-1.5 text-sm font-semibold">Gestionar</Link>
              </Card></li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
