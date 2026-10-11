import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userInterests, userPreferences } from "@/db/schema";
import { AvatarUploader, ProfileEditor } from "@/components/app-client";
import { Alert, Card, PageTitle } from "@/components/ui";
import { pageUser } from "@/server/core";
import { getMeta } from "@/server/modules/plans";
import { avatarUrl } from "@/server/serializers";

export const metadata = { title: "Mi perfil" };

export default async function Perfil({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const u = await pageUser();
  const sp = await searchParams;
  const [meta, [prefs], ints] = await Promise.all([getMeta(), db.select().from(userPreferences).where(eq(userPreferences.userId, u.id)), db.select().from(userInterests).where(eq(userInterests.userId, u.id))]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Mi perfil" subtitle={`@${u.username}`} action={<Link href={`/u/${u.username}`} className="font-semibold text-accent-dark">Ver perfil público →</Link>} />
      {sp.bienvenida && <Alert tone="success">¡Bienvenido a MZL Parchado! Sube una foto y elige tus intereses para mejores recomendaciones.</Alert>}
      <Card><h2 className="mb-4 font-bold">Fotografía</h2><AvatarUploader current={avatarUrl(u.avatarMediaId)} name={u.firstName} /></Card>
      <Card><ProfileEditor profile={{ firstName: u.firstName, lastName: u.lastName, bio: u.bio, barrioId: u.barrioId, interests: ints.map((i) => i.categoryId), preferences: prefs ?? null }} categories={meta.categories} barrios={meta.barrios} /></Card>
    </div>
  );
}
