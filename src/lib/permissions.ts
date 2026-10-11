export type Actor = {
  id: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "deleted";
  isVerifiedOrganizer: boolean;
};

export const isActive = (a: Actor | null | undefined): a is Actor => !!a && a.status === "active";
export const isAdmin = (a: Actor | null | undefined) => isActive(a) && a.role === "admin";
export const canCreateVerifiedPlan = (a: Actor | null | undefined) => isActive(a) && a.isVerifiedOrganizer;
export const canManagePlan = (a: Actor | null | undefined, plan: { creatorId: string }) =>
  isActive(a) && a.id === plan.creatorId;
export const canModeratePlan = (a: Actor | null | undefined) => isAdmin(a);
/** Sólo un admin activo puede verificar/revocar, y nunca sobre sí mismo. */
export const canReviewVerification = (a: Actor | null | undefined, targetUserId: string) =>
  isAdmin(a) && a!.id !== targetUserId;

export type PlanLike = {
  status: string;
  visibility: string;
  startsAt: Date | string;
  endsAt?: Date | string | null;
  creatorId: string;
};

/** Un plan es visible públicamente si está publicado/completo y es público (o unlisted con enlace directo). */
export function isPlanPubliclyVisible(p: PlanLike, opts: { direct?: boolean } = {}) {
  const ok = p.status === "published" || p.status === "full" || p.status === "finished" || p.status === "cancelled";
  return ok && (p.visibility === "public" || !!opts.direct);
}

export function isPlanExpired(p: PlanLike, now = new Date()) {
  const end = p.endsAt ? new Date(p.endsAt) : new Date(new Date(p.startsAt).getTime() + 3 * 3600_000);
  return end.getTime() < now.getTime();
}

/** Estado efectivo mostrado: un plan vencido se muestra como finalizado aunque no se haya actualizado en BD. */
export function effectiveStatus(p: PlanLike, now = new Date()) {
  if ((p.status === "published" || p.status === "full") && isPlanExpired(p, now)) return "finished";
  return p.status;
}

export function canRequestToJoin(a: Actor | null | undefined, p: PlanLike & { acceptedCount: number; capacity: number }) {
  if (!isActive(a)) return { ok: false, reason: "Debes iniciar sesión con una cuenta activa." };
  if (a.id === p.creatorId) return { ok: false, reason: "No puedes unirte a tu propio plan." };
  const st = effectiveStatus(p);
  if (st !== "published") return { ok: false, reason: "Este plan no admite solicitudes." };
  if (p.acceptedCount >= p.capacity) return { ok: false, reason: "El plan está completo." };
  return { ok: true as const, reason: "" };
}
