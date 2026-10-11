export type Ctx = { req: Request; params: Record<string, string>; query: URLSearchParams };
export type Handler = (ctx: Ctx) => Promise<Response>;
export type Route = { method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; handler: Handler };
