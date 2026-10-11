import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Avatar, Badge, STATUS_LABEL, VerifiedBadge, fmtDate } from "./ui";

export type CardPlan = {
  id: string;
  title: string;
  category: { name: string; slug?: string };
  kind: "community" | "verified";
  coverUrl: string | null;
  startsAt: string;
  locationName: string;
  capacity: number;
  acceptedCount: number;
  status: string;
  creator: { displayName: string; avatarUrl: string | null; organizerName: string | null; isVerifiedOrganizer: boolean };
};

const fallbackCover = (slug?: string) =>
  ({ deporte: "/images/cover-deporte.jpg", "cafe-comida": "/images/cover-cafe.jpg", naturaleza: "/images/cover-naturaleza.jpg", ambiente: "/images/cover-naturaleza.jpg", fotografia: "/images/cover-fotografia.jpg" })[slug ?? ""] ?? "/images/cover-cultura.jpg";

export function PlanCard({ plan, href, reasons }: { plan: CardPlan; href: string; reasons?: string[] }) {
  const spots = Math.max(0, plan.capacity - plan.acceptedCount);
  return (
    <article className="group fade-in overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={href} className="block focus-visible:outline-none">
        <div className="relative aspect-[16/9] overflow-hidden bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={plan.coverUrl || fallbackCover(plan.category.slug)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold">{plan.category.name}</span>
            {plan.kind === "verified" && <VerifiedBadge label="Evento verificado" />}
          </div>
          {plan.status !== "published" && <span className="absolute right-3 top-3 rounded-full bg-ink/85 px-2.5 py-0.5 text-xs font-bold text-white">{STATUS_LABEL[plan.status] ?? plan.status}</span>}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-snug group-hover:text-accent-dark">{plan.title}</h3>
          <p className="flex items-center gap-1.5 text-sm text-black/65"><CalendarDays className="h-4 w-4 shrink-0" aria-hidden />{fmtDate(plan.startsAt)}</p>
          <p className="flex items-center gap-1.5 text-sm text-black/65"><MapPin className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{plan.locationName}</span></p>
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-2 text-xs text-black/60">
              <Avatar src={plan.creator.avatarUrl} name={plan.creator.displayName} size={24} />
              {plan.creator.organizerName ?? plan.creator.displayName}
            </span>
            <Badge tone={spots === 0 ? "danger" : spots <= 2 ? "warn" : "teal"}><Users className="h-3 w-3" aria-hidden />{spots === 0 ? "Sin cupos" : `${spots} cupos`}</Badge>
          </div>
          {reasons && reasons.length > 0 && <p className="rounded-lg bg-sun/20 px-2 py-1 text-xs font-medium text-black/75">✨ {reasons.join(" · ")}</p>}
        </div>
      </Link>
    </article>
  );
}

export function PlanGridSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cargando planes" role="status">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="aspect-[16/9] animate-pulse bg-black/10" />
          <div className="space-y-2 p-4"><div className="h-4 w-3/4 animate-pulse rounded bg-black/10" /><div className="h-3 w-1/2 animate-pulse rounded bg-black/10" /></div>
        </div>
      ))}
    </div>
  );
}
