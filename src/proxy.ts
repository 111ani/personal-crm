import { type NextRequest, NextResponse } from "next/server";

import { getAuth } from "@/lib/auth/server";

export async function proxy(request: NextRequest) {
  if (request.method !== "GET") return NextResponse.next();
  const login = new URL("/login", request.url);
  if (!request.headers.has("cookie")) return NextResponse.redirect(login);

  const prefetch =
    request.headers.get("purpose") === "prefetch" ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch");
  // Refresh in the request pipeline, where the renewed cookie can be sent to
  // the browser. Server Components below still check their own session.
  const lookup = await getAuth().api.getSession({
    headers: request.headers,
    query: { disableRefresh: prefetch },
    asResponse: true,
  });
  const session = lookup.ok ? await lookup.json() : null;
  const response = session ? NextResponse.next() : NextResponse.redirect(login);
  for (const cookie of lookup.headers.getSetCookie())
    response.headers.append("set-cookie", cookie);
  return response;
}

export const config = { matcher: ["/", "/groups", "/contacts/:path*"] };
