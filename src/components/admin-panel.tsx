"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Alert, Badge, Button, Card, Input, Select, STATUS_LABEL, fmtDate } from "./ui";

type Any = Record<string, unknown> & { id: string | number };
const TABS = [["resumen", "Resumen"], ["usuarios", "Usuarios"], ["verificaciones", "Verificaciones"], ["moderacion", "Moderación de planes"], ["reportes", "Reportes"], ["catalogos", "Categorías, barrios y lugares"], ["apelaciones", "Apelaciones"], ["auditoria", "Auditoría"]] as const;

function useList(path: string) {
  const [items, setItems] = useState<Any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let alive = true;
    api<{ items: Any[] }>(path).then((r) => {
      if (!alive) return;
      if (r.ok) { setItems(r.data.items); setError(null); } else setError(r.message);
    });
    return () => { alive = false; };
  }, [path, tick]);
  return { items, error, load };
}

const ask = (label: string, required = true) => {
  const v = window.prompt(label);
  if (v === null) return null;
  if (required && v.trim().length < 3) { window.alert("La justificación es obligatoria (mín. 3 caracteres)."); return null; }
  return v.trim();
};

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-black/50">{head.map((h) => <th key={h} className="py-2 pr-3">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-black/5 align-top">{r.map((c, j) => <td key={j} className="py-2 pr-3">{c}</td>)}</tr>)}</tbody></table></div>
  );
}

function ListState({ items, error, empty }: { items: unknown[] | null; error: string | null; empty: string }) {
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!items) return <p className="text-sm text-black/50" role="status">Cargando…</p>;
  if (!items.length) return <p className="text-sm text-black/60">{empty}</p>;
  return null;
}

export function AdminPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("resumen");
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const act = async (path: string, body: unknown, after: () => void, method = "PATCH") => {
    const r = await api(path, { method, body });
    setFlash(r.ok ? { tone: "success", text: "Acción registrada." } : { tone: "error", text: r.message });
    if (r.ok) after();
  };
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Secciones de administración" className="flex flex-wrap gap-1 rounded-2xl bg-white p-1.5 shadow-sm">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setFlash(null); }} className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === k ? "bg-ink text-white" : "hover:bg-black/5"}`}>{l}</button>)}
      </div>
      {flash && <Alert tone={flash.tone}>{flash.text}</Alert>}
      <div role="tabpanel">
        {tab === "resumen" && <Summary />}
        {tab === "usuarios" && <Users act={act} />}
        {tab === "verificaciones" && <Verifications act={act} />}
        {tab === "moderacion" && <Moderation act={act} />}
        {tab === "reportes" && <Reports act={act} />}
        {tab === "catalogos" && <Catalog act={act} />}
        {tab === "apelaciones" && <Appeals act={act} />}
        {tab === "auditoria" && <Audit />}
      </div>
    </div>
  );
}
type Act = (path: string, body: unknown, after: () => void, method?: string) => Promise<void>;

function Summary() {
  const [d, setD] = useState<{ stats: Record<string, number>; integrations: Record<string, string> } | null>(null);
  useEffect(() => { api<{ stats: Record<string, number>; integrations: Record<string, string> }>("admin/stats").then((r) => r.ok && setD(r.data)); }, []);
  if (!d) return <p role="status">Cargando…</p>;
  const L: Record<string, string> = { active_users: "Usuarios activos", suspended_users: "Suspendidos", organizers: "Organizadores verificados", upcoming_plans: "Planes próximos", pending_plans: "Planes por revisar", pending_verifications: "Verificaciones pendientes", open_reports: "Reportes abiertos", accepted_participations: "Participaciones aceptadas", open_appeals: "Apelaciones abiertas" };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{Object.entries(d.stats).map(([k, v]) => <Card key={k}><p className="text-3xl font-extrabold">{v}</p><p className="text-xs text-black/60">{L[k] ?? k}</p></Card>)}</div>
      <Card><h3 className="mb-2 font-bold">Integraciones externas</h3><ul className="text-sm">{Object.entries(d.integrations).map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ul></Card>
    </div>
  );
}

