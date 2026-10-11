import { SettingsPanel } from "@/components/app-client";
import { Card, PageTitle } from "@/components/ui";
import { pageUser } from "@/server/core";

export const metadata = { title: "Configuración" };

export default async function Config() {
  const u = await pageUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Configuración" subtitle="Cuenta, seguridad y privacidad." />
      <Card><p className="text-sm"><b>Correo:</b> {u.email} · {u.emailVerifiedAt ? "verificado" : "sin verificar"}</p><p className="mt-1 text-xs text-black/55">El barrio, los intereses y la privacidad se editan en Mi perfil. Para corregir tu correo o fecha de nacimiento escribe al equipo (derecho de rectificación).</p></Card>
      <SettingsPanel emailVerified={!!u.emailVerifiedAt} />
    </div>
  );
}
