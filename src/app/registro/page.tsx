import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth-forms";
import { getSessionUser } from "@/server/core";
import { getMeta } from "@/server/modules/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crear cuenta" };

export default async function Registro() {
  if (await getSessionUser()) redirect("/app");
  const meta = await getMeta();
  return (
    <AuthShell title="Crea tu cuenta" subtitle="Únete a la comunidad de planes de Manizales." showDemo>
      <RegisterForm barrios={meta.barrios} />
      <p className="mt-4 text-center text-sm">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-accent-dark">Inicia sesión</Link></p>
    </AuthShell>
  );
}
