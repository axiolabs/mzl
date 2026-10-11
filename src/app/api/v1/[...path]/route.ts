import { ApiError, assertSameOrigin, handleError } from "@/server/core";
import { adminRoutes } from "@/server/modules/admin";
import { authRoutes } from "@/server/modules/auth";
import { planRoutes } from "@/server/modules/plans";
import { socialRoutes } from "@/server/modules/social";
import type { Route } from "@/server/modules/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const routes: Route[] = [...authRoutes, ...planRoutes, ...socialRoutes, ...adminRoutes];

function match(method: string, segments: string[]) {
  let pathMatched = false;
  for (const r of routes) {
    const parts = r.path.split("/");
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(":")) params[parts[i].slice(1)] = decodeURIComponent(segments[i]);
      else if (parts[i] !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    pathMatched = true;
    if (r.method === method) return { route: r, params };
  }
  return { route: null, params: {}, pathMatched };
}

async function dispatch(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    const m = match(req.method.toUpperCase(), path);
    if (!m.route) {
      if ("pathMatched" in m && m.pathMatched) throw new ApiError(405, "method_not_allowed", "Método no permitido.");
      throw new ApiError(404, "not_found", "Endpoint no encontrado.");
    }
    assertSameOrigin(req); // CSRF para toda petición mutante
    return await m.route.handler({ req, params: m.params, query: new URL(req.url).searchParams });
  } catch (e) {
    return handleError(e);
  }
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
