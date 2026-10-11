import { distanceKm } from "./geo";

export type RecPlan = {
  id: string;
  categoryId: number;
  categoryName: string;
  kind: "community" | "verified";
  startsAt: Date;
  lat: number;
  lng: number;
  capacity: number;
  acceptedCount: number;
};

export type RecContext = {
  interestCategoryIds: number[];
  favoriteCategoryIds: number[];
  participatedCategoryIds: number[];
  zone?: { name: string; lat: number; lng: number } | null; // sólo si el usuario consintió
  now?: Date;
};

export type Recommendation<T> = { plan: T; score: number; reasons: string[] };

/** Recomendador explicable y transparente: suma de criterios con pesos fijos y documentados. */
export function scorePlan<T extends RecPlan>(plan: T, ctx: RecContext): Recommendation<T> | null {
  const now = ctx.now ?? new Date();
  const hours = (plan.startsAt.getTime() - now.getTime()) / 3600_000;
  if (hours < 0) return null; // vencido
  if (plan.acceptedCount >= plan.capacity) return null; // sin cupo
  let score = 0;
  const reasons: string[] = [];
  const cat = plan.categoryName.toLowerCase();
  if (ctx.interestCategoryIds.includes(plan.categoryId)) {
    score += 40;
    reasons.push(`Porque te interesa ${cat}`);
  }
  if (ctx.favoriteCategoryIds.includes(plan.categoryId)) {
    score += 20;
    reasons.push(`Porque guardaste planes de ${cat}`);
  }
  if (ctx.participatedCategoryIds.includes(plan.categoryId)) {
    score += 15;
    reasons.push(`Porque ya participaste en planes de ${cat}`);
  }
  if (ctx.zone) {
    const d = distanceKm([ctx.zone.lat, ctx.zone.lng], [plan.lat, plan.lng]);
    if (d <= 2) {
      score += 15;
      reasons.push(`Porque elegiste explorar cerca de ${ctx.zone.name}`);
    } else if (d <= 4) score += 6;
  }
  if (hours <= 72) {
    score += 15;
    reasons.push("Es muy pronto");
  } else if (hours <= 168) score += 8;
  if (plan.kind === "verified") score += 5;
  if (reasons.length === 0) reasons.push("Próximo plan con cupos en Manizales");
  return { plan, score, reasons: reasons.slice(0, 2) };
}

export function recommend<T extends RecPlan>(plans: T[], ctx: RecContext, limit = 12): Recommendation<T>[] {
  return plans
    .map((p) => scorePlan(p, ctx))
    .filter((r): r is Recommendation<T> => r !== null)
    .sort((a, b) => b.score - a.score || a.plan.startsAt.getTime() - b.plan.startsAt.getTime())
    .slice(0, limit);
}
