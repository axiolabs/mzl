import { eq } from "drizzle-orm";
import { db } from "@/db";
import { barrios, categories, places } from "@/db/schema";
import { BARRIO_SEED, CATEGORY_SEED, PLACE_SEED } from "@/lib/reference-data";

/** Seed de referencia NO destructivo e idempotente: sólo inserta lo que falta, nunca borra ni sobrescribe. */
export async function ensureReferenceData() {
  await db.insert(categories).values(CATEGORY_SEED.map((c) => ({ ...c }))).onConflictDoNothing();
  await db.insert(barrios).values(BARRIO_SEED.map((b) => ({ ...b }))).onConflictDoNothing();
  const bs = await db.select().from(barrios);
  await db
    .insert(places)
    .values(PLACE_SEED.map((p) => ({ name: p.name, description: p.description, lat: p.lat, lng: p.lng, barrioId: bs.find((b) => b.name === p.barrio)?.id ?? null })))
    .onConflictDoNothing();
  void eq;
}
