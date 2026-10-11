"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Flag, Heart, Pencil, Trash2, XCircle } from "lucide-react";
import { api } from "./api";
import { Alert, Avatar, Badge, Button, Select, STATUS_LABEL, Textarea } from "./ui";

type Participant = { id: string; status: string; message: string | null; user: { id: string; username: string; displayName: string; avatarUrl: string | null } };

export function ReportDialog({ targetType, targetId, label }: { targetType: "user" | "plan"; targetId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) return <Button variant="ghost" onClick={() => setOpen(true)}><Flag className="h-4 w-4" aria-hidden />{label}</Button>;
  return (
    <form className="w-full space-y-2 rounded-xl border border-black/10 p-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      const r = await api<{ message: string }>("reports", { body: { targetType, targetId, reason, details: details || undefined } });
      setBusy(false);
      setMsg(r.ok ? { tone: "success", text: r.data.message } : { tone: "error", text: r.message });
    }}>
      <label htmlFor={`reason-${targetId}`} className="text-sm font-semibold">Motivo del reporte</label>
      <Select id={`reason-${targetId}`} value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="spam">Spam</option><option value="acoso">Acoso</option><option value="contenido_inapropiado">Contenido inapropiado</option><option value="suplantacion">Suplantación</option><option value="riesgo_seguridad">Riesgo para la seguridad</option><option value="fraude">Fraude</option><option value="otro">Otro</option>
      </Select>
      <Textarea aria-label="Detalles" rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Detalles (opcional)" />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex gap-2"><Button type="submit" loading={busy} disabled={msg?.tone === "success"}>Enviar reporte</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cerrar</Button></div>
    </form>
  );
}

export function PlanActions({ planId, loggedIn, isOwner, participation, favorite, canJoin, joinBlockedReason, creatorId, creatorUsername, participants, status }: {
  planId: string; loggedIn: boolean; isOwner: boolean; participation: string | null; favorite: boolean; canJoin: boolean; joinBlockedReason: string; creatorId: string; creatorUsername: string; participants: Participant[] | null; status: string;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(favorite);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [message, setMessage] = useState("");

  async function run(key: string, fn: () => ReturnType<typeof api>, ok: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key); setMsg(null);
    const r = await fn();
    setBusy(null);
    if (r.ok) { setMsg({ tone: "success", text: ok }); router.refresh(); } else setMsg({ tone: "error", text: r.message });
    return r.ok;
  }

  if (!loggedIn) {
    return (
      <div className="space-y-3">
        <Link href={`/login?next=/parches/${planId}`} className="block rounded-full bg-accent px-5 py-3 text-center font-semibold text-white hover:bg-accent-dark">Inicia sesión para unirte</Link>
        <p className="text-center text-sm text-black/60">¿Sin cuenta? <Link href="/registro" className="font-semibold text-accent-dark">Regístrate</Link></p>
      </div>
    );
  }

  if (isOwner) {
    const active = status === "published" || status === "full" || status === "draft" || status === "pending_review";
    return (
      <div className="space-y-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="flex flex-wrap gap-2">
          {active && <Link href={`/app/parches/${planId}/editar`} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/5"><Pencil className="h-4 w-4" aria-hidden />Editar</Link>}
          {active && <Button variant="secondary" loading={busy === "cancel"} onClick={() => run("cancel", () => api(`plans/${planId}/cancel`, { method: "POST" }), "Plan cancelado. Avisamos a los participantes.", "¿Cancelar este plan? Se notificará a solicitantes y participantes.")}><XCircle className="h-4 w-4" aria-hidden />Cancelar plan</Button>}
          <Button variant="danger" loading={busy === "delete"} onClick={async () => { const ok = await run("delete", () => api(`plans/${planId}`, { method: "DELETE" }), "Plan eliminado.", "¿Eliminar definitivamente? Sólo es posible si no tiene solicitudes activas."); if (ok) router.push("/app/mis-parches"); }}><Trash2 className="h-4 w-4" aria-hidden />Eliminar</Button>
        </div>
        <ParticipantsManager participants={participants ?? []} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {participation === "pending" || participation === "accepted" ? (
        <div className="space-y-2">
          <p className="text-sm">Tu solicitud: <Badge tone={participation === "accepted" ? "teal" : "warn"}>{STATUS_LABEL[participation]}</Badge></p>
          <Button variant="secondary" className="w-full" loading={busy === "withdraw"} onClick={() => run("withdraw", () => api(`plans/${planId}/join`, { method: "DELETE" }), "Retiraste tu solicitud.", "¿Retirar tu solicitud o participación?")}>Retirar solicitud</Button>
        </div>
      ) : canJoin ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run("join", () => api(`plans/${planId}/join`, { body: { message: message || undefined } }), "¡Solicitud enviada! Te avisaremos cuando la revisen."); }}>
          <label htmlFor="join-msg" className="text-sm font-semibold">Mensaje para quien organiza (opcional)</label>
          <Textarea id="join-msg" rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Cuéntale por qué te interesa" />
          <Button type="submit" className="w-full py-3" loading={busy === "join"}>Solicitar unirme</Button>
        </form>
      ) : (
        <Alert tone="info">{participation === "rejected" || participation === "removed" ? "Tu participación no fue aceptada en este plan." : joinBlockedReason}</Alert>
      )}
      <Button variant="secondary" className="w-full" aria-pressed={fav} loading={busy === "fav"} onClick={async () => {
        const next = !fav; setFav(next); setBusy("fav"); // actualización optimista
        const r = await api(`favorites/${planId}`, { method: next ? "PUT" : "DELETE" });
        setBusy(null);
        if (!r.ok) { setFav(!next); setMsg({ tone: "error", text: `No se guardó el favorito: ${r.message}` }); } // reversión
      }}><Heart className={`h-4 w-4 ${fav ? "fill-accent text-accent" : ""}`} aria-hidden />{fav ? "Guardado en favoritos" : "Guardar en favoritos"}</Button>
      <div className="flex flex-wrap gap-1 border-t border-black/5 pt-3">
        <ReportDialog targetType="plan" targetId={planId} label="Reportar plan" />
        <ReportDialog targetType="user" targetId={creatorId} label={`Reportar a @${creatorUsername}`} />
        <Button variant="ghost" loading={busy === "block"} onClick={() => run("block", () => api("blocks", { body: { userId: creatorId } }), "Usuario bloqueado. No verás sus planes.", `¿Bloquear a @${creatorUsername}? No verás sus planes y no podrá aceptar tus solicitudes.`)}><Ban className="h-4 w-4" aria-hidden />Bloquear</Button>
      </div>
    </div>
  );
}

