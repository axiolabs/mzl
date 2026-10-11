import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/auth-forms";
export const metadata = { title: "Recuperar contraseña" };
export default function Page() {
  return <AuthShell title="Recupera tu contraseña" subtitle="Te enviaremos un enlace temporal de un solo uso."><ForgotForm /></AuthShell>;
}
