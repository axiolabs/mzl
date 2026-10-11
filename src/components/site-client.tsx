"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { api } from "./api";

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
