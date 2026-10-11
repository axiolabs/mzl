import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Iniciar sesión" };

export default function Login() {
  return (
    <AuthShell title="Bienvenido de vuelta" subtitle="Inicia sesión para unirte a planes y crear los tuyos." showDemo>
      <Suspense><LoginForm /></Suspense>
      <p className="mt-4 text-center text-sm">¿No tienes cuenta? <Link href="/registro" className="font-semibold text-accent-dark">Regístrate</Link></p>
    </AuthShell>
  );
}
