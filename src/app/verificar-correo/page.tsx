import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { VerifyEmail } from "@/components/auth-forms";
export const metadata = { title: "Verificar correo" };
export default function Page() {
  return <AuthShell title="Verificación de correo"><Suspense><VerifyEmail /></Suspense></AuthShell>;
}
