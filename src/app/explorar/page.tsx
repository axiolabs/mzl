import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { PlanCard } from "@/components/plan-card";
import { EmptyState, Input, PageTitle, Select } from "@/components/ui";
import { getSessionUser } from "@/server/core";
import { getMeta } from "@/server/modules/plans";
import { listPublicPlans } from "@/server/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explorar parches" };

type SP = Promise<Record<string, string | undefined>>;

export default async function Explore({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const viewer = await getSessionUser();
  if (!viewer) redirect("/demo");
  const meta = await getMeta();
  const page = Math.max(1, Number(sp.page) || 1);
  const range = sp.range ?? "all";
  const now = new Date();
  const to = range === "today" ? new Date(new Date().setHours(23, 59, 59)) : range === "week" ? new Date(now.getTime() + 7 * 86400_000) : undefined;
  const result = await listPublicPlans({
    q: sp.q?.slice(0, 80) || undefined,
    categoryId: Number(sp.category) || undefined,
    kind: sp.kind === "community" || sp.kind === "verified" ? sp.kind : undefined,
    onlyAvailable: sp.available === "1",
    to,
    page,
    pageSize: 12,
    viewerId: viewer?.id,
  });
  const qs = (p: number) => { const s = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]); s.set("page", String(p)); return `?${s}`; };
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle title="Explorar parches" subtitle={`${result.total} planes próximos en Manizales`} />
      <form className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="lg:col-span-2"><label htmlFor="q" className="text-xs font-semibold">Buscar</label><Input id="q" name="q" defaultValue={sp.q} placeholder="Título, lugar…" /></div>
        <div><label htmlFor="category" className="text-xs font-semibold">Categoría</label><Select id="category" name="category" defaultValue={sp.category}><option value="">Todas</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        <div><label htmlFor="kind" className="text-xs font-semibold">Tipo</label><Select id="kind" name="kind" defaultValue={sp.kind}><option value="">Todos</option><option value="community">Comunitarios</option><option value="verified">Verificados</option></Select></div>
        <div><label htmlFor="range" className="text-xs font-semibold">Fecha</label><Select id="range" name="range" defaultValue={range}><option value="all">Próximos</option><option value="today">Hoy</option><option value="week">Esta semana</option></Select></div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" name="available" value="1" defaultChecked={sp.available === "1"} className="h-4 w-4 accent-[#ff5a3c]" />Con cupos</label>
          <button className="ml-auto rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
        </div>
      </form>
      {result.items.length === 0 ? (
        <EmptyState icon={<Compass className="h-8 w-8" />} title="No encontramos parches con esos filtros">Prueba con otra categoría o fecha. {viewer ? <Link className="font-semibold text-accent-dark" href="/app/crear">¿Y si creas uno?</Link> : <Link className="font-semibold text-accent-dark" href="/demo">Mira la demo</Link>}</EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.items.map((p) => <PlanCard key={p.id} plan={p} href={`/parches/${p.id}`} />)}</div>
      )}
      {result.pages > 1 && (
        <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3">
          {page > 1 && <Link href={qs(page - 1)} className="rounded-full bg-white px-4 py-2 font-semibold shadow-sm">← Anterior</Link>}
          <span className="text-sm text-black/60">Página {page} de {result.pages}</span>
          {page < result.pages && <Link href={qs(page + 1)} className="rounded-full bg-white px-4 py-2 font-semibold shadow-sm">Siguiente →</Link>}
        </nav>
      )}
    </div>
  );
}
