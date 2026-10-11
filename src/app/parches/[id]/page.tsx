import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CalendarDays, Info, MapPin, Users } from "lucide-react";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import { PlanActions } from "@/components/plan-actions";
import { Avatar, Badge, Card, STATUS_LABEL, VerifiedBadge, fmtDate } from "@/components/ui";
import { canRequestToJoin, isPlanPubliclyVisible } from "@/lib/permissions";
import { getSessionUser, toActor } from "@/server/core";
import { getPlanRow, getViewerParticipation, listParticipants, toPlanDTO } from "@/server/plans";

export const dynamic = "force-dynamic";

export default async function PlanDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getPlanRow(id);
  const viewer = await getSessionUser();
  if (!row) notFound();
  const isOwner = viewer?.id === row.p.creatorId;
  const isAdmin = viewer?.role === "admin";
  if (!isOwner && !isAdmin && (!isPlanPubliclyVisible(row.p, { direct: true }) || row.u.status !== "active")) notFound();
  const part = viewer ? await getViewerParticipation(row.p.id, viewer.id) : null;
  const accepted = part?.status === "accepted";
  const plan = toPlanDTO(row, { exact: isOwner || accepted || isAdmin });
  const fav = viewer ? (await db.select().from(favorites).where(and(eq(favorites.userId, viewer.id), eq(favorites.planId, plan.id)))).length > 0 : false;
  const participants = isOwner ? await listParticipants(plan.id, "owner") : accepted ? await listParticipants(plan.id, "accepted") : null;
  const join = viewer ? canRequestToJoin(toActor(viewer), row.p) : { ok: false, reason: "" };
  const cover = plan.coverUrl || "/images/cover-cultura.jpg";
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Ruta" className="mb-4 text-sm text-black/60"><Link href="/explorar">Explorar</Link> / <span>{plan.category.name}</span></nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="aspect-[16/8] w-full rounded-3xl object-cover shadow-sm" />
          <div className="flex flex-wrap gap-2">
            <Badge>{plan.category.name}</Badge>
            {plan.kind === "verified" ? <VerifiedBadge label="Evento verificado" /> : <Badge tone="accent">Parche comunitario</Badge>}
            {plan.status !== "published" && <Badge tone={plan.status === "cancelled" ? "danger" : "warn"}>{STATUS_LABEL[plan.status]}</Badge>}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{plan.title}</h1>
          <p className="whitespace-pre-line text-black/75">{plan.description}</p>
          {plan.requirements && <Card><h2 className="mb-1 font-bold">Requisitos</h2><p className="text-sm text-black/70">{plan.requirements}</p></Card>}
          {participants && !isOwner && (
            <Card><h2 className="mb-2 font-bold">Quiénes van ({participants.length})</h2><ul className="flex flex-wrap gap-3">{participants.map((p) => <li key={p.id} className="flex items-center gap-2 text-sm"><Avatar src={p.user.avatarUrl} name={p.user.displayName} size={28} />{p.user.displayName}</li>)}</ul></Card>
          )}
          <Card className="bg-sky-50/60">
            <p className="flex gap-2 text-sm text-black/70"><Info className="h-4 w-4 shrink-0" aria-hidden />Antes de ser aceptado ves la ubicación aproximada y el número de cupos. Al ser aceptado ves el punto exacto y a los demás participantes. Nunca se comparten correos ni teléfonos. <Link className="font-semibold underline" href="/info/seguridad">Consejos para encuentros seguros</Link></p>
          </Card>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-3">
            <p className="flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5 text-accent" aria-hidden />{fmtDate(plan.startsAt)}{plan.endsAt ? ` – ${fmtDate(plan.endsAt)}` : ""}</p>
            <p className="flex items-center gap-2"><MapPin className="h-5 w-5 text-accent" aria-hidden />{plan.locationName}{plan.approximateLocation && <span className="text-xs text-black/50">(aprox.)</span>}</p>
            <p className="flex items-center gap-2"><Users className="h-5 w-5 text-accent" aria-hidden />{plan.acceptedCount}/{plan.capacity} · {plan.spotsLeft} cupos libres</p>
            <div className="h-2 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={plan.acceptedCount} aria-valuemin={0} aria-valuemax={plan.capacity} aria-label="Cupos ocupados"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (plan.acceptedCount / plan.capacity) * 100)}%` }} /></div>
            <a className="block text-sm font-semibold text-teal" href={`https://www.openstreetmap.org/?mlat=${plan.lat}&mlon=${plan.lng}#map=17/${plan.lat}/${plan.lng}`} target="_blank" rel="noopener noreferrer">Ver en OpenStreetMap ↗</a>
          </Card>
          <Card>
            <p className="mb-2 text-xs font-bold uppercase text-black/50">Organiza</p>
            <Link href={`/u/${plan.creator.username}`} className="flex items-center gap-3">
              <Avatar src={plan.creator.avatarUrl} name={plan.creator.displayName} size={44} />
              <div><p className="font-bold">{plan.creator.organizerName ?? plan.creator.displayName}</p>{plan.creator.isVerifiedOrganizer && <VerifiedBadge label="Organizador verificado" />}</div>
            </Link>
          </Card>
          <Card>
            <PlanActions planId={plan.id} loggedIn={!!viewer} isOwner={isOwner} participation={part?.status ?? null} favorite={fav} canJoin={join.ok} joinBlockedReason={join.reason} creatorId={plan.creator.id} creatorUsername={plan.creator.username} participants={participants} status={row.p.status} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
