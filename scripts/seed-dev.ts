/**
 * Seed de DESARROLLO determinista: crea usuarios y planes ficticios (@example.test) en la BD local.
 * - Se niega a ejecutarse si NODE_ENV=production o APP_ENV=production.
 * - Las contraseñas son aleatorias y NO se imprimen: estas cuentas no permiten iniciar sesión (sin credenciales compartidas).
 * - Fechas relativas al momento de ejecución. Re-ejecutable: no duplica (claves únicas).
 * Uso: npx tsx scripts/seed-dev.ts
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { eq, like } from "drizzle-orm";
import { db } from "../src/db";
import { categories, planParticipations, plans, places, userPreferences, users, barrios } from "../src/db/schema";
import { ensureReferenceData } from "../src/server/seed";

if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
  console.error("seed-dev bloqueado en producción.");
  process.exit(1);
}

const PEOPLE = [
  ["laura.dev", "Laura", "Gómez", ["fotografia", "cafe-comida"]],
  ["andres.dev", "Andrés", "Ríos", ["deporte", "juegos"]],
  ["camila.dev", "Camila", "Ospina", ["naturaleza", "ambiente"]],
  ["julian.dev", "Julián", "Henao", ["musica", "cultura"]],
  ["sofia.dev", "Sofía", "Marín", ["estudio", "emprendimiento"]],
  ["colectivo.dev", "Colectivo", "Ficticio", ["cultura"]],
] as const;

const PLAN_DEFS = [
  ["laura.dev", "Fotos al atardecer en Chipre", "fotografia", "Torre de Chipre", 1, 17, 8],
  ["andres.dev", "Baloncesto 3x3 en el Bosque Popular", "deporte", "Bosque Popular", 2, 9, 10],
  ["camila.dev", "Caminata por Los Yarumos", "naturaleza", "Ecoparque Los Yarumos", 3, 8, 12],
  ["julian.dev", "Jam acústica en la Santander", "musica", "Avenida Santander", 4, 19, 6],
  ["sofia.dev", "Coworking y café en El Cable", "emprendimiento", "Torre de Herveo", 2, 15, 6],
  ["andres.dev", "Torneo de juegos de mesa", "juegos", "Parque Antonio", 5, 16, 8],
  ["camila.dev", "Limpieza del Alcázares-Arenillo", "ambiente", "Ecoparque Alcázares", 6, 8, 20],
  ["laura.dev", "Café de origen en el centro", "cafe-comida", "Plaza de Bolívar", 1, 10, 5],
  ["colectivo.dev", "[DEV] Taller de grabado (evento verificado ficticio)", "cultura", "Teatro Los Fundadores", 7, 15, 25],
] as const;

async function main() {
  await ensureReferenceData();
  const cats = await db.select().from(categories);
  const pls = await db.select().from(places);
  const [centro] = await db.select().from(barrios).where(eq(barrios.name, "Centro"));
  const ids: Record<string, string> = {};
  for (const [username, first, last] of PEOPLE) {
    const pw = await hash(randomBytes(24).toString("hex"));
    await db
      .insert(users)
      .values({ email: `${username}@example.test`, username: username.replace(".", "_"), firstName: first, lastName: last, passwordHash: pw, birthDate: "1998-05-10", barrioId: centro?.id, termsAcceptedAt: new Date(), emailVerifiedAt: new Date(), isVerifiedOrganizer: username === "colectivo.dev", organizerName: username === "colectivo.dev" ? "Colectivo Ficticio (desarrollo)" : null, bio: "Perfil ficticio de desarrollo." })
      .onConflictDoNothing();
    const [u] = await db.select().from(users).where(eq(users.email, `${username}@example.test`));
    ids[username] = u.id;
    await db.insert(userPreferences).values({ userId: u.id }).onConflictDoNothing();
  }
  const existing = await db.select({ id: plans.id }).from(plans).innerJoin(users, eq(users.id, plans.creatorId)).where(like(users.email, "%@example.test"));
  if (existing.length === 0) {
    for (const [creator, title, cat, placeName, days, hour, cap] of PLAN_DEFS) {
      const pl = pls.find((p) => p.name.startsWith(placeName))!;
      const d = new Date();
      d.setDate(d.getDate() + days);
      d.setHours(hour, 0, 0, 0);
      const [p] = await db
        .insert(plans)
        .values({ title, description: `Plan ficticio de desarrollo: ${title}. Ven con buena energía y respeta las normas de convivencia.`, categoryId: cats.find((c) => c.slug === cat)!.id, kind: creator === "colectivo.dev" ? "verified" : "community", coverUrl: `/images/cover-${["deporte", "naturaleza", "cultura", "cafe-comida", "fotografia"].includes(cat) ? (cat === "cafe-comida" ? "cafe" : cat) : "cultura"}.jpg`, startsAt: d, placeId: pl.id, locationName: pl.name, lat: pl.lat, lng: pl.lng, capacity: cap, creatorId: ids[creator], status: "published" })
        .returning();
      const others = Object.entries(ids).filter(([k]) => k !== creator).slice(0, 2);
      for (const [, uid] of others) {
        await db.insert(planParticipations).values({ planId: p.id, userId: uid, status: "accepted" }).onConflictDoNothing();
      }
      await db.update(plans).set({ acceptedCount: others.length }).where(eq(plans.id, p.id));
    }
  }
  console.log("Seed de desarrollo aplicado.");
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
