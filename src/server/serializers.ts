import type { users } from "@/db/schema";

type U = Pick<typeof users.$inferSelect, "id" | "username" | "firstName" | "lastName" | "avatarMediaId" | "isVerifiedOrganizer" | "organizerName">;

export function avatarUrl(mediaId: string | null | undefined) {
  return mediaId ? `/api/v1/media/${mediaId}` : null;
}

/** Datos mínimos de un usuario que pueden mostrarse públicamente (nunca correo, fecha de nacimiento ni barrio). */
export function publicUser(u: U) {
  return {
    id: u.id,
    username: u.username,
    displayName: `${u.firstName} ${u.lastName.charAt(0)}.`,
    avatarUrl: avatarUrl(u.avatarMediaId),
    isVerifiedOrganizer: u.isVerifiedOrganizer,
    organizerName: u.isVerifiedOrganizer ? u.organizerName : null,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;
