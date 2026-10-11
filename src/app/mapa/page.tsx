import { MapView } from "@/components/map-view";
import { PageTitle } from "@/components/ui";
import { getMeta } from "@/server/modules/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mapa de actividades" };

export default async function MapaPage() {
  const meta = await getMeta();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle title="Mapa de actividades" subtitle="Planes activos en Manizales. Los parches comunitarios muestran una ubicación aproximada hasta que te acepten." />
      <MapView mode="api" categories={meta.categories} places={meta.places} hrefBase="/parches/" />
    </div>
  );
}
