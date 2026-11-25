import { authOrigin } from "@/lib/auth/server";
import { verifyMagicLink } from "@/lib/auth/magic-link";

export async function POST(request: Request) {
  const origin = authOrigin();
  if (request.headers.get("origin") !== origin)
    return new Response(null, { status: 403 });

  let response: Response;
  try {
    const token = (await request.formData()).get("token");
    response = await verifyMagicLink(
      typeof token === "string" ? token : null,
      request.headers,
    );
  } catch {
    console.error("Failed to verify a CRM sign-in link");
    response = Response.redirect(new URL("/login/expired", origin), 303);
  }
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  return new Response(null, { status: response.status, headers });
}
