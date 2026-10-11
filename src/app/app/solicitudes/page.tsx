import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Send } from "lucide-react";
import { db } from "@/db";
import { categories, planParticipations, plans, users } from "@/db/schema";
import { Badge, Card, EmptyState, PageTitle, STATUS_LABEL, fmtDate } from "@/components/ui";
import { effectiveStatus } from "@/lib/permissions";
import { pageUser } from "@/server/core";

export const metadata = { title: "Mis solicitudes" };

export default async function Solicitudes() {
  const u = await pageUser();
  const rows = await db.select({ part: planParticipations, p: plans, c: categories, creator: users.username }).from(planParticipations).innerJoin(plans, eq(plans.id, planParticipations.planId)).innerJoin(categories, eq(categories.id, plans.categoryId)).innerJoin(users, eq(users.id, plans.creatorId)).where(eq(planParticipations.userId, u.id)).orderBy(desc(planParticipations.updatedAt)).limit(100);
  return (
    <div>
      <PageTitle title="Mis solicitudes" subtitle="Planes a los que pediste unirte." />
      {rows.length === 0 ? <EmptyState icon={<Send className="h-8 w-8" />} title="No has enviado solicitudes"><Link href="/explorar" className="font-semibold text-accent-dark">Explora parches</Link></EmptyState> : (
        <ul className="space-y-3">{rows.map((r) => (
          <li key={r.part.id}><Card className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1"><Link href={`/parches/${r.p.id}`} className="font-bold hover:text-accent-dark">{r.p.title}</Link><p className="text-sm text-black/60">{fmtDate(r.p.startsAt.toISOString())} · @{r.creator} · {r.c.name}</p></div>
            {effectiveStatus(r.p) !== "published" && <Badge>{STATUS_LABEL[effectiveStatus(r.p)]}</Badge>}
            <Badge tone={r.part.status === "accepted" ? "teal" : r.part.status === "pending" ? "warn" : "neutral"}>{STATUS_LABEL[r.part.status]}</Badge>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
