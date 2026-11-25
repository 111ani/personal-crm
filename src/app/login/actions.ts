"use server";

import { headers } from "next/headers";

import { requestMagicLink } from "@/lib/auth/magic-link";

export type SignInState =
  | { status: "idle" }
  | { status: "invalid" | "limited" | "sent" | "error"; email: string };

export async function requestSignIn(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  const value = form.get("email");
  const email = typeof value === "string" ? value : "";
  try {
    const result = await requestMagicLink(email, new Headers(await headers()));
    if (result.status === "sent") return result;
    return { status: result.status, email };
  } catch {
    // SMTP and library errors can contain message contents or sign-in tokens.
    console.error("Failed to send a CRM sign-in link");
    return { status: "error", email };
  }
}
