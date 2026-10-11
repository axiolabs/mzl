import { describe, expect, it } from "vitest";
import { clampBbox, clusterPoints, DEFAULT_BOUNDS, isWithinBounds, parseBounds } from "@/lib/geo";
import { detectImageType, validateDimensions } from "@/lib/image";
import { canCreateVerifiedPlan, canManagePlan, canRequestToJoin, canReviewVerification, effectiveStatus, isAdmin, type Actor } from "@/lib/permissions";
import { recommend } from "@/lib/recommend";
import { ageFrom, checkPlanDates, planCreateSchema, registerSchema } from "@/lib/validation";
import { getDemoData } from "@/lib/demo-data";

const user: Actor = { id: "u1", role: "user", status: "active", isVerifiedOrganizer: false };
const admin: Actor = { id: "a1", role: "admin", status: "active", isVerifiedOrganizer: false };
const future = (h: number) => new Date(Date.now() + h * 3600_000);

describe("geo (restricciones geográficas)", () => {
  it("acepta Manizales y rechaza otras ciudades", () => {
    expect(isWithinBounds(5.0689, -75.5174)).toBe(true);
    expect(isWithinBounds(6.2442, -75.5812)).toBe(false); // Medellín
    expect(isWithinBounds(4.711, -74.0721)).toBe(false); // Bogotá
    expect(isWithinBounds(NaN, -75.5)).toBe(false);
  });
  it("GEO_BOUNDS configurable y robusto ante valores inválidos", () => {
    expect(parseBounds("1,2,3,4")).toEqual({ minLat: 1, minLng: 2, maxLat: 3, maxLng: 4 });
    expect(parseBounds("x,y")).toEqual(DEFAULT_BOUNDS);
    expect(parseBounds("5,5,1,1")).toEqual(DEFAULT_BOUNDS);
  });
  it("recorta bbox al área permitida", () => {
    expect(clampBbox({ minLat: 0, minLng: -80, maxLat: 10, maxLng: -70 })).toEqual(DEFAULT_BOUNDS);
    expect(clampBbox({ minLat: 6, minLng: -76, maxLat: 7, maxLng: -75 })).toBeNull();
  });
  it("agrupa marcadores cercanos según zoom", () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ lat: 5.06 + i * 0.0001, lng: -75.5, item: i }));
    expect(clusterPoints(pts, 12).length).toBe(1);
    expect(clusterPoints(pts, 16).length).toBe(20);
  });
});

describe("imágenes", () => {
  it("detecta tipo real por firma", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>aaaa"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a........"))).toBeNull();
  });
  it("valida dimensiones", () => {
    expect(validateDimensions(64, 64)).toMatch(/al menos/);
    expect(validateDimensions(9000, 200)).toMatch(/superar/);
    expect(validateDimensions(800, 600)).toBeNull();
  });
});

describe("permisos", () => {
  const plan = { creatorId: "u1", status: "published", visibility: "public", startsAt: future(24), acceptedCount: 1, capacity: 3 };
  it("sólo el creador gestiona su plan", () => {
    expect(canManagePlan(user, plan)).toBe(true);
    expect(canManagePlan({ ...user, id: "u2" }, plan)).toBe(false);
    expect(canManagePlan({ ...user, status: "suspended" }, plan)).toBe(false);
  });
  it("eventos verificados sólo para organizadores verificados", () => {
    expect(canCreateVerifiedPlan(user)).toBe(false);
    expect(canCreateVerifiedPlan({ ...user, isVerifiedOrganizer: true })).toBe(true);
  });
  it("sólo admin verifica y nunca a sí mismo", () => {
    expect(canReviewVerification(user, "x")).toBe(false);
    expect(canReviewVerification({ ...user, isVerifiedOrganizer: true }, "x")).toBe(false);
    expect(canReviewVerification(admin, "x")).toBe(true);
    expect(canReviewVerification(admin, "a1")).toBe(false);
    expect(isAdmin({ ...admin, status: "suspended" })).toBe(false);
  });
  it("reglas de solicitud", () => {
    expect(canRequestToJoin(user, plan).ok).toBe(false); // propio
    expect(canRequestToJoin({ ...user, id: "u2" }, plan).ok).toBe(true);
    expect(canRequestToJoin({ ...user, id: "u2" }, { ...plan, acceptedCount: 3 }).ok).toBe(false);
    expect(canRequestToJoin(null, plan).ok).toBe(false);
  });
  it("planes vencidos se muestran como finalizados", () => {
    expect(effectiveStatus({ ...plan, startsAt: new Date(Date.now() - 5 * 3600_000) })).toBe("finished");
  });
});