function Users({ act }: { act: Act }) {
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const { items, error, load } = useList(`admin/users?page=${page}&q=${encodeURIComponent(query)}&status=${status}`);
  const run = (id: string | number, action: string, label: string) => { const note = ask(`Justificación para: ${label}`); if (note) act(`admin/users/${id}`, { action, note }, load); };
  return (
    <Card>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q); }} role="search">
        <Input aria-label="Buscar usuarios" placeholder="Usuario, correo o nombre" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-40"><option value="">Todos</option><option value="active">Activos</option><option value="suspended">Suspendidos</option></Select>
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>
      <ListState items={items} error={error} empty="Sin resultados." />
      {items && items.length > 0 && <Table head={["Usuario", "Correo", "Rol", "Estado", "Acciones"]} rows={items.map((u) => [
        <span key="u"><b>@{String(u.username)}</b>{u.isVerifiedOrganizer ? <> <Badge tone="teal">Organizador</Badge></> : null}</span>, String(u.email), String(u.role),
        <Badge key="s" tone={u.status === "active" ? "teal" : "danger"}>{String(u.status)}</Badge>,
        <div key="a" className="flex flex-wrap gap-1">
          {u.status === "active" ? <Button variant="ghost" onClick={() => run(u.id, "suspend", "suspender")}>Suspender</Button> : <Button variant="ghost" onClick={() => run(u.id, "reactivate", "reactivar")}>Reactivar</Button>}
          {u.isVerifiedOrganizer ? <Button variant="ghost" onClick={() => run(u.id, "revoke_verification", "revocar verificación")}>Revocar verificación</Button> : null}
          {u.role === "admin" ? <Button variant="ghost" onClick={() => run(u.id, "remove_admin", "quitar admin")}>Quitar admin</Button> : <Button variant="ghost" onClick={() => run(u.id, "make_admin", "hacer admin")}>Hacer admin</Button>}
        </div>,
      ])} />}
      <div className="mt-3 flex gap-2"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="secondary" disabled={(items?.length ?? 0) < 20} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
    </Card>
  );
}

function Verifications({ act }: { act: Act }) {
  const [status, setStatus] = useState("pending");
  const { items, error, load } = useList(`admin/verifications?status=${status}`);
  return (
    <Card>
      <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} className="mb-3 max-w-48"><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option><option value="revoked">Revocadas</option><option value="all">Todas</option></Select>
      <ListState items={items} error={error} empty="No hay solicitudes." />
      <ul className="space-y-3">{items?.map((v) => (
        <li key={v.id} className="rounded-xl border border-black/10 p-3">
          <p className="font-bold">{String(v.organizationName)} <span className="font-normal text-black/55">· @{String(v.username)} · {v.emailVerified ? "correo verificado" : "correo sin verificar"}</span></p>
          <p className="text-sm text-black/70">{String(v.description)}</p>
          {v.evidenceUrl ? <p className="text-sm">Soporte: <span className="break-all font-mono text-xs">{String(v.evidenceUrl)}</span> (revísalo manualmente; no se abre automáticamente)</p> : null}
          <p className="text-xs text-black/50">{fmtDate(String(v.createdAt))} · {String(v.status)}{v.reviewNote ? ` · ${String(v.reviewNote)}` : ""}</p>
          {v.status === "pending" && <div className="mt-2 flex gap-2">
            <Button onClick={() => { const note = ask("Nota de aprobación (opcional)", false); if (note !== null) act(`admin/verifications/${v.id}`, { decision: "approve", note: note || undefined }, load); }}>Aprobar</Button>
            <Button variant="secondary" onClick={() => { const note = ask("Justificación del rechazo"); if (note) act(`admin/verifications/${v.id}`, { decision: "reject", note }, load); }}>Rechazar</Button>
          </div>}
        </li>
      ))}</ul>
    </Card>
  );
}

function Moderation({ act }: { act: Act }) {
  const [status, setStatus] = useState("pending_review");
  const { items, error, load } = useList(`admin/plans?status=${status}`);
  const run = (id: string | number, action: string, needNote: boolean) => { const note = ask(`Nota para ${action}`, needNote); if (note !== null) act(`admin/plans/${id}`, { action, note: note || undefined }, load); };
  return (
    <Card>
      <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} className="mb-3 max-w-56"><option value="pending_review">Pendientes de revisión</option><option value="published">Publicados</option><option value="full">Completos</option><option value="cancelled">Cancelados</option><option value="all">Todos</option></Select>
      <ListState items={items} error={error} empty="Nada por moderar." />
      {items && items.length > 0 && <Table head={["Plan", "Creador", "Fecha", "Estado", "Acciones"]} rows={items.map((p) => [
        <a key="t" href={`/parches/${p.id}`} className="font-semibold">{String(p.title)} {p.kind === "verified" ? <Badge tone="teal">Verificado</Badge> : null}</a>, `@${String(p.creator)}`, fmtDate(String(p.startsAt)), STATUS_LABEL[String(p.status)],
        <div key="a" className="flex flex-wrap gap-1">
          {p.status === "pending_review" && <><Button onClick={() => run(p.id, "approve", false)}>Publicar</Button><Button variant="secondary" onClick={() => run(p.id, "reject", true)}>Rechazar</Button></>}
          {(p.status === "published" || p.status === "full") && <Button variant="danger" onClick={() => run(p.id, "cancel", true)}>Cancelar</Button>}
          {p.status === "cancelled" && <Button variant="ghost" onClick={() => run(p.id, "restore", true)}>Restaurar</Button>}
        </div>,
      ])} />}
    </Card>
  );
}

