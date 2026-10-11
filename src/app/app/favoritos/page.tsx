import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Heart } from "lucide-react";
import { db } from "@/db";
import { categories, favorites, plans, users } from "@/db/schema";
import { PlanCard } from "@/components/plan-card";
import { EmptyState, PageTitle } from "@/components/ui";
import { pageUser } from "@/server/core";
import { toPlanDTO } from "@/server/plans";

export const metadata = { title: "Favoritos" };

export default async function Favoritos() {
  const u = await pageUser();
  const rows = await db.select({ p: plans, c: categories, u: users }).from(favorites).innerJoin(plans, eq(plans.id, favorites.planId)).innerJoin(categories, eq(categories.id, plans.categoryId)).innerJoin(users, eq(users.id, plans.creatorId)).where(eq(favorites.userId, u.id)).orderBy(desc(favorites.createdAt));
  const items = rows.filter((r) => r.p.status !== "draft" && r.p.status !== "pending_review").map((r) => toPlanDTO(r));
  return (
    <div>
      <PageTitle title="Favoritos" subtitle="Planes que guardaste para después." />
      {items.length === 0 ? <EmptyState icon={<Heart className="h-8 w-8" />} title="Aún no guardas planes"><Link href="/explorar" className="font-semibold text-accent-dark">Explora y guarda los que te gusten</Link></EmptyState> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((p) => <PlanCard key={p.id} plan={p} href={`/parches/${p.id}`} />)}</div>}
    </div>
  );
}