describe("validación de formularios", () => {
  const base = { firstName: "Ana", lastName: "Gómez", username: "ana_g", email: "ana@example.test", password: "claveSegura123", birthDate: "1995-02-03", barrioId: 1, acceptTerms: true };
  it("acepta registro válido", () => expect(registerSchema.safeParse(base).success).toBe(true));
  it("rechaza inyección de rol/verificación (esquema estricto)", () => {
    expect(registerSchema.safeParse({ ...base, role: "admin" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, verified: true }).success).toBe(false);
  });
  it("rechaza menores de edad, contraseñas débiles y sin términos", () => {
    const y = new Date().getFullYear() - 15;
    expect(registerSchema.safeParse({ ...base, birthDate: `${y}-01-01` }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "corta" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "soloLetrasLargas" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(ageFrom("2000-01-01", new Date("2020-01-01T12:00:00Z"))).toBe(20);
  });
  it("valida planes y fechas", () => {
    const p = { title: "Basket", description: "Partido amistoso de basket", categoryId: 1, startsAt: future(5).toISOString(), locationName: "Bosque Popular", lat: 5.05, lng: -75.49, capacity: 6 };
    expect(planCreateSchema.safeParse(p).success).toBe(true);
    expect(planCreateSchema.safeParse({ ...p, capacity: 1 }).success).toBe(false);
    expect(planCreateSchema.safeParse({ ...p, coverUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(planCreateSchema.safeParse({ ...p, status: "published" }).success).toBe(false);
    expect(checkPlanDates({ startsAt: new Date(Date.now() - 1000).toISOString() })).toMatch(/futura/);
    expect(checkPlanDates({ startsAt: future(5).toISOString(), endsAt: future(4).toISOString() })).toMatch(/posterior/);
  });
});

describe("recomendaciones explicables", () => {
  const mk = (id: string, categoryId: number, h: number, extra = {}) => ({ id, categoryId, categoryName: `Cat${categoryId}`, kind: "community" as const, startsAt: future(h), lat: 5.06, lng: -75.5, capacity: 5, acceptedCount: 0, ...extra });
  it("prioriza intereses y excluye vencidos o llenos", () => {
    const r = recommend([mk("a", 1, 100), mk("b", 2, 100), mk("c", 2, -1), mk("d", 2, 10, { acceptedCount: 5 })], { interestCategoryIds: [2], favoriteCategoryIds: [], participatedCategoryIds: [] });
    expect(r.map((x) => x.plan.id)).toEqual(["b", "a"]);
    expect(r[0].reasons[0]).toMatch(/Porque te interesa/);
  });
  it("usuario nuevo recibe recomendaciones generales por fecha", () => {
    const r = recommend([mk("late", 1, 200), mk("soon", 1, 5)], { interestCategoryIds: [], favoriteCategoryIds: [], participatedCategoryIds: [] });
    expect(r[0].plan.id).toBe("soon");
  });
});

describe("dataset de la demo", () => {
  it("es ficticio, etiquetado y con fechas relativas", () => {
    const d = getDemoData();
    expect(d.users.every((u) => /demo|ficticio/i.test(u.name + u.username))).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/@[a-z]+\.(com|co|org)/i); // sin correos
    expect(d.plans.filter((p) => p.kind === "verified").every((p) => /EJEMPLO|ficticio/i.test(p.title))).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/Alcald/i);
    expect(d.plans.some((p) => new Date(p.startsAt) > new Date())).toBe(true);
  });
});
