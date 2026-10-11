import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/auth-forms";
export const metadata = { title: "Restablecer contraseña" };
export default function Page() {
  return <AuthShell title="Nueva contraseña"><Suspense><ResetForm /></Suspense></AuthShell>;
}
