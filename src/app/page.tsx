import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPinned, ShieldCheck, Users } from "lucide-react";
import { PlanCard } from "@/components/plan-card";
import { EmptyState, linkBtn } from "@/components/ui";
import { listPublicPlans } from "@/server/plans";

export const dynamic = "force-dynamic";

export default async function Home() {
  let plans: Awaited<ReturnType<typeof listPublicPlans>>["items"] = [];
  try { plans = (await listPublicPlans({ pageSize: 6 })).items; } catch {}
  return (
    <>
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/20" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-white sm:py-28">
          <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur">📍 Manizales, Caldas</p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">Menos pantalla,<br /><span className="text-accent">más parche.</span></h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">Encuentra planes reales cerca de ti: basket en el Bosque Popular, café en El Cable, atardeceres en Chipre. Crea tu parche y conoce gente con tus mismos gustos.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className={linkBtn("primary") + " text-base"}>Explorar demo <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link href="/registro" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-base font-semibold text-ink hover:bg-white/90">Crear cuenta gratis</Link>
          </div>
          <p className="mt-3 text-sm text-white/70">La demo no pide correo ni contraseña y usa datos ficticios.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: <MapPinned className="h-6 w-6" />, t: "Descubre", d: "Planes en el mapa de Manizales, filtrados por fecha, categoría y cupos." },
            { icon: <Users className="h-6 w-6" />, t: "Únete o crea", d: "Solicita unirte o arma tu propio parche. Tú decides a quién aceptar." },
            { icon: <ShieldCheck className="h-6 w-6" />, t: "Con confianza", d: "Reportes, bloqueos, moderación y organizadores verificados por el equipo." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-3 inline-flex rounded-xl bg-accent/10 p-2.5 text-accent" aria-hidden>{f.icon}</div>
              <h2 className="text-lg font-bold">{f.t}</h2>
              <p className="mt-1 text-sm text-black/65">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <div><h2 className="text-2xl font-extrabold">Próximos parches</h2><p className="text-black/60">Planes publicados por la comunidad.</p></div>
          <Link href="/explorar" className="font-semibold text-accent-dark">Ver todos →</Link>
        </div>
        {plans.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{plans.map((p) => <PlanCard key={p.id} plan={p} href={`/parches/${p.id}`} />)}</div>
        ) : (
          <EmptyState title="Todavía no hay parches publicados">Sé la primera persona en <Link className="font-semibold text-accent-dark" href="/registro">crear uno</Link> o mira cómo se vería en la <Link className="font-semibold text-accent-dark" href="/demo">demo</Link>.</EmptyState>
        )}
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-teal p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><BadgeCheck className="mt-1 h-7 w-7 shrink-0" aria-hidden /><div><h2 className="text-xl font-bold">¿Organizas actividades?</h2><p className="text-white/85">Colectivos, clubes y entidades pueden solicitar verificación para publicar eventos con insignia.</p></div></div>
          <Link href="/info/como-funciona#organizadores" className="rounded-full bg-white px-5 py-2.5 font-semibold text-teal">Cómo verificarse</Link>
        </div>
      </section>
    </>
  );
}