function Reports({ act }: { act: Act }) {
  const [status, setStatus] = useState("");
  const { items, error, load } = useList(`admin/reports${status ? `?status=${status}` : ""}`);
  return (
    <Card>
      <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} className="mb-3 max-w-48"><option value="">Abiertos</option><option value="resolved">Resueltos</option><option value="dismissed">Descartados</option></Select>
      <ListState items={items} error={error} empty="Sin reportes." />
      <ul className="space-y-3">{items?.map((r) => (
        <li key={r.id} className="rounded-xl border border-black/10 p-3 text-sm">
          <p><Badge tone="danger">{String(r.reason)}</Badge> sobre {r.targetType === "plan" ? <a className="font-semibold" href={`/parches/${r.targetPlanId}`}>plan «{String(r.planTitle)}»</a> : <a className="font-semibold" href={`/u/${r.targetUsername}`}>@{String(r.targetUsername)}</a>} · por @{String(r.reporter)} · {fmtDate(String(r.createdAt))}</p>
          {r.details ? <p className="mt-1 text-black/70">“{String(r.details)}”</p> : null}
          {r.resolution ? <p className="text-xs text-black/55">Resolución: {String(r.resolution)}</p> : null}
          {(r.status === "open" || r.status === "reviewing") && <div className="mt-2 flex flex-wrap gap-2">
            {r.status === "open" && <Button variant="secondary" onClick={() => act(`admin/reports/${r.id}`, { status: "reviewing" }, load)}>En revisión</Button>}
            <Button onClick={() => { const n = ask("Resolución"); if (n) act(`admin/reports/${r.id}`, { status: "resolved", resolution: n }, load); }}>Resolver</Button>
            <Button variant="ghost" onClick={() => { const n = ask("Motivo para descartar"); if (n) act(`admin/reports/${r.id}`, { status: "dismissed", resolution: n }, load); }}>Descartar</Button>
          </div>}
        </li>
      ))}</ul>
    </Card>
  );
}

