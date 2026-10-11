"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Lock, MapPin } from "lucide-react";
import { fieldErrors, forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validation";
import { api } from "./api";
import { Alert, Button, Field, Input, Select } from "./ui";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/app");

export function RegisterForm({ barrios }: { barrios: { id: number; name: string }[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({ firstName: "", lastName: "", username: "", email: "", password: "", birthDate: "", barrioId: "", acceptTerms: false });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const err = (k: string) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `${k}-error` : undefined });
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (busy) return;
      const parsed = registerSchema.safeParse({ ...v, barrioId: v.barrioId || 0 });
      if (!parsed.success) { setErrors(fieldErrors(parsed.error)); setMsg({ tone: "error", text: "Revisa los campos marcados." }); return; }
      setErrors({}); setBusy(true); setMsg(null);
      const r = await api<{ message: string }>("auth/register", { body: parsed.data });
      setBusy(false);
      if (!r.ok) { setErrors(r.fields ?? {}); setMsg({ tone: "error", text: r.message }); return; }
      setMsg({ tone: "success", text: r.data.message });
      router.push("/app/perfil?bienvenida=1"); router.refresh();
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="Nombre" error={errors.firstName}><Input id="firstName" autoComplete="given-name" value={v.firstName} onChange={set("firstName")} {...err("firstName")} /></Field>
        <Field id="lastName" label="Apellido" error={errors.lastName}><Input id="lastName" autoComplete="family-name" value={v.lastName} onChange={set("lastName")} {...err("lastName")} /></Field>
      </div>
      <Field id="username" label="Nombre de usuario" error={errors.username} hint="Minúsculas, números, punto o guion bajo."><Input id="username" autoComplete="username" value={v.username} onChange={set("username")} {...err("username")} /></Field>
      <Field id="email" label="Correo electrónico" error={errors.email}><Input id="email" type="email" autoComplete="email" value={v.email} onChange={set("email")} {...err("email")} /></Field>
      <Field id="password" label="Contraseña" error={errors.password} hint="Mínimo 10 caracteres, con letras y números."><Input id="password" type="password" autoComplete="new-password" value={v.password} onChange={set("password")} {...err("password")} /></Field>
      <Field id="birthDate" label="Fecha de nacimiento" error={errors.birthDate} hint="Sólo para verificar la edad mínima (18). No se muestra."><Input id="birthDate" type="date" value={v.birthDate} onChange={set("birthDate")} {...err("birthDate")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="city" label="Ciudad"><div className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm" id="city" aria-readonly><MapPin className="h-4 w-4" aria-hidden />Manizales, Caldas, Colombia</div></Field>
        <Field id="barrioId" label="Barrio o sector" error={errors.barrioId}>
          <Select id="barrioId" value={v.barrioId} onChange={set("barrioId")} {...err("barrioId")}><option value="">Elige…</option>{barrios.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        </Field>
      </div>
      <p className="text-xs text-black/55">La fotografía de perfil es opcional: puedes subirla desde tu dispositivo después de crear la cuenta.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={v.acceptTerms} onChange={set("acceptTerms")} className="mt-1 h-4 w-4 accent-[#ff5a3c]" aria-invalid={!!errors.acceptTerms || undefined} />
        <span>Acepto los <Link href="/info/terminos" className="font-semibold underline" target="_blank">términos de uso</Link> y la <Link href="/info/privacidad" className="font-semibold underline" target="_blank">política de privacidad y tratamiento de datos</Link>.</span>
      </label>
      {errors.acceptTerms && <p role="alert" className="text-xs font-medium text-red-700">{errors.acceptTerms}</p>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" className="w-full py-3" loading={busy}>Crear cuenta</Button>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [v, setV] = useState({ email: "", password: "", appealMessage: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (busy) return;
      const parsed = loginSchema.safeParse({ email: v.email, password: v.password, ...(suspended && v.appealMessage ? { appealMessage: v.appealMessage } : {}) });
      if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
      setErrors({}); setBusy(true); setMsg(null);
      const r = await api("auth/login", { body: parsed.data });
      setBusy(false);
      if (!r.ok) { setMsg(r.message); if (r.status === 403) setSuspended(true); return; }
      router.push(safeNext(sp.get("next"))); router.refresh();
    }}>
      <Field id="email" label="Correo electrónico" error={errors.email}><Input id="email" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} aria-invalid={!!errors.email || undefined} /></Field>
      <Field id="password" label="Contraseña" error={errors.password}><Input id="password" type="password" autoComplete="current-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
      {suspended && <Field id="appeal" label="Apelación (opcional)" hint="Explica por qué crees que la suspensión debe revisarse."><textarea id="appeal" rows={3} maxLength={1000} className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm" value={v.appealMessage} onChange={(e) => setV({ ...v, appealMessage: e.target.value })} /></Field>}
      {msg && <Alert tone="error">{msg}</Alert>}
      <Button type="submit" className="w-full py-3" loading={busy}><Lock className="h-4 w-4" aria-hidden />Iniciar sesión</Button>
      <p className="text-center text-sm"><Link href="/recuperar" className="font-semibold text-accent-dark">¿Olvidaste tu contraseña?</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const p = forgotSchema.safeParse({ email });
      if (!p.success) { setMsg({ tone: "error", text: "Escribe un correo válido." }); return; }
      setBusy(true);
      const r = await api<{ message: string }>("auth/forgot-password", { body: p.data });
      setBusy(false);
      setMsg(r.ok ? { tone: "success", text: r.data.message } : { tone: "error", text: r.message });
    }}>
      <Field id="email" label="Correo electrónico"><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" className="w-full" loading={busy}>Enviar instrucciones</Button>
    </form>
  );
}

export function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const token = sp.get("token") ?? "";
  if (!token) return <Alert tone="error">Enlace incompleto. Solicita uno nuevo en <Link href="/recuperar" className="underline">recuperar contraseña</Link>.</Alert>;
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const p = resetSchema.safeParse({ token, password });
      if (!p.success) { setMsg({ tone: "error", text: fieldErrors(p.error).password ?? "Enlace inválido" }); return; }
      setBusy(true);
      const r = await api("auth/reset-password", { body: p.data });
      setBusy(false);
      if (r.ok) { setMsg({ tone: "success", text: "Contraseña actualizada. Cerramos tus otras sesiones por seguridad." }); setTimeout(() => router.push("/login"), 1500); }
      else setMsg({ tone: "error", text: r.message });
    }}>
      <Field id="password" label="Nueva contraseña" hint="Mínimo 10 caracteres, con letras y números."><Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" className="w-full" loading={busy}>Guardar contraseña</Button>
    </form>
  );
}

export function VerifyEmail() {
  const sp = useSearchParams();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("");
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const token = sp.get("token");
    if (!token) return;
    api("auth/verify-email", { body: { token } }).then((r) => { if (r.ok) setState("ok"); else { setState("error"); setMsg(r.message); } });
  }, [sp]);
  if (!sp.get("token")) return <Alert tone="error">Enlace incompleto. Puedes reenviar el enlace desde Configuración.</Alert>;
  if (state === "loading") return <p role="status">Verificando…</p>;
  if (state === "ok") return <Alert tone="success">¡Correo verificado! Ya puedes <Link className="underline" href="/app">ir a tu inicio</Link>.</Alert>;
  return <Alert tone="error">{msg} Puedes reenviar el enlace desde Configuración.</Alert>;
}