export function ParticipantsManager({ participants }: { participants: Participant[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const act = async (id: string, action: "accept" | "reject" | "remove") => {
    if (action === "remove" && !window.confirm("¿Retirar a esta persona del plan?")) return;
    setBusy(id + action); setErr(null);
    const r = await api(`participations/${id}`, { method: "PATCH", body: { action } });
    setBusy(null);
    if (!r.ok) setErr(r.message); else router.refresh();
  };
  const visible = participants.filter((p) => p.status === "pending" || p.status === "accepted");
  return (
    <div>
      <h3 className="mb-2 font-bold">Solicitudes y participantes</h3>
      {err && <Alert tone="error">{err}</Alert>}
      {visible.length === 0 ? <p className="text-sm text-black/60">Aún no hay solicitudes.</p> : (
        <ul className="divide-y divide-black/5">
          {visible.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <Avatar src={p.user.avatarUrl} name={p.user.displayName} size={36} />
              <div className="min-w-0 flex-1">
                <Link href={`/u/${p.user.username}`} className="font-semibold">{p.user.displayName}</Link> <span className="text-xs text-black/50">@{p.user.username}</span>
                {p.message && <p className="truncate text-xs text-black/60">“{p.message}”</p>}
              </div>
              <Badge tone={p.status === "accepted" ? "teal" : "warn"}>{STATUS_LABEL[p.status]}</Badge>
              {p.status === "pending" && <><Button loading={busy === p.id + "accept"} onClick={() => act(p.id, "accept")}>Aceptar</Button><Button variant="secondary" loading={busy === p.id + "reject"} onClick={() => act(p.id, "reject")}>Rechazar</Button></>}
              {p.status === "accepted" && <Button variant="ghost" loading={busy === p.id + "remove"} onClick={() => act(p.id, "remove")}>Retirar</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
