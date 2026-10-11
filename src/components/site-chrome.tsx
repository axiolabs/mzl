import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Bell, Compass, Map, PlusCircle } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSessionUser } from "@/server/core";
import { avatarUrl } from "@/server/serializers";
import { Avatar } from "./ui";
import { LogoBadge, MobileMenu, LogoutButton, ThemeToggle } from "./site-client";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight" aria-label="MZL Parchado, inicio">
      <LogoBadge />
      <span className="text-lg leading-none">MZL <span className="text-accent">Parchado</span></span>
    </Link>
  );
}

export async function SiteHeader() {
  let user = null;
  let unread = 0;
  try {
    user = await getSessionUser();
    if (user) {
      const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
      unread = r?.n ?? 0;
    }
  } catch {}
  const links = user
    ? [
        { href: "/app", label: "Inicio" },
        { href: "/explorar", label: "Explorar" },
        { href: "/mapa", label: "Mapa" },
        { href: "/app/crear", label: "Crear parche" },
        { href: "/app/mis-parches", label: "Mis parches" },
        { href: "/app/solicitudes", label: "Mis solicitudes" },
        { href: "/app/favoritos", label: "Favoritos" },
        { href: "/app/notificaciones", label: `Notificaciones${unread ? ` (${unread})` : ""}` },
        { href: "/app/perfil", label: "Mi perfil" },
        { href: "/app/configuracion", label: "Configuración" },
        { href: "/app/organizador", label: user.isVerifiedOrganizer ? "Panel de organizador" : "Ser organizador" },
        ...(user.role === "admin" ? [{ href: "/app/admin", label: "Administración" }] : []),
        { href: "/info/seguridad", label: "Ayuda y seguridad" },
      ]
    : [
        { href: "/info/como-funciona", label: "Cómo funciona" },
        { href: "/demo", label: "Explorar demo" },
        { href: "/login", label: "Iniciar sesión" },
        { href: "/registro", label: "Crear cuenta" },
      ];
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <div className="flex items-center gap-1">
          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            {user ? (
              <>
                <Link href="/explorar" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5"><Compass className="h-4 w-4" aria-hidden />Explorar</Link>
                <Link href="/mapa" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5"><Map className="h-4 w-4" aria-hidden />Mapa</Link>
                <Link href="/app/crear" className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"><PlusCircle className="h-4 w-4" aria-hidden />Crear</Link>
                <Link href="/app/notificaciones" className="relative rounded-full p-2 hover:bg-black/5" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}>
                  <Bell className="h-5 w-5" aria-hidden />
                  {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />}
                </Link>
                <Link href="/app/mis-parches" className="hidden lg:flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5">Mis parches</Link>
                <Link href="/app/solicitudes" className="hidden xl:flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5">Mis solicitudes</Link>
                <Link href="/app/favoritos" className="hidden xl:flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5">Favoritos</Link>
                <Link href="/app/configuracion" className="hidden lg:flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5">Configuración</Link>
                <Link href="/app/perfil" className="hidden lg:flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5">Mi perfil</Link>
                <Link href="/app" className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-black/5">
                  <Avatar src={avatarUrl(user.avatarMediaId)} name={user.firstName} size={32} />
                  <span className="text-sm font-semibold">{user.firstName}</span>
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/info/como-funciona" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5">Cómo funciona</Link>
                <Link href="/demo" className="rounded-full px-3 py-2 text-sm font-semibold text-teal hover:bg-teal/10">Explorar demo</Link>
                <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5">Entrar</Link>
                <Link href="/registro" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black">Crear cuenta</Link>
              </>
            )}
          </nav>
          <ThemeToggle />
          <MobileMenu links={links} loggedIn={!!user} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/5 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-black/60">Menos pantalla, más parche. Planes presenciales en Manizales, Caldas.</p>
        </div>
        <nav aria-label="Plataforma" className="text-sm">
          <h2 className="mb-2 font-bold">Plataforma</h2>
          <ul className="space-y-1.5 text-black/70">
            <li><Link href="/info/acerca">Sobre MZL Parchado</Link></li>
            <li><Link href="/info/como-funciona">Cómo funciona</Link></li>
            <li><Link href="/info/seguridad">Seguridad y convivencia</Link></li>
            <li><Link href="/info/faq">Preguntas frecuentes</Link></li>
          </ul>
        </nav>
        <nav aria-label="Legal" className="text-sm">
          <h2 className="mb-2 font-bold">Legal</h2>
          <ul className="space-y-1.5 text-black/70">
            <li><Link href="/info/terminos">Términos de uso</Link></li>
            <li><Link href="/info/privacidad">Política de privacidad</Link></li>
            <li><Link href="/info/cookies">Política de cookies</Link></li>
          </ul>
        </nav>
      </div>
      <p className="pb-6 text-center text-xs text-black/45">© {new Date().getFullYear()} MZL Parchado · Proyecto independiente, no afiliado a la Alcaldía de Manizales.</p>
    </footer>
  );
}
