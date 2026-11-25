import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "./server";

export const getCurrentUser = cache(async () => {
  const requestHeaders = new Headers(await headers());
  if (!requestHeaders.has("cookie")) return null;
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableRefresh: true },
  });
  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
