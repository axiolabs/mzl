"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell, Compass, Eye, Home, LayoutDashboard, Map, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { DemoView } from "@/lib/demo-view";
import { MapView } from "./map-view";
import { PlanCard } from "./plan-card";
import { Alert, Avatar, Badge, Card, VerifiedBadge } from "./ui";

export function DemoBanner() {
  return (
    <div className="bg-ink text-white" role="note">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <span className="flex items-center gap-2"><Eye className="h-4 w-4 text-sun" aria-hidden /><b>Modo demo</b> · solo lectura · datos 100 % ficticios · nada se guarda</span>
        <Link href="/registro" className="rounded-full bg-accent px-3 py-1 font-semibold">Crear cuenta real</Link>
      </div>
    </div>
  );
}

export function useDemoToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (action: string) => { setMsg(`En la demo «${action}» es sólo ilustrativo: no se envía ni se guarda nada. Crea una cuenta para hacerlo de verdad.`); setTimeout(() => setMsg(null), 4500); };
  const node = msg ? <div className="fade-in fixed bottom-4 left-1/2 z-[2000] w-[92%] max-w-md -translate-x-1/2"><Alert tone="info">{msg}</Alert></div> : null;
  return { show, node };
}

type Data = { plans: DemoView[]; users: { id: string; username: string; name: string; bio: string; interests: string[]; verified?: string }[]; notifications: { id: number; title: string; body: string; ago: string }[]; categories: { slug: string; name: string }[]; places: { name: string; lat: number; lng: number }[] };

const TABS = [
  ["inicio", "Inicio", Home], ["explorar", "Explorar", Compass], ["mapa", "Mapa", Map], ["notificaciones", "Notificaciones", Bell], ["perfil", "Perfil", UserRound], ["organizador", "Organizador", LayoutDashboard], ["admin", "Vista admin", ShieldCheck],
] as const;

export function DemoApp({ data }: { data: Data }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("inicio");
  const { show, node } = useDemoToast();
  const me = data.users[0];
  const active = data.plans.filter((p) => p.status !== "finished");
  const recs = active.filter((p) => p.status === "published").map((p) => ({ p, reasons: me.interests.includes(p.category.slug) ? [`Porque te interesa ${p.category.name.toLowerCase()}`] : ["Próximo plan con cupos en Manizales"] })).sort((a, b) => b.reasons[0].startsWith("Porque") ? 1 : a.reasons[0].startsWith("Porque") ? -1 : 0);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {node}
      <div role="tablist" aria-label="Secciones de la demo" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm">
        {TABS.map(([k, l, Icon]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${tab === k ? "bg-ink text-white" : "hover:bg-black/5"}`}><Icon className="h-4 w-4" aria-hidden />{l}</button>)}
      </div>
      <div role="tabpanel" className="fade-in">
        {tab === "inicio" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold">¡Hola, {me.name.split(" ")[0]}! 👋</h1>
            <h2 className="flex items-center gap-2 text-xl font-bold"><Sparkles className="h-5 w-5 text-accent" aria-hidden />Recomendados para ti (ejemplo)</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recs.slice(0, 6).map(({ p, reasons }) => <PlanCard key={p.id} plan={p} href={`/demo/parches/${p.id}`} reasons={reasons} />)}</div>
          </div>
        )}
        {tab === "explorar" && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.plans.map((p) => <PlanCard key={p.id} plan={p} href={`/demo/parches/${p.id}`} />)}</div>}
        {tab === "mapa" && <MapView mode="static" staticPlans={data.plans} categories={data.categories.map((c) => ({ id: c.slug, name: c.name }))} places={data.places} hrefBase="/demo/parches/" />}
        {tab === "notificaciones" && <ul className="mx-auto max-w-2xl space-y-2">{data.notifications.map((n) => <li key={n.id}><Card className="border-l-4 border-l-accent"><div className="flex justify-between"><p className="font-semibold">{n.title}</p><span className="text-xs text-black/50">{n.ago}</span></div><p className="text-sm text-black/70">{n.body}</p></Card></li>)}</ul>}
        {tab === "perfil" && (
          <Card className="mx-auto max-w-2xl">
            <div className="flex items-center gap-4"><Avatar src={null} name={me.name} size={88} /><div><h2 className="text-2xl font-extrabold">{me.name}</h2><p className="text-black/55">@{me.username} · Manizales</p></div></div>
            <p className="mt-3">{me.bio}</p>
            <div className="mt-3 flex gap-1.5">{me.interests.map((i) => <Badge key={i} tone="accent">{data.categories.find((c) => c.slug === i)?.name}</Badge>)}</div>
            <button onClick={() => show("Subir foto")} className="mt-4 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold">Subir foto</button>
          </Card>
        )}
        {tab === "organizador" && (
          <Card>
            <p className="mb-3"><VerifiedBadge label="Organizador verificado (ficticio)" /> <b className="ml-2">{data.users[3].verified}</b></p>
            <table className="w-full text-left text-sm"><caption className="sr-only">Actividades del organizador ficticio</caption><thead><tr className="text-black/50"><th className="py-2">Actividad</th><th>Ocupación</th></tr></thead>
              <tbody>{data.plans.filter((p) => p.creator.username === data.users[3].username).map((p) => <tr key={p.id} className="border-t border-black/5"><td className="py-2">{p.title}</td><td>{p.acceptedCount}/{p.capacity}</td></tr>)}</tbody></table>
          </Card>
        )}
        {tab === "admin" && (
          <div className="space-y-3">
            <Alert tone="warn">Vista ilustrativa del panel administrativo con cifras de ejemplo. La demo nunca usa credenciales ni permisos de administrador.</Alert>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Planes próximos", active.length], ["Verificaciones pendientes", 2], ["Reportes abiertos", 1], ["Organizadores verificados", 2]].map(([l, n]) => <Card key={String(l)}><p className="text-3xl font-extrabold">{n}</p><p className="text-xs text-black/60">{l}</p></Card>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DemoPlanActions({ title }: { title: string }) {
  const { show, node } = useDemoToast();
  return (
    <div className="space-y-2">
      {node}
      <button onClick={() => show(`Solicitar unirme a ${title}`)} className="w-full rounded-full bg-accent py-3 font-semibold text-white">Solicitar unirme</button>
      <button onClick={() => show("Guardar en favoritos")} className="w-full rounded-full border border-black/10 bg-white py-2 font-semibold">Guardar en favoritos</button>
      <button onClick={() => show("Reportar")} className="w-full rounded-full py-2 text-sm font-semibold hover:bg-black/5">Reportar</button>
    </div>
  );
}
