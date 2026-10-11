/** Seed de referencia (categorías, barrios, lugares). Uso: npx tsx scripts/seed.ts */
import "dotenv/config";
import { ensureReferenceData } from "../src/server/seed";
ensureReferenceData().then(() => { console.log("Datos de referencia aplicados (idempotente)."); process.exit(0); }).catch((e) => { console.error(e.message); process.exit(1); });
