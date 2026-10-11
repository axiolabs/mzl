import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/server/core";

export const dynamic = "force-dynamic";

/** Layout protegido: toda ruta /app exige sesión real (los endpoints validan de nuevo en el servidor). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/app");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {!u.emailVerifiedAt && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
          Tu correo aún no está verificado. Revisa tu bandeja o reenvía el enlace desde <a className="font-semibold underline" href="/app/configuracion">Configuración</a>.
        </p>
      )}
      {children}
    </div>
  );
}