function Catalog({ act }: { act: Act }) {
  const [d, setD] = useState<{ categories: Any[]; barrios: Any[]; places: Any[] } | null>(null);
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => { api<{ categories: Any[]; barrios: Any[]; places: Any[] }>("admin/catalog").then((r) => { if (r.ok) setD(r.data); }); }, [tick]);
  const [cat, setCat] = useState({ slug: "", name: "" });
  const [bar, setBar] = useState({ name: "", lat: "", lng: "" });
  const [pl, setPl] = useState({ name: "", lat: "", lng: "", description: "" });
  if (!d) return <p role="status">Cargando…</p>;
  const toggle = (type: string, x: Any) => act("admin/catalog", { type, id: x.id, ...(type === "category" ? { slug: x.slug, name: x.name, icon: x.icon } : type === "barrio" ? { name: x.name, sector: x.sector ?? undefined, lat: x.lat ?? undefined, lng: x.lng ?? undefined } : { name: x.name, description: x.description ?? undefined, barrioId: x.barrioId ?? null, lat: x.lat, lng: x.lng }), active: !x.active }, load, "POST");
  const chip = (type: string, x: Any) => <li key={String(x.id)}><button onClick={() => toggle(type, x)} title={x.active ? "Desactivar" : "Activar"} className={`rounded-full border px-3 py-1 text-sm ${x.active ? "border-teal/40 bg-teal/10" : "border-black/10 text-black/40 line-through"}`}>{String(x.name)}</button></li>;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card><h3 className="mb-2 font-bold">Categorías</h3><ul className="mb-3 flex flex-wrap gap-1.5">{d.categories.map((c) => chip("category", c))}</ul>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act("admin/catalog", { type: "category", ...cat }, () => { setCat({ slug: "", name: "" }); load(); }, "POST"); }}><Input aria-label="Slug" placeholder="slug (ej. danza)" value={cat.slug} onChange={(e) => setCat({ ...cat, slug: e.target.value })} /><Input aria-label="Nombre" placeholder="Nombre" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /><Button type="submit">Añadir</Button></form></Card>
      <Card><h3 className="mb-1 font-bold">Barrios y sectores</h3><p className="mb-2 text-xs text-black/55">Lista inicial no oficial: valídala con la división oficial de la Alcaldía.</p><ul className="mb-3 flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">{d.barrios.map((b) => chip("barrio", b))}</ul>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act("admin/catalog", { type: "barrio", name: bar.name, ...(bar.lat && bar.lng ? { lat: Number(bar.lat), lng: Number(bar.lng) } : {}) }, () => { setBar({ name: "", lat: "", lng: "" }); load(); }, "POST"); }}><Input aria-label="Nombre del barrio" placeholder="Nombre" value={bar.name} onChange={(e) => setBar({ ...bar, name: e.target.value })} /><div className="flex gap-2"><Input aria-label="Latitud" placeholder="Lat (opcional)" value={bar.lat} onChange={(e) => setBar({ ...bar, lat: e.target.value })} /><Input aria-label="Longitud" placeholder="Lng" value={bar.lng} onChange={(e) => setBar({ ...bar, lng: e.target.value })} /></div><Button type="submit">Añadir</Button></form></Card>
      <Card><h3 className="mb-2 font-bold">Lugares</h3><ul className="mb-3 flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">{d.places.map((p) => chip("place", p))}</ul>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act("admin/catalog", { type: "place", name: pl.name, description: pl.description || undefined, lat: Number(pl.lat), lng: Number(pl.lng) }, () => { setPl({ name: "", lat: "", lng: "", description: "" }); load(); }, "POST"); }}><Input aria-label="Nombre del lugar" placeholder="Nombre" value={pl.name} onChange={(e) => setPl({ ...pl, name: e.target.value })} /><Input aria-label="Descripción" placeholder="Descripción" value={pl.description} onChange={(e) => setPl({ ...pl, description: e.target.value })} /><div className="flex gap-2"><Input aria-label="Latitud" placeholder="Lat" value={pl.lat} onChange={(e) => setPl({ ...pl, lat: e.target.value })} /><Input aria-label="Longitud" placeholder="Lng" value={pl.lng} onChange={(e) => setPl({ ...pl, lng: e.target.value })} /></div><Button type="submit">Añadir</Button></form></Card>
    </div>
  );
}

function Appeals({ act }: { act: Act }) {
  const { items, error, load } = useList("admin/appeals");
  return (
    <Card><ListState items={items} error={error} empty="Sin apelaciones abiertas." />
      <ul className="space-y-3">{items?.map((a) => <li key={a.id} className="rounded-xl border border-black/10 p-3 text-sm"><p><b>@{String(a.username)}</b> ({String(a.userStatus)}) · {fmtDate(String(a.createdAt))}</p><p className="my-1 text-black/70">“{String(a.message)}”</p>
        <div className="flex gap-2"><Button onClick={() => { const n = ask("Nota (reactivará la cuenta)"); if (n) act(`admin/appeals/${a.id}`, { decision: "approve", note: n }, load); }}>Aceptar y reactivar</Button><Button variant="secondary" onClick={() => { const n = ask("Motivo"); if (n) act(`admin/appeals/${a.id}`, { decision: "reject", note: n }, load); }}>Rechazar</Button></div></li>)}</ul>
    </Card>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const { items, error } = useList(`admin/audit?page=${page}`);
  return (
    <Card><ListState items={items} error={error} empty="Sin registros." />
      {items && items.length > 0 && <Table head={["Fecha", "Actor", "Acción", "Objetivo", "Antes → Después", "Justificación"]} rows={items.map((a) => [fmtDate(String(a.createdAt)), a.actor ? `@${String(a.actor)}` : "sistema", <code key="c">{String(a.action)}</code>, `${String(a.targetType)}:${String(a.targetId).slice(0, 8)}`, <span key="d" className="font-mono text-xs">{JSON.stringify(a.before ?? {})} → {JSON.stringify(a.after ?? {})}</span>, String(a.note ?? "")])} />}
      <div className="mt-3 flex gap-2"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="secondary" disabled={(items?.length ?? 0) < 20} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
    </Card>
  );
}
