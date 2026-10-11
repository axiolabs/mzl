/**
 * Pruebas de integración contra un servidor real (next start) + PostgreSQL.
 * Uso: TEST_BASE_URL=http://localhost:3100 npx vitest run tests/integration
 * Crea usuarios con correos @it.test y los elimina al final.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import sharp from "sharp";

const BASE = process.env.TEST_BASE_URL;
const run = BASE ? describe : describe.skip;
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db" });
const RUN = Date.now().toString(36);

class Client {
  cookie = "";
  constructor(public origin: string | null = BASE!) {}
  async req(method: string, path: string, body?: unknown, opts: { form?: FormData; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (this.cookie) headers.cookie = this.cookie;
    if (this.origin) headers.origin = this.origin;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(`${BASE}/api/v1/${path}`, { method, headers, body: opts.form ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect: "manual" });
    const sc = res.headers.get("set-cookie");
    if (sc) { const m = sc.match(/mzl_session=([^;]*)/); if (m) this.cookie = m[1] ? `mzl_session=${m[1]}` : ""; }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, headers: res.headers };
  }
}

async function barrioId() { return (await pool.query("select id from barrios where active limit 1")).rows[0].id as number; }
async function categoryId() { return (await pool.query("select id from categories where active limit 1")).rows[0].id as number; }

async function newUser(tag: string) {
  const c = new Client();
  const email = `${tag}-${RUN}@it.test`;
  const r = await c.req("POST", "auth/register", { firstName: "Prueba", lastName: "Integración", username: `${tag}_${RUN}`.slice(0, 30), email, password: "claveSegura123", birthDate: "1995-01-01", barrioId: await barrioId(), acceptTerms: true });
  expect(r.status).toBe(201);
  const id = (await pool.query("select id from users where email=$1", [email])).rows[0].id as string;
  return { c, email, id };
}

const planBody = async (extra: Record<string, unknown> = {}) => ({ title: "Plan de prueba", description: "Descripción del plan de prueba", categoryId: await categoryId(), startsAt: new Date(Date.now() + 48 * 3600_000).toISOString(), locationName: "Parque Caldas", lat: 5.0682, lng: -75.5105, capacity: 2, ...extra });

run("API de MZL Parchado", () => {
  let A: Awaited<ReturnType<typeof newUser>>, B: typeof A, C: typeof A, D: typeof A, ADM: typeof A;
  beforeAll(async () => {
    await pool.query("delete from rate_limits");
    A = await newUser("ana"); B = await newUser("beto"); C = await newUser("caro"); D = await newUser("dani"); ADM = await newUser("admin");
    await pool.query("update users set role='admin' where id=$1", [ADM.id]);
  });
  afterAll(async () => {
    await pool.query("delete from users where email like $1", [`%-${RUN}@it.test`]);
    await pool.query("delete from email_outbox where to_address like $1", [`%-${RUN}@it.test`]);
    await pool.end();
  });

  it("health OK", async () => { const r = await fetch(`${BASE}/api/health`); expect(r.status).toBe(200); });

  it("1. registro + sesión con cookie segura; registro no revela correos existentes", async () => {
    const me = await A.c.req("GET", "auth/me");
    expect(me.data.user.username).toBe(`ana_${RUN}`);
    expect(JSON.stringify(me.data)).not.toMatch(/password|hash/i);
    const dup = await new Client().req("POST", "auth/register", { firstName: "X", lastName: "Y", username: `otro_${RUN}`, email: A.email, password: "claveSegura123", birthDate: "1995-01-01", barrioId: await barrioId(), acceptTerms: true });
    expect(dup.status).toBe(201); // misma respuesta neutra
    const res = await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { origin: BASE!, "content-type": "application/json" }, body: JSON.stringify({ email: A.email, password: "claveSegura123" }) });
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toMatch(/HttpOnly/i); expect(sc).toMatch(/SameSite=lax/i); expect(sc).toMatch(/Path=\//);
    const https = await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { origin: BASE!, "content-type": "application/json", "x-forwarded-proto": "https" }, body: JSON.stringify({ email: A.email, password: "claveSegura123" }) });
    expect(https.headers.get("set-cookie")).toMatch(/Secure/);
  });

  it("rechaza inyección de rol en registro", async () => {
    const r = await new Client().req("POST", "auth/register", { firstName: "X", lastName: "Y", username: `rol_${RUN}`, email: `rol-${RUN}@it.test`, password: "claveSegura123", birthDate: "1995-01-01", barrioId: await barrioId(), acceptTerms: true, role: "admin" });
    expect(r.status).toBe(422);
  });

  it("login: error genérico y limitación de intentos", async () => {
    const c = new Client();
    const bad = await c.req("POST", "auth/login", { email: B.email, password: "incorrecta" });
    const ghost = await c.req("POST", "auth/login", { email: `nadie-${RUN}@it.test`, password: "incorrecta" });
    expect(bad.status).toBe(401); expect(ghost.status).toBe(401);
    expect(bad.data.error.message).toBe(ghost.data.error.message);
    let last = 0;
    for (let i = 0; i < 9; i++) last = (await c.req("POST", "auth/login", { email: `brute-${RUN}@it.test`, password: "x" })).status;
    expect(last).toBe(429);
  });

  it("2. logout invalida la sesión en el servidor", async () => {
    const { c } = await newUser("tmp");
    const stolen = c.cookie;
    await c.req("POST", "auth/logout");
    const reuse = new Client(); reuse.cookie = stolen;
    expect((await reuse.req("GET", "auth/me")).data.user).toBeNull();
  });

  it("3. recuperación de contraseña: neutra, un solo uso y revoca sesiones", async () => {
    const anon = new Client();
    const r1 = await anon.req("POST", "auth/forgot-password", { email: D.email });
    const r2 = await anon.req("POST", "auth/forgot-password", { email: `nadie-${RUN}@it.test` });
    expect(r1.data.message).toBe(r2.data.message);
    const mail = (await pool.query("select body from email_outbox where to_address=$1 and subject like 'Restablece%' order by id desc limit 1", [D.email])).rows[0];
    const token = mail.body.match(/token=([\w-]+)/)[1];
    expect((await anon.req("POST", "auth/reset-password", { token, password: "nuevaClave456" })).status).toBe(200);
    expect((await anon.req("POST", "auth/reset-password", { token, password: "otraClave789" })).status).toBe(400);
    expect((await D.c.req("GET", "auth/me")).data.user).toBeNull(); // sesión antigua revocada
    expect((await D.c.req("POST", "auth/login", { email: D.email, password: "nuevaClave456" })).status).toBe(200);
  });

  it("verificación de correo con token de un solo uso", async () => {
    const mail = (await pool.query("select body from email_outbox where to_address=$1 and subject like 'Verifica%' order by id desc limit 1", [A.email])).rows[0];
    const token = mail.body.match(/token=([\w-]+)/)[1];
    expect((await new Client().req("POST", "auth/verify-email", { token })).status).toBe(200);
    expect((await new Client().req("POST", "auth/verify-email", { token })).status).toBe(400);
  });

  it("CSRF: peticiones mutantes sin Origin válido son rechazadas", async () => {
    const evil = new Client("https://evil.example"); evil.cookie = A.c.cookie;
    expect((await evil.req("POST", "plans", await planBody())).status).toBe(403);
    const none = new Client(null); none.cookie = A.c.cookie;
    expect((await none.req("POST", "plans", await planBody())).status).toBe(403);
  });

  it("4-6. demo accesible sin credenciales, sin escritura ni datos privados", async () => {
    const page = await fetch(`${BASE}/demo`);
    expect(page.status).toBe(200);
    expect(page.headers.get("set-cookie") ?? "").not.toMatch(/mzl_session/);
    const html = await page.text();
    expect(html).toMatch(/Modo demo/);
    expect(html).not.toMatch(/@example\.test|@it\.test/);
    const anon = new Client();
    expect((await anon.req("POST", "plans", await planBody())).status).toBe(401);
    expect((await anon.req("PUT", "favorites/00000000-0000-0000-0000-000000000000")).status).toBe(401);
    expect((await anon.req("POST", "reports", { targetType: "plan", targetId: "00000000-0000-0000-0000-000000000000", reason: "spam" })).status).toBe(401);
    expect((await anon.req("GET", "profile")).status).toBe(401);
    expect((await anon.req("GET", "admin/users")).status).toBe(401);
    expect((await anon.req("GET", "notifications")).status).toBe(401);
  });

  let planId = "";
  it("8. crear, editar y cancelar parche; 12. comunitario vs verificado", async () => {
    const r = await A.c.req("POST", "plans", await planBody());
    expect(r.status).toBe(201); expect(r.data.plan.status).toBe("published");
    planId = r.data.plan.id;
    expect((await A.c.req("PATCH", `plans/${planId}`, { title: "Plan editado" })).status).toBe(200);
    expect((await A.c.req("GET", `plans/${planId}`)).data.plan.title).toBe("Plan editado");
    expect((await A.c.req("POST", "plans", await planBody({ kind: "verified" }))).status).toBe(403);
    expect((await A.c.req("POST", "plans", await planBody({ status: "published" }))).status).toBe(422);
  });

  it("9. no se pueden editar/cancelar/eliminar planes ajenos (IDOR)", async () => {
    expect((await B.c.req("PATCH", `plans/${planId}`, { title: "hack" })).status).toBe(403);
    expect((await B.c.req("POST", `plans/${planId}/cancel`)).status).toBe(403);
    expect((await B.c.req("DELETE", `plans/${planId}`)).status).toBe(403);
    expect((await B.c.req("GET", `plans/${planId}/participants`)).status).toBe(403);
  });

  it("15. restricciones geográficas en backend", async () => {
    expect((await A.c.req("POST", "plans", await planBody({ lat: 6.2442, lng: -75.5812 }))).status).toBe(422);
    expect((await A.c.req("PATCH", `plans/${planId}`, { lat: 4.711, lng: -74.07 })).status).toBe(422);
  });

  it("10-11. solicitudes y control de cupos con concurrencia", async () => {
    for (const u of [B, C, D]) expect((await u.c.req("POST", `plans/${planId}/join`, { message: "¡Me apunto!" })).status).toBe(201);
    expect((await B.c.req("POST", `plans/${planId}/join`, {})).status).toBe(409); // duplicada
    const parts = (await A.c.req("GET", `plans/${planId}/participants`)).data.items as { id: string; user: Record<string, unknown> }[];
    expect(parts.length).toBe(3);
    expect(JSON.stringify(parts)).not.toMatch(/@it\.test/); // sin correos
    // Otro usuario no puede decidir sobre solicitudes ajenas
    expect((await B.c.req("PATCH", `participations/${parts[0].id}`, { action: "accept" })).status).toBe(403);
    const results = await Promise.all(parts.map((p) => A.c.req("PATCH", `participations/${p.id}`, { action: "accept" })));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 200, 409]);
    const row = (await pool.query("select accepted_count, capacity, status from plans where id=$1", [planId])).rows[0];
    expect(row.accepted_count).toBe(2); expect(row.status).toBe("full");
    // Ubicación exacta sólo para aceptados
    const accepted = (await pool.query("select u.email from plan_participations pp join users u on u.id=pp.user_id where plan_id=$1 and pp.status='accepted'", [planId])).rows.map((r) => r.email);
    const acc = [B, C, D].find((u) => accepted.includes(u.email))!;
    expect((await acc.c.req("GET", `plans/${planId}`)).data.plan.approximateLocation).toBe(false);
    expect((await new Client().req("GET", `plans/${planId}`)).data.plan.approximateLocation).toBe(true);
    // Retirarse libera cupo
    expect((await acc.c.req("DELETE", `plans/${planId}/join`)).status).toBe(200);
    expect((await pool.query("select accepted_count, status from plans where id=$1", [planId])).rows[0]).toEqual({ accepted_count: 1, status: "published" });
    expect((await A.c.req("PATCH", `plans/${planId}`, { capacity: 2 })).status).toBe(200);
  });

  it("eliminar con participantes exige cancelar; cancelar notifica", async () => {
    expect((await A.c.req("DELETE", `plans/${planId}`)).status).toBe(409);
    expect((await A.c.req("POST", `plans/${planId}/cancel`)).status).toBe(200);
    const n = (await B.c.req("GET", "notifications")).data.items as { type: string }[];
    expect(n.some((x) => x.type === "plan_cancelled" || x.type === "request_rejected" || x.type === "request_accepted")).toBe(true);
  });

  it("13-14. verificación exclusiva de administradores y rutas admin protegidas", async () => {
    expect((await A.c.req("GET", "admin/stats")).status).toBe(403);
    expect((await A.c.req("POST", "organizer/verification", { organizationName: "Colectivo Prueba", description: "Organizamos talleres culturales comunitarios." })).status).toBe(201);
    const vid = (await pool.query("select id from organizer_verifications where user_id=$1", [A.id])).rows[0].id;
    expect((await A.c.req("PATCH", `admin/verifications/${vid}`, { decision: "approve" })).status).toBe(403);
    expect((await B.c.req("PATCH", `admin/users/${A.id}`, { action: "make_admin", note: "intento" })).status).toBe(403);
    expect((await ADM.c.req("PATCH", `admin/verifications/${vid}`, { decision: "approve", note: "Soporte revisado" })).status).toBe(200);
    const audit = (await pool.query("select actor_id, before, after, note from audit_logs where target_id=$1 and action='verification.approve'", [String(vid)])).rows[0];
    expect(audit.actor_id).toBe(ADM.id); expect(audit.before.status).toBe("pending"); expect(audit.after.status).toBe("approved");
    const ver = await A.c.req("POST", "plans", await planBody({ kind: "verified", capacity: 10 }));
    expect(ver.status).toBe(201); expect(ver.data.plan.status).toBe("pending_review");
    expect((await ADM.c.req("PATCH", `admin/plans/${ver.data.plan.id}`, { action: "approve" })).status).toBe(200);
    // Revocación: permisos efectivos
    expect((await ADM.c.req("PATCH", `admin/users/${A.id}`, { action: "revoke_verification", note: "Prueba de revocación" })).status).toBe(200);
    expect((await A.c.req("POST", "plans", await planBody({ kind: "verified" }))).status).toBe(403);
    expect((await pool.query("select status from plans where id=$1", [ver.data.plan.id])).rows[0].status).toBe("pending_review");
    expect((await ADM.c.req("PATCH", `admin/users/${ADM.id}`, { action: "suspend", note: "auto" })).status).toBe(403);
    expect((await A.c.req("GET", "admin/audit")).status).toBe(403);
  });

  it("suspensión revoca sesiones y bloquea login; apelación", async () => {
    expect((await ADM.c.req("PATCH", `admin/users/${C.id}`, { action: "suspend", note: "Prueba" })).status).toBe(200);
    expect((await C.c.req("GET", "auth/me")).data.user).toBeNull();
    const l = await new Client().req("POST", "auth/login", { email: C.email, password: "claveSegura123", appealMessage: "Creo que fue un error, por favor revisen." });
    expect(l.status).toBe(403);
    expect((await pool.query("select count(*)::int n from appeals where user_id=$1", [C.id])).rows[0].n).toBe(1);
  });

  it("7. subida, validación y eliminación de fotografía", async () => {
    const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#ff5a3c" } }).png().toBuffer();
    const fd = new FormData(); fd.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "foto.png");
    const up = await B.c.req("POST", "profile/avatar", undefined, { form: fd });
    expect(up.status).toBe(201);
    const img = await fetch(`${BASE}${up.data.avatarUrl}?s=128`);
    expect(img.status).toBe(200); expect(img.headers.get("content-type")).toBe("image/webp");
    const fake = new FormData(); fake.append("file", new Blob(["<script>alert(1)</script>".repeat(10)], { type: "image/png" }), "x.png");
    expect((await B.c.req("POST", "profile/avatar", undefined, { form: fake })).status).toBe(415);
    const tiny = new FormData(); tiny.append("file", new Blob([new Uint8Array(await sharp({ create: { width: 50, height: 50, channels: 3, background: "#000" } }).png().toBuffer())], { type: "image/png" }), "t.png");
    expect((await B.c.req("POST", "profile/avatar", undefined, { form: tiny })).status).toBe(422);
    expect((await new Client().req("POST", "profile/avatar", undefined, { form: fd })).status).toBe(401);
    expect((await B.c.req("DELETE", "profile/avatar")).status).toBe(200);
    expect((await fetch(`${BASE}${up.data.avatarUrl}`)).status).toBe(404);
  });

  it("24. reportes y bloqueos", async () => {
    const p = await B.c.req("POST", "plans", await planBody({ capacity: 5 }));
    expect((await A.c.req("POST", "reports", { targetType: "plan", targetId: p.data.plan.id, reason: "spam", details: "Prueba" })).status).toBe(201);
    expect((await A.c.req("POST", "reports", { targetType: "user", targetId: A.id, reason: "spam" })).status).toBe(422);
    expect((await B.c.req("POST", "blocks", { userId: A.id })).status).toBe(200);
    expect((await A.c.req("POST", `plans/${p.data.plan.id}/join`, {})).status).toBe(403);
    const list = await A.c.req("GET", "plans?pageSize=200");
    expect((list.data.items as { id: string }[]).some((x) => x.id === p.data.plan.id)).toBe(false);
    const rep = (await ADM.c.req("GET", "admin/reports")).data.items as { id: number }[];
    expect(rep.length).toBeGreaterThan(0);
    expect((await ADM.c.req("PATCH", `admin/reports/${rep[0].id}`, { status: "resolved", resolution: "Revisado" })).status).toBe(200);
  });

  it("19. mapa: consulta por bbox acotada", async () => {
    const r = await new Client().req("GET", "plans?bbox=5.0,-75.6,5.1,-75.4&pageSize=200");
    expect(r.status).toBe(200);
    for (const p of r.data.items as { lat: number; lng: number }[]) { expect(p.lat).toBeGreaterThanOrEqual(5.0); expect(p.lat).toBeLessThanOrEqual(5.1); }
    expect((await new Client().req("GET", "plans?bbox=6,-76,7,-75")).data.items).toEqual([]);
    expect((await new Client().req("GET", "plans?bbox=abc")).status).toBe(400);
  });

  it("errores consistentes y sin filtraciones", async () => {
    const r = await new Client().req("GET", "no-existe");
    expect(r.status).toBe(404); expect(r.data.error.code).toBe("not_found");
    const big = await A.c.req("POST", "reports", { targetType: "plan", targetId: planId, reason: "otro", details: "x".repeat(40000) });
    expect(big.status).toBe(413);
    const h = await fetch(`${BASE}/`);
    expect(h.headers.get("x-frame-options")).toBe("DENY");
    expect(h.headers.get("content-security-policy")).toMatch(/frame-ancestors 'none'/);
    expect(h.headers.get("x-powered-by")).toBeNull();
  });

  it("eliminación de cuenta", async () => {
    expect((await D.c.req("POST", "account/delete", { password: "nuevaClave456", confirm: "ELIMINAR" })).status).toBe(200);
    expect((await pool.query("select count(*)::int n from users where id=$1", [D.id])).rows[0].n).toBe(0);
  });
});
