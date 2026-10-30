// Server-side proxy to the Python service. It adds the visitor's address and a shared secret so the
// service can rate-limit per visitor; direct callers can't fake either.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8080";
const SECRET = process.env.PROXY_SECRET ?? "";

export const maxDuration = 60;

async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const target = `${API_URL}/api/${path.map(encodeURIComponent).join("/")}${url.search}`;
  const visitor = (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (SECRET) {
    headers["x-proxy-secret"] = SECRET;
    headers["x-proxy-visitor"] = visitor;
  }
  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "POST" ? await req.text() : undefined,
      cache: "no-store",
    });
    const type = res.headers.get("content-type") ?? "application/json";
    if (type.startsWith("application/x-ndjson") && res.body) {
      return new Response(res.body, { status: res.status, headers: { "content-type": type, "cache-control": "no-store" } });
    }
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ detail: "The service is waking up. Try again in a moment." }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}

export async function POST(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
