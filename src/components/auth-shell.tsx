import Link from "next/link";
import type { ReactNode } from "react";
import { Eye } from "lucide-react";

export function AuthShell({ title, subtitle, children, showDemo }: { title: string; subtitle?: string; children: ReactNode; showDemo?: boolean }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_380px]">
      <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-black/60">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {showDemo && (
        <aside className="flex flex-col justify-between rounded-3xl bg-ink p-6 text-white sm:p-8">
          <div>
            <p className="text-sm font-semibold text-sun">¿Sólo quieres mirar?</p>
            <h2 className="mt-2 text-2xl font-extrabold">Explora la demo sin crear cuenta</h2>
            <p className="mt-2 text-white/75">Sin correo, sin contraseña, sin datos personales. Datos ficticios y de solo lectura.</p>
          </div>
          <Link href="/demo" className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-dark"><Eye className="h-5 w-5" aria-hidden />Explorar demo</Link>
        </aside>
      )}
    </div>
  );
}
