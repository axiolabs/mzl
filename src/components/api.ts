"use client";
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string; fields?: Record<string, string> };

/** Cliente fetch del navegador. Las cookies HttpOnly viajan solas; el navegador añade Origin (CSRF). */
export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/v1/${path}`, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers: opts.form ? undefined : opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, message: data?.error?.message ?? "Error de conexión", fields: data?.error?.fields };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, message: "No hay conexión. Revisa tu internet e intenta de nuevo." };
  }
}
