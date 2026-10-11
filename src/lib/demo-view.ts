import { getDemoData, type DemoPlan } from "./demo-data";

/** Convierte el dataset ficticio al formato de tarjetas/mapa. Sin acceso a BD. */
export function demoPlanView(p: DemoPlan, users = getDemoData().users, cats = getDemoData().categories) {
  const u = users.find((x) => x.id === p.creator)!;
  const c = cats.find((x) => x.slug === p.category)!;
  return {
    id: p.id, title: p.title, description: p.description, requirements: p.requirements ?? null,
    category: { id: c.slug, name: c.name, slug: c.slug }, kind: p.kind, coverUrl: p.cover, startsAt: p.startsAt,
    locationName: p.place, lat: p.lat, lng: p.lng, capacity: p.capacity, acceptedCount: p.accepted, status: p.status,
    creator: { username: u.username, displayName: u.name, avatarUrl: null, organizerName: u.verified ?? null, isVerifiedOrganizer: !!u.verified },
  };
}
export type DemoView = ReturnType<typeof demoPlanView>;
