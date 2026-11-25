import { authOrigin, getAuth } from "@/lib/auth/server";

export async function POST(request: Request) {
  const origin = authOrigin();
  if (request.headers.get("origin") !== origin)
    return new Response(null, { status: 403 });

  const result = await getAuth().api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  if (!result.ok) return new Response(null, { status: result.status });

  const headers = new Headers({
    location: new URL("/login", origin).href,
    "cache-control": "no-store",
  });
  for (const cookie of result.headers.getSetCookie())
    headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}
