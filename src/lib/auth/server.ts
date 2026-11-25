import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";

import { getDb } from "@/db";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
} from "@/db/schema";

export const LINK_LIFETIME = 15 * 60;
export const SESSION_LIFETIME = 30 * 24 * 60 * 60;

export function authOrigin() {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL is required for sign-in");
  const url = new URL(baseUrl);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("BETTER_AUTH_URL must be an HTTP URL");
  return url.origin;
}

type AuthDatabase = Pick<
  ReturnType<typeof getDb>,
  "insert" | "select" | "update" | "delete" | "transaction"
>;

export function createAuth(
  db: AuthDatabase,
  linkOptions?: Partial<Parameters<typeof magicLink>[0]>,
) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required for sign-in");

  return betterAuth({
    baseURL: authOrigin(),
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
      transaction: true,
    }),
    session: { expiresIn: SESSION_LIFETIME, updateAge: 0 },
    rateLimit: { enabled: false },
    logger: { disabled: true },
    plugins: [
      magicLink({
        expiresIn: LINK_LIFETIME,
        sendMagicLink: async () => {
          throw new Error(
            "Magic links must be sent through the CRM sign-in form",
          );
        },
        ...linkOptions,
      }),
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth(getDb());
  return auth;
}
