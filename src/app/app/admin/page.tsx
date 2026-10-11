import { notFound } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import { PageTitle } from "@/components/ui";
import { pageUser } from "@/server/core";

export const metadata = { title: "Administración", robots: { index: false } };

export default async function Admin() {
  const u = await pageUser();
  if (u.role !== "admin") notFound(); // no revela la existencia del panel; la API valida de nuevo cada petición
  return (
    <div>
      <PageTitle title="Administración" subtitle="Toda acción sensible exige justificación y queda en el historial de auditoría." />
      <AdminPanel />
    </div>
  );
}
