"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_BOUNDS, isWithinBounds } from "@/lib/geo";
import { checkPlanDates, fieldErrors, planCreateSchema } from "@/lib/validation";
import { api } from "./api";
import { Alert, Button, Field, Input, Select, Skeleton, Textarea } from "./ui";

const LocationPicker = dynamic(() => import("./location-picker"), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });

type Meta = { categories: { id: number; name: string }[]; places: { id: number; name: string; lat: number; lng: number }[] };
export type PlanFormValues = { title: string; description: string; categoryId: string; kind: "community" | "verified"; coverUrl: string; startsAt: string; endsAt: string; placeId: string; locationName: string; lat: number | null; lng: number | null; capacity: string; requirements: string; visibility: "public" | "unlisted" };

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

export function PlanForm({ meta, canVerified, initial, planId }: { meta: Meta; canVerified: boolean; initial?: Partial<PlanFormValues> & { startsAtIso?: string; endsAtIso?: string | null }; planId?: string }) {
  const router = useRouter();
  const [v, setV] = useState<PlanFormValues>({
    title: initial?.title ?? "", description: initial?.description ?? "", categoryId: initial?.categoryId ?? "", kind: initial?.kind ?? "community", coverUrl: initial?.coverUrl ?? "",
    startsAt: toLocalInput(initial?.startsAtIso), endsAt: toLocalInput(initial?.endsAtIso), placeId: initial?.placeId ?? "", locationName: initial?.locationName ?? "",
    lat: initial?.lat ?? null, lng: initial?.lng ?? null, capacity: initial?.capacity ?? "6", requirements: initial?.requirements ?? "", visibility: initial?.visibility ?? "public",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PlanFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const a = (k: string) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `${k}-error` : undefined });

  async function submit(publish: boolean) {
    if (busy) return;
    const payload = {
      title: v.title, description: v.description, categoryId: Number(v.categoryId) || 0, kind: v.kind, coverUrl: v.coverUrl,
      startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : "", endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : "",
      placeId: v.placeId ? Number(v.placeId) : null, locationName: v.locationName, lat: v.lat ?? NaN, lng: v.lng ?? NaN,
      capacity: Number(v.capacity), requirements: v.requirements, visibility: v.visibility, publish,
    };
    const parsed = planCreateSchema.safeParse(payload);
    const errs: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);
    if (v.lat == null || v.lng == null) errs.lat = "Elige un lugar o marca un punto en el mapa";
    else if (!isWithinBounds(v.lat, v.lng, DEFAULT_BOUNDS)) errs.lat = "La ubicación debe estar en Manizales";
    if (payload.startsAt) { const d = checkPlanDates({ startsAt: payload.startsAt, endsAt: payload.endsAt || undefined }); if (d) errs.startsAt = d; }
    if (Object.keys(errs).length) { setErrors(errs); setMsg("Revisa los campos marcados."); return; }
    setErrors({}); setBusy(true); setMsg(null);
    const body = planId ? (({ kind: _k, ...rest }) => (void _k, rest))(parsed.data!) : parsed.data;
    const r = await api<{ plan?: { id: string } }>(planId ? `plans/${planId}` : "plans", { method: planId ? "PATCH" : "POST", body });
    setBusy(false);
    if (!r.ok) { setErrors(r.fields ?? {}); setMsg(r.message); return; }
    const id = planId ?? r.data.plan!.id;
    router.push(`/parches/${id}`); router.refresh();
  }

  return (
    <form noValidate className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(true); }}>
      {!planId && canVerified && (
        <fieldset className="rounded-2xl border border-teal/30 bg-teal/5 p-4">
          <legend className="px-1 text-sm font-bold">Tipo de publicación</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="kind" checked={v.kind === "community"} onChange={() => setV({ ...v, kind: "community" })} />Parche comunitario (se publica ya)</label>
            <label className="flex items-center gap-2"><input type="radio" name="kind" checked={v.kind === "verified"} onChange={() => setV({ ...v, kind: "verified" })} />Evento verificado (pasa por revisión)</label>
          </div>
        </fieldset>
      )}
      <Field id="title" label="Título" error={errors.title}><Input id="title" maxLength={100} value={v.title} onChange={set("title")} placeholder="Ej.: Basket 3x3 en el Bosque Popular" {...a("title")} /></Field>
      <Field id="description" label="Descripción" error={errors.description}><Textarea id="description" rows={4} maxLength={2000} value={v.description} onChange={set("description")} {...a("description")} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="categoryId" label="Categoría" error={errors.categoryId}><Select id="categoryId" value={v.categoryId} onChange={set("categoryId")} {...a("categoryId")}><option value="">Elige…</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field id="capacity" label="Cupo máximo" error={errors.capacity}><Input id="capacity" type="number" min={2} max={500} value={v.capacity} onChange={set("capacity")} {...a("capacity")} /></Field>
        <Field id="visibility" label="Visibilidad"><Select id="visibility" value={v.visibility} onChange={set("visibility")}><option value="public">Pública (aparece en explorar y mapa)</option><option value="unlisted">Sólo con enlace</option></Select></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startsAt" label="Inicio" error={errors.startsAt}><Input id="startsAt" type="datetime-local" value={v.startsAt} onChange={set("startsAt")} {...a("startsAt")} /></Field>
        <Field id="endsAt" label="Finalización (opcional)" error={errors.endsAt}><Input id="endsAt" type="datetime-local" value={v.endsAt} onChange={set("endsAt")} /></Field>
      </div>
      <Field id="placeId" label="Lugar conocido" hint="Elige un lugar o marca el punto de encuentro en el mapa.">
        <Select id="placeId" value={v.placeId} onChange={(e) => { const p = meta.places.find((x) => String(x.id) === e.target.value); setV({ ...v, placeId: e.target.value, ...(p ? { lat: p.lat, lng: p.lng, locationName: p.name } : {}) }); }}>
          <option value="">Otro punto (marcar en el mapa)</option>{meta.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <div className="overflow-hidden rounded-2xl border border-black/10"><LocationPicker lat={v.lat} lng={v.lng} onPick={(lat, lng) => setV({ ...v, lat, lng, placeId: "" })} /></div>
      {errors.lat && <p role="alert" className="text-xs font-medium text-red-700">{errors.lat}</p>}
      <Field id="locationName" label="Punto de encuentro" error={errors.locationName} hint="Un lugar público. Nunca pongas una dirección residencial."><Input id="locationName" maxLength={140} value={v.locationName} onChange={set("locationName")} {...a("locationName")} /></Field>
      <Field id="requirements" label="Requisitos (opcional)" error={errors.requirements}><Input id="requirements" maxLength={500} value={v.requirements} onChange={set("requirements")} placeholder="Ej.: ropa deportiva" /></Field>
      <Field id="coverUrl" label="Imagen de portada (URL https, opcional)" error={errors.coverUrl} hint="Si la dejas vacía usamos una imagen de la categoría."><Input id="coverUrl" value={v.coverUrl} onChange={set("coverUrl")} /></Field>
      {msg && <Alert tone="error">{msg}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>{planId ? "Guardar cambios" : v.kind === "verified" ? "Enviar a revisión" : "Publicar parche"}</Button>
        {!planId && <Button type="button" variant="secondary" disabled={busy} onClick={() => submit(false)}>Guardar borrador</Button>}
      </div>
    </form>
  );
}
