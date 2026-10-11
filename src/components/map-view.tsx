"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Map as MapIcon, Search } from "lucide-react";
import { PlanCard, type CardPlan } from "./plan-card";
import { Alert, EmptyState, Input, Select, Skeleton } from "./ui";
import type { MapPlan } from "./map-inner";

const MapInner = dynamic(() => import("./map-inner"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

type Plan = MapPlan & CardPlan;
type B = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export function MapView({
  mode,
  staticPlans = [],
  categories,
  places,
  hrefBase,
}: {
  mode: "api" | "static";
  staticPlans?: Plan[];
  categories: { id: number | string; name: string }[];
  places: { name: string; lat: number; lng: number }[];
  hrefBase: string;
}) {
  const [view, setView] = useState<"map" | "list">("map");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState("");
  const [range, setRange] = useState("all");
  const [available, setAvailable] = useState(false);
  const [bounds, setBounds] = useState<B | null>(null);
  const [items, setItems] = useState<Plan[]>(mode === "static" ? staticPlans : []);
  const [loading, setLoading] = useState(mode === "api");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fly, setFly] = useState<[number, number] | null>(null);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateRange = useCallback(() => {
    const now = new Date();
    if (range === "today") { const e = new Date(now); e.setHours(23, 59, 59); return { from: now, to: e }; }
    if (range === "week") return { from: now, to: new Date(now.getTime() + 7 * 86400_000) };
    return { from: now, to: null as Date | null };
  }, [range]);

  // Modo API: consulta acotada al bbox visible con debounce y cancelación de peticiones previas.
  useEffect(() => {
    if (mode !== "api" || !bounds) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      setError(null);
      const r = dateRange();
      const qs = new URLSearchParams({ bbox: [bounds.minLat, bounds.minLng, bounds.maxLat, bounds.maxLng].map((n) => n.toFixed(4)).join(","), pageSize: "200" });
      if (category) qs.set("category", category);
      if (kind) qs.set("kind", kind);
      if (available) qs.set("available", "1");
      if (r.to) qs.set("to", r.to.toISOString());
      try {
        const res = await fetch(`/api/v1/plans?${qs}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setItems(data.items);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("No pudimos cargar los planes del mapa. Intenta mover el mapa o recargar.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
  }, [mode, bounds, category, kind, available, dateRange]);

  const shown = useMemo(() => {
    if (mode === "api") return items;
    const r = dateRange();
    return staticPlans.filter((p) =>
      (!category || p.category.name === category) && (!kind || p.kind === kind) && (!available || p.acceptedCount < p.capacity) &&
      new Date(p.startsAt) >= r.from && (!r.to || new Date(p.startsAt) <= r.to) && p.status !== "finished");
  }, [mode, items, staticPlans, category, kind, available, dateRange]);

  const matches = search.length >= 2 ? places.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative min-w-56 flex-1">
          <label htmlFor="place-search" className="text-xs font-semibold">Buscar lugar o sector</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-black/40" aria-hidden /><Input id="place-search" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej.: Chipre, El Cable…" autoComplete="off" /></div>
          {matches.length > 0 && (
            <ul className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg" role="listbox" aria-label="Lugares">
              {matches.map((m) => <li key={m.name}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-black/5" onClick={() => { setFly([m.lat, m.lng]); setSearch(""); setView("map"); }}>{m.name}</button></li>)}
            </ul>
          )}
        </div>
        <div><label htmlFor="f-cat" className="text-xs font-semibold">Categoría</label>
          <Select id="f-cat" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas</option>{categories.map((c) => <option key={c.id} value={mode === "api" ? c.id : c.name}>{c.name}</option>)}</Select></div>
        <div><label htmlFor="f-kind" className="text-xs font-semibold">Tipo</label>
          <Select id="f-kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos</option><option value="community">Comunitarios</option><option value="verified">Verificados</option></Select></div>
        <div><label htmlFor="f-date" className="text-xs font-semibold">Fecha</label>
          <Select id="f-date" value={range} onChange={(e) => setRange(e.target.value)}><option value="all">Próximos</option><option value="today">Hoy</option><option value="week">Esta semana</option></Select></div>
        <label className="flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4 accent-[#ff5a3c]" />Con cupos</label>
        <div className="flex rounded-full bg-black/5 p-1" role="group" aria-label="Vista">
          <button type="button" onClick={() => setView("map")} aria-pressed={view === "map"} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${view === "map" ? "bg-white shadow" : ""}`}><MapIcon className="h-4 w-4" aria-hidden />Mapa</button>
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${view === "list" ? "bg-white shadow" : ""}`}><List className="h-4 w-4" aria-hidden />Lista</button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-black/60" aria-live="polite">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-accent" />Comunitario</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-teal" />Verificado</span>
        <span>{loading ? "Cargando…" : `${shown.length} planes en esta zona`}</span>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className={view === "map" ? "h-[65vh] min-h-96 overflow-hidden rounded-2xl shadow-sm" : "hidden"}>
        <MapInner plans={shown} hrefBase={hrefBase} onView={setBounds} flyTarget={fly} />
      </div>
      {view === "list" && (shown.length === 0 ? (
        <EmptyState title="No hay planes en esta zona">Mueve el mapa, amplía el rango de fechas o quita filtros.</EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shown.map((p) => <PlanCard key={p.id} plan={p} href={`${hrefBase}${p.id}`} />)}</div>
      ))}
    </div>
  );
}
