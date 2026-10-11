import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { DemoPlanActions } from "@/components/demo-app";
import { Avatar, Badge, Card, VerifiedBadge, fmtDate } from "@/components/ui";
import { getDemoData } from "@/lib/demo-data";
import { demoPlanView } from "@/lib/demo-view";

export const dynamic = "force-dynamic";

export default async function DemoPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = getDemoData();
  const raw = d.plans.find((p) => p.id === id);
  if (!raw) notFound();
  const p = demoPlanView(raw, d.users, d.categories);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/demo" className="text-sm font-semibold text-accent-dark">← Volver a la demo</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.coverUrl} alt="" className="aspect-[16/8] w-full rounded-3xl object-cover" />
          <div className="flex gap-2"><Badge>{p.category.name}</Badge>{p.kind === "verified" ? <VerifiedBadge label="Evento verificado (ficticio)" /> : <Badge tone="accent">Parche comunitario</Badge>}<Badge tone="warn">Dato de demostración</Badge></div>
          <h1 className="text-3xl font-extrabold">{p.title}</h1>
          <p className="text-black/75">{p.description}</p>
          {p.requirements && <Card><b>Requisitos:</b> {p.requirements}</Card>}
        </div>
        <aside className="space-y-4">
          <Card className="space-y-2">
            <p className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-accent" aria-hidden />{fmtDate(p.startsAt)}</p>
            <p className="flex items-center gap-2"><MapPin className="h-5 w-5 text-accent" aria-hidden />{p.locationName}</p>
            <p className="flex items-center gap-2"><Users className="h-5 w-5 text-accent" aria-hidden />{p.acceptedCount}/{p.capacity}</p>
          </Card>
          <Card><div className="flex items-center gap-3"><Avatar src={null} name={p.creator.displayName} size={40} /><div><p className="font-bold">{p.creator.organizerName ?? p.creator.displayName}</p>{p.creator.isVerifiedOrganizer && <VerifiedBadge label="Verificado (ficticio)" />}</div></div></Card>
          <Card><DemoPlanActions title={p.title} /></Card>
        </aside>
      </div>
    </div>
  );
}
