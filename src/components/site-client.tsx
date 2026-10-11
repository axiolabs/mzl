"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LogOut, Menu, Moon, Sparkles, Sun, X } from "lucide-react";
import { api } from "./api";

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
