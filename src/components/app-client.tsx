"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { MAX_AVATAR_BYTES } from "@/lib/image";
import { changePasswordSchema, fieldErrors, profileSchema, verificationRequestSchema } from "@/lib/validation";
import { api } from "./api";
import { Alert, Avatar, Badge, Button, Card, Field, Input, Select, STATUS_LABEL, Textarea, fmtDate } from "./ui";

type Msg = { tone: "success" | "error" | "info"; text: string } | null;

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <Button variant="secondary" loading={busy} onClick={async () => { setBusy(true); await api("notifications/read-all", { method: "POST" }); setBusy(false); router.refresh(); }}>Marcar todo como leído</Button>;
}

export function AvatarUploader({ current, name }: { current: string | null; name: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Vista previa de la nueva foto" className="h-28 w-28 rounded-full object-cover" />
      ) : <Avatar src={current} name={name} size={112} />}
      <div className="space-y-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file" onChange={(e) => {
          const f = e.target.files?.[0];
          setMsg(null);
          if (!f) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setMsg({ tone: "error", text: "Usa JPG, PNG o WebP." }); return; }
          if (f.size > MAX_AVATAR_BYTES) { setMsg({ tone: "error", text: "La imagen supera 3 MB." }); return; }
          setFile(f); setPreview(URL.createObjectURL(f));
        }} />
        <div className="flex flex-wrap gap-2">
          <label htmlFor="avatar-file" className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/5"><Camera className="h-4 w-4" aria-hidden />{current ? "Reemplazar foto" : "Subir foto"}</label>
          {file && <Button loading={busy} onClick={async () => {
            setBusy(true);
            const fd = new FormData(); fd.append("file", file);
            const r = await api("profile/avatar", { form: fd });
            setBusy(false);
            if (r.ok) { setMsg({ tone: "success", text: "Foto actualizada." }); setFile(null); setPreview(null); router.refresh(); } else setMsg({ tone: "error", text: r.message });
          }}>Guardar foto</Button>}
          {file && <Button variant="ghost" onClick={() => { setFile(null); setPreview(null); if (input.current) input.current.value = ""; }}>Descartar</Button>}
          {current && !file && <Button variant="ghost" loading={busy} onClick={async () => {
            if (!window.confirm("¿Eliminar tu foto de perfil?")) return;
            setBusy(true); const r = await api("profile/avatar", { method: "DELETE" }); setBusy(false);
            if (r.ok) { setMsg({ tone: "success", text: "Foto eliminada." }); router.refresh(); } else setMsg({ tone: "error", text: r.message });
          }}><Trash2 className="h-4 w-4" aria-hidden />Eliminar</Button>}
        </div>
        <p className="text-xs text-black/55">JPG, PNG o WebP · máx. 3 MB · mín. 128 px. Se recorta en cuadrado y se eliminan los metadatos (incluida la ubicación).</p>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      </div>
    </div>
  );
}

type Profile = { firstName: string; lastName: string; bio: string | null; barrioId: number | null; interests: number[]; preferences: { showBarrio: boolean; showInterests: boolean; showUpcoming: boolean; useBarrioForRecommendations: boolean; emailNotifications: boolean } | null };

