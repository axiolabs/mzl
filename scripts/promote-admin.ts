/**
 * Concede el rol de administrador a una cuenta existente. Requiere acceso directo a la BD (no hay endpoint público).
 * Uso: npx tsx scripts/promote-admin.ts correo@dominio.com
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { auditLogs, users } from "../src/db/schema";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) { console.error("Uso: npx tsx scripts/promote-admin.ts correo"); process.exit(1); }
(async () => {
  const [u] = await db.update(users).set({ role: "admin" }).where(eq(users.email, email)).returning({ id: users.id });
  if (!u) { console.error("No existe una cuenta con ese correo."); process.exit(1); }
  await db.insert(auditLogs).values({ actorId: null, action: "user.make_admin.cli", targetType: "user", targetId: u.id, note: "Promoción por CLI" });
  console.log("Rol de administrador concedido.");
  process.exit(0);
})();
