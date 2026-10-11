import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    });
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  return pool;
}

let _db: NodePgDatabase | null = null;

function getDb(): NodePgDatabase {
  _db ??= drizzle(getPool());
  return _db;
}

/**
 * Conexión perezosa: no se crea el pool ni se exige DATABASE_URL al importar este módulo.
 * Así `next build` puede recolectar configuración/páginas (p. ej. /_not-found) sin la variable;
 * solo se requiere en tiempo de ejecución al ejecutar la primera consulta.
 */
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const target = getDb();
    const value = Reflect.get(target, prop);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
