export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.error("[config] Falta DATABASE_URL");
    return;
  }
  try {
    const { ensureReferenceData } = await import("./server/seed");
    await ensureReferenceData(); // idempotente y no destructivo
  } catch (e) {
    console.warn("[seed] datos de referencia no aplicados:", e instanceof Error ? e.message : e);
  }
}
