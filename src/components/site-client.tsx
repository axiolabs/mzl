"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, LogOut, Menu, Moon, Sparkles, Sun, X } from "lucide-react";
import { api } from "./api";
import { Avatar } from "./ui";

const LOGO_SOURCES = ["/logo.png", "/images/logo.png"];

export function LogoBadge() {
  const [i, setI] = useState(0);
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-white shadow-sm" aria-hidden>
      {i < LOGO_SOURCES.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO_SOURCES[i]} alt="" className="h-full w-full object-cover" onError={() => setI((n) => n + 1)} />
      ) : (
        <Sparkles className="h-5 w-5" />
      )}
    </span>
  );
}

const subscribeTheme = (cb: () => void) => {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => o.disconnect();
};
const getTheme = () => document.documentElement.classList.contains("dark");
const getThemeServer = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, getTheme, getThemeServer);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("theme", next ? "dark" : "light");
        } catch {}
      }}
      className="rounded-full p-2 hover:bg-black/5"
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}

export function LogoutButton({ full }: { full?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await api("auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      disabled={busy}
      className={full ? "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold hover:bg-black/5" : "rounded-full p-2 hover:bg-black/5"}
      aria-label="Cerrar sesión"
    >
      <LogOut className="h-5 w-5" aria-hidden /> {full && "Cerrar sesión"}
    </button>
  );
}

export function UserMenu({ name, avatarSrc, isOrganizer, isAdmin }: { name: string; avatarSrc: string | null; isOrganizer: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), btn.current?.focus());
    const onClick = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);
  const item = "block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-black/5";
  return (
    <div ref={wrap} className="relative">
      <button ref={btn} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label="Menú de cuenta" className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-black/5">
        <Avatar src={avatarSrc} name={name} size={32} />
        <span className="text-sm font-semibold">{name}</span>
        <ChevronDown className={`h-4 w-4 text-black/50 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="fade-in absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-black/10 bg-white p-2 shadow-lg">
          <Link href="/app/perfil" role="menuitem" onClick={() => setOpen(false)} className={item}>Ver perfil</Link>
          <Link href="/app/mis-parches" role="menuitem" onClick={() => setOpen(false)} className={item}>Mis parches</Link>
          <Link href="/app/solicitudes" role="menuitem" onClick={() => setOpen(false)} className={item}>Mis solicitudes</Link>
          <Link href="/app/favoritos" role="menuitem" onClick={() => setOpen(false)} className={item}>Favoritos</Link>
          <Link href="/app/configuracion" role="menuitem" onClick={() => setOpen(false)} className={item}>Configuración</Link>
          <Link href="/app/organizador" role="menuitem" onClick={() => setOpen(false)} className={item}>{isOrganizer ? "Panel de organizador" : "Ser organizador"}</Link>
          {isAdmin && <Link href="/app/admin" role="menuitem" onClick={() => setOpen(false)} className={item}>Administración</Link>}
          <div className="my-1 border-t border-black/5" />
          <LogoutButton full />
        </div>
      )}
    </div>
  );
}

export function MobileMenu({ links, loggedIn }: { links: { href: string; label: string }[]; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), btn.current?.focus());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="md:hidden">
      <button ref={btn} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav" className="rounded-lg p-2 hover:bg-black/5" aria-label={open ? "Cerrar menú" : "Abrir menú"}>
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Menú móvil" className="fade-in absolute inset-x-0 top-16 max-h-[80vh] overflow-y-auto border-b border-black/10 bg-white p-3 shadow-lg">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 font-semibold hover:bg-black/5">{l.label}</Link></li>
            ))}
            {loggedIn && <li><LogoutButton full /></li>}
          </ul>
        </nav>
      )}
    </div>
  );
}
