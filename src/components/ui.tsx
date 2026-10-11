import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { BadgeCheck, Loader2, UserRound } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean };
export function Button({ variant = "primary", loading, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent-dark shadow-sm",
    secondary: "bg-white text-ink border border-black/10 hover:bg-black/5",
    ghost: "text-ink hover:bg-black/5",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button className={cx("inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed", v, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export const linkBtn = (variant: "primary" | "secondary" = "primary") =>
  cx("inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition", variant === "primary" ? "bg-accent text-white hover:bg-accent-dark" : "bg-white border border-black/10 hover:bg-black/5");

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-black/55">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-red-500";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "teal" | "warn" | "danger" }) {
  const t = { neutral: "bg-black/5 text-black/70", accent: "bg-accent/10 text-accent-dark", teal: "bg-teal/10 text-teal", warn: "bg-amber-100 text-amber-800", danger: "bg-red-100 text-red-700" }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", t)}>{children}</span>;
}

export const VerifiedBadge = ({ label = "Verificado" }: { label?: string }) => (
  <Badge tone="teal"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />{label}</Badge>
);

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-black/5 bg-white p-5 shadow-sm", className)}>{children}</div>;
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("animate-pulse rounded-xl bg-black/10", className)} aria-hidden />;

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-accent">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-black/60">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "error" | "warn"; children: ReactNode }) {
  const t = { info: "bg-sky-50 text-sky-900 border-sky-200", success: "bg-emerald-50 text-emerald-900 border-emerald-200", error: "bg-red-50 text-red-900 border-red-200", warn: "bg-amber-50 text-amber-900 border-amber-200" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", t)}>{children}</div>;
}

/** Imagen neutral cuando no hay fotografía. No existe catálogo de avatares. */
export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${src}${src.startsWith("/api/") ? `?s=${size <= 64 ? 128 : 512}` : ""}`} alt={`Foto de ${name}`} width={size} height={size} loading="lazy" className="rounded-full object-cover bg-black/5" style={{ width: size, height: size }} />;
  }
  return (
    <span role="img" aria-label={`${name} sin fotografía`} className="inline-flex items-center justify-center rounded-full bg-black/10 text-black/40" style={{ width: size, height: size }}>
      <UserRound style={{ width: size * 0.55, height: size * 0.55 }} aria-hidden />
    </span>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-black/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(iso));

export const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", pending_review: "Pendiente de revisión", published: "Publicado", full: "Completo", cancelled: "Cancelado", finished: "Finalizado",
  pending: "Pendiente", accepted: "Aceptada", rejected: "No aceptada", withdrawn: "Retirada", removed: "Retirado",
};
