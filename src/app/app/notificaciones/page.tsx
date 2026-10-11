import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { MarkAllRead } from "@/components/app-client";
import { Card, EmptyState, PageTitle, fmtDate } from "@/components/ui";
import { pageUser } from "@/server/core";

export const metadata = { title: "Notificaciones" };

export default async function Notificaciones() {
  const u = await pageUser();
  const items = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(50);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Notificaciones" subtitle={unread ? `${unread} sin leer` : "Estás al día"} action={unread ? <MarkAllRead /> : undefined} />
      {items.length === 0 ? <EmptyState icon={<Bell className="h-8 w-8" />} title="Sin notificaciones">Aquí verás solicitudes, aceptaciones y cambios en tus planes.</EmptyState> : (
        <ul className="space-y-2">{items.map((n) => (
          <li key={n.id}><Card className={n.readAt ? "opacity-75" : "border-l-4 border-l-accent"}>
            <div className="flex items-start justify-between gap-3"><p className="font-semibold">{n.title}</p><time className="shrink-0 text-xs text-black/50">{fmtDate(n.createdAt.toISOString())}</time></div>
            {n.body && <p className="text-sm text-black/70">{n.body}</p>}
            {n.link && n.link.startsWith("/") && <Link href={n.link} className="text-sm font-semibold text-accent-dark">Ver →</Link>}
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
