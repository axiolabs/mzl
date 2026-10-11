import { DemoApp } from "@/components/demo-app";
import { getDemoData } from "@/lib/demo-data";
import { demoPlanView } from "@/lib/demo-view";

export const dynamic = "force-dynamic"; // fechas relativas al momento de la visita

/** Demo pública: no consulta la base de datos ni crea sesión. */
export default function DemoPage() {
  const d = getDemoData();
  return <DemoApp data={{ plans: d.plans.map((p) => demoPlanView(p, d.users, d.categories)), users: d.users, notifications: d.notifications, categories: d.categories, places: d.places }} />;
}