export function ProfileEditor({ profile, categories, barrios }: { profile: Profile; categories: { id: number; name: string }[]; barrios: { id: number; name: string }[] }) {
  const router = useRouter();
  const p0 = profile.preferences ?? { showBarrio: false, showInterests: true, showUpcoming: true, useBarrioForRecommendations: false, emailNotifications: true };
  const [v, setV] = useState({ firstName: profile.firstName, lastName: profile.lastName, bio: profile.bio ?? "", barrioId: profile.barrioId ? String(profile.barrioId) : "", interests: profile.interests, ...p0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const p0 = profile.preferences ?? { showBarrio: false, showInterests: true, showUpcoming: true, useBarrioForRecommendations: false, emailNotifications: true };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setV({
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio ?? "",
      barrioId: profile.barrioId ? String(profile.barrioId) : "",
      interests: profile.interests,
      ...p0,
    });
    setMsg(null);
    setErrors({});
  }, [profile]);
  const toggle = (k: "showBarrio" | "showInterests" | "showUpcoming" | "useBarrioForRecommendations" | "emailNotifications", label: string, hint?: string) => (
    <label className="flex items-start gap-3 rounded-xl p-2 hover:bg-black/5"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#ff5a3c]" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} /><span><span className="text-sm font-semibold">{label}</span>{hint && <span className="block text-xs text-black/55">{hint}</span>}</span></label>
  );
  return (
    <form noValidate className="space-y-6" onSubmit={async (e) => {
      e.preventDefault();
      const body = { ...v, barrioId: v.barrioId ? Number(v.barrioId) : null };
      const parsed = profileSchema.safeParse(body);
      if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
      setBusy(true); setErrors({});
      const r = await api("profile", { method: "PATCH", body: parsed.data });
      setBusy(false);
      if (r.ok) { setMsg({ tone: "success", text: "Perfil guardado." }); router.refresh(); } else { setErrors(r.fields ?? {}); setMsg({ tone: "error", text: r.message }); }
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="Nombre" error={errors.firstName}><Input id="firstName" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} /></Field>
        <Field id="lastName" label="Apellido" error={errors.lastName}><Input id="lastName" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} /></Field>
      </div>
      <Field id="bio" label="Biografía (opcional)" error={errors.bio} hint={`${v.bio.length}/280`}><Textarea id="bio" rows={3} maxLength={280} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="city" label="Ciudad"><p id="city" className="rounded-xl bg-black/5 px-3 py-2 text-sm">Manizales, Caldas, Colombia</p></Field>
        <Field id="barrioId" label="Barrio o sector" error={errors.barrioId}><Select id="barrioId" value={v.barrioId} onChange={(e) => setV({ ...v, barrioId: e.target.value })}><option value="">Prefiero no indicarlo</option>{barrios.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Intereses</legend>
        <div className="flex flex-wrap gap-2">{categories.map((c) => {
          const on = v.interests.includes(c.id);
          return <button type="button" key={c.id} aria-pressed={on} onClick={() => setV({ ...v, interests: on ? v.interests.filter((x) => x !== c.id) : [...v.interests, c.id] })} className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${on ? "border-accent bg-accent text-white" : "border-black/10 bg-white hover:bg-black/5"}`}>{c.name}</button>;
        })}</div>
      </fieldset>
      <fieldset className="rounded-2xl border border-black/10 p-3">
        <legend className="px-1 text-sm font-bold">Privacidad</legend>
        {toggle("showBarrio", "Mostrar mi barrio en el perfil público")}
        {toggle("showInterests", "Mostrar mis intereses en el perfil público")}
        {toggle("showUpcoming", "Mostrar mis próximos parches públicos en el perfil")}
        {toggle("useBarrioForRecommendations", "Usar mi barrio para recomendarme planes cercanos", "Usamos sólo la zona aproximada del barrio, nunca tu ubicación GPS.")}
        {toggle("emailNotifications", "Recibir avisos por correo (cuando el correo esté activo)")}
      </fieldset>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" loading={busy}>Guardar perfil</Button>
    </form>
  );
}

type Sess = { id: string; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean };
type Blocked = { id: string; username: string; displayName: string; avatarUrl: string | null };

export function SettingsPanel({ emailVerified }: { emailVerified: boolean }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Sess[] | null>(null);
  const [blocked, setBlocked] = useState<Blocked[] | null>(null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [del, setDel] = useState({ password: "", confirm: "" });
  const [msg, setMsg] = useState<Record<string, Msg>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const load = () =>
    Promise.all([api<{ sessions: Sess[] }>("auth/sessions"), api<{ items: Blocked[] }>("blocks")]).then(([s, b]) => {
      if (s.ok) setSessions(s.data.sessions);
      if (b.ok) setBlocked(b.data.items);
    });
  useEffect(() => {
    Promise.all([api<{ sessions: Sess[] }>("auth/sessions"), api<{ items: Blocked[] }>("blocks")]).then(([s, b]) => {
      if (s.ok) setSessions(s.data.sessions);
      if (b.ok) setBlocked(b.data.items);
    });
  }, []);
  const say = (k: string, m: Msg) => setMsg((x) => ({ ...x, [k]: m }));
  return (
    <div className="space-y-6">
      {!emailVerified && <Card><h2 className="mb-2 font-bold">Verificación de correo</h2><Button variant="secondary" loading={busy === "resend"} onClick={async () => { setBusy("resend"); const r = await api("auth/resend-verification", { method: "POST" }); setBusy(null); say("resend", r.ok ? { tone: "success", text: "Si el correo está configurado, te llegará un nuevo enlace." } : { tone: "error", text: r.message }); }}>Reenviar enlace</Button>{msg.resend && <div className="mt-2"><Alert tone={msg.resend.tone}>{msg.resend.text}</Alert></div>}</Card>}
      <Card>
        <h2 className="mb-3 font-bold">Cambiar contraseña</h2>
        <form noValidate className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          const p = changePasswordSchema.safeParse(pw);
          if (!p.success) { say("pw", { tone: "error", text: Object.values(fieldErrors(p.error))[0] }); return; }
          setBusy("pw"); const r = await api("auth/change-password", { body: p.data }); setBusy(null);
          if (r.ok) { setPw({ currentPassword: "", newPassword: "" }); say("pw", { tone: "success", text: "Contraseña actualizada. Cerramos tus otras sesiones." }); load(); } else say("pw", { tone: "error", text: r.message });
        }}>
          <Field id="cur" label="Contraseña actual"><Input id="cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field id="new" label="Nueva contraseña"><Input id="new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <div className="sm:col-span-2 space-y-2">{msg.pw && <Alert tone={msg.pw.tone}>{msg.pw.text}</Alert>}<Button type="submit" loading={busy === "pw"}>Actualizar</Button></div>
        </form>
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Sesiones activas</h2><Button variant="secondary" loading={busy === "rev"} onClick={async () => { setBusy("rev"); await api("auth/revoke-other-sessions", { method: "POST" }); setBusy(null); load(); }}>Cerrar las demás sesiones</Button></div>
        {!sessions ? <p className="text-sm text-black/50">Cargando…</p> : <ul className="divide-y divide-black/5 text-sm">{sessions.map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="truncate">{s.userAgent?.slice(0, 70) ?? "Dispositivo"}</span><span className="text-black/55">{s.current ? <Badge tone="teal">Esta sesión</Badge> : `Última actividad ${fmtDate(s.lastSeenAt)}`}</span></li>)}</ul>}
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Usuarios bloqueados</h2>
        {!blocked ? <p className="text-sm text-black/50">Cargando…</p> : blocked.length === 0 ? <p className="text-sm text-black/60">No has bloqueado a nadie.</p> : <ul className="divide-y divide-black/5">{blocked.map((b) => <li key={b.id} className="flex items-center gap-3 py-2"><Avatar src={b.avatarUrl} name={b.displayName} size={32} /><span className="flex-1 text-sm font-semibold">@{b.username}</span><Button variant="ghost" onClick={async () => { await api(`blocks/${b.id}`, { method: "DELETE" }); load(); }}>Desbloquear</Button></li>)}</ul>}
      </Card>
      <Card className="border-red-200">
        <h2 className="mb-1 font-bold text-red-700">Eliminar cuenta</h2>
        <p className="mb-3 text-sm text-black/65">Se eliminan tu perfil, foto, planes, solicitudes, favoritos y notificaciones. No se puede deshacer.</p>
        <form noValidate className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          if (del.confirm !== "ELIMINAR") { say("del", { tone: "error", text: "Escribe ELIMINAR para confirmar." }); return; }
          if (!window.confirm("Última confirmación: ¿eliminar tu cuenta definitivamente?")) return;
          setBusy("del"); const r = await api("account/delete", { body: del }); setBusy(null);
          if (r.ok) { router.push("/"); router.refresh(); } else say("del", { tone: "error", text: r.message });
        }}>
          <Field id="delpw" label="Contraseña"><Input id="delpw" type="password" autoComplete="current-password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></Field>
          <Field id="delc" label='Escribe "ELIMINAR"'><Input id="delc" value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value })} /></Field>
          <div className="sm:col-span-2 space-y-2">{msg.del && <Alert tone={msg.del.tone}>{msg.del.text}</Alert>}<Button type="submit" variant="danger" loading={busy === "del"}>Eliminar mi cuenta</Button></div>
        </form>
      </Card>
    </div>
  );
}

type VReq = { id: number; organizationName: string; status: string; reviewNote: string | null; createdAt: string };
type Stat = { id: string; title: string; status: string; kind: string; startsAt: string; capacity: number; acceptedCount: number; pending: number; rejected: number; favorites: number };

export function OrganizerPanel({ isVerified, organizerName, emailVerified, requests, stats }: { isVerified: boolean; organizerName: string | null; emailVerified: boolean; requests: VReq[]; stats: Stat[] }) {
  const router = useRouter();
  const [v, setV] = useState({ organizationName: "", description: "", evidenceUrl: "" });
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const pending = requests.some((r) => r.status === "pending");
  const totals = stats.reduce((a, s) => ({ acc: a.acc + s.acceptedCount, cap: a.cap + s.capacity, pend: a.pend + s.pending, fav: a.fav + s.favorites }), { acc: 0, cap: 0, pend: 0, fav: 0 });
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-2 font-bold">Estado de verificación</h2>
        {isVerified ? <p><Badge tone="teal">Organizador verificado</Badge> <span className="ml-2 font-semibold">{organizerName}</span></p> : pending ? <Badge tone="warn">Solicitud en revisión</Badge> : <Badge>No verificado</Badge>}
        {requests.length > 0 && <ul className="mt-3 space-y-1 text-sm">{requests.map((r) => <li key={r.id}>{fmtDate(r.createdAt)} · {r.organizationName} · <b>{({ pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada", revoked: "Revocada" } as Record<string, string>)[r.status]}</b>{r.reviewNote ? ` — ${r.reviewNote}` : ""}</li>)}</ul>}
      </Card>
      {!isVerified && !pending && (
        <Card>
          <h2 className="mb-1 font-bold">Solicitar verificación</h2>
          <p className="mb-3 text-sm text-black/60">Un administrador revisará tu solicitud. La verificación permite publicar eventos con insignia, que igualmente pasan por revisión.</p>
          {!emailVerified ? <Alert tone="warn">Primero verifica tu correo electrónico.</Alert> : (
            <form noValidate className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              const p = verificationRequestSchema.safeParse(v);
              if (!p.success) { setMsg({ tone: "error", text: Object.values(fieldErrors(p.error))[0] }); return; }
              setBusy(true); const r = await api("organizer/verification", { body: p.data }); setBusy(false);
              if (r.ok) { setMsg({ tone: "success", text: "Solicitud enviada." }); router.refresh(); } else setMsg({ tone: "error", text: r.message });
            }}>
              <Field id="org" label="Nombre de la organización o colectivo"><Input id="org" value={v.organizationName} onChange={(e) => setV({ ...v, organizationName: e.target.value })} /></Field>
              <Field id="desc" label="Descripción y tipo de actividades"><Textarea id="desc" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
              <Field id="ev" label="Enlace de soporte (https, opcional)" hint="Página web o red social oficial."><Input id="ev" value={v.evidenceUrl} onChange={(e) => setV({ ...v, evidenceUrl: e.target.value })} /></Field>
              {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
              <Button type="submit" loading={busy}>Enviar solicitud</Button>
            </form>
          )}
        </Card>
      )}
      <Card>
        <h2 className="mb-3 font-bold">Estadísticas de tus actividades</h2>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Actividades", stats.length], ["Participantes", totals.acc], ["Solicitudes pendientes", totals.pend], ["Guardados", totals.fav]].map(([l, n]) => <div key={l} className="rounded-xl bg-black/5 p-3"><p className="text-2xl font-extrabold">{n}</p><p className="text-xs text-black/60">{l}</p></div>)}
        </div>
        {stats.length === 0 ? <p className="text-sm text-black/60">Aún no tienes actividades.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Historial de publicaciones</caption><thead><tr className="text-black/50"><th className="py-2">Actividad</th><th>Estado</th><th>Ocupación</th><th>Pend.</th><th>Fav.</th></tr></thead>
            <tbody>{stats.map((s) => <tr key={s.id} className="border-t border-black/5"><td className="py-2"><a href={`/parches/${s.id}`} className="font-semibold">{s.title}</a> {s.kind === "verified" && <Badge tone="teal">Verificado</Badge>}</td><td>{STATUS_LABEL[s.status]}</td><td>{s.acceptedCount}/{s.capacity} ({Math.round((s.acceptedCount / s.capacity) * 100)}%)</td><td>{s.pending}</td><td>{s.favorites}</td></tr>)}</tbody></table></div>
        )}
      </Card>
    </div>
  );
}
