import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, lte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { magicLinkRequests } from "@/db/schema";

import { normalizeEmail } from "./email";
import { sendSignInEmail } from "./mail";
import { authOrigin, createAuth, LINK_LIFETIME } from "./server";

const REQUEST_LIMIT = 3;
const REQUEST_WINDOW = 10 * 60;
const VERIFY_PATH = "/login/verify";
const EXPIRED_PATH = "/login/expired";

type Transaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const storedToken = {
  type: "custom-hasher",
  hash: async (token: string) => hashToken(token),
} as const;

function lockEmail(tx: Transaction, email: string) {
  return tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${email}, 0))`,
  );
}

function lockToken(tx: Transaction, tokenHash: string) {
  return tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${tokenHash}, 1))`,
  );
}

export type MagicLinkRequestResult =
  { status: "invalid" | "limited" } | { status: "sent"; email: string };

export async function requestMagicLink(
  address: unknown,
  headers: Headers,
): Promise<MagicLinkRequestResult> {
  const email = normalizeEmail(address);
  if (!email) return { status: "invalid" };

  return getDb().transaction(async (tx) => {
    await lockEmail(tx, email);
    const requestTime = new Date();
    const [{ value }] = await tx
      .select({ value: count() })
      .from(magicLinkRequests)
      .where(
        and(
          eq(magicLinkRequests.email, email),
          gt(
            magicLinkRequests.issuedAt,
            new Date(requestTime.valueOf() - REQUEST_WINDOW * 1000),
          ),
        ),
      );
    if (value >= REQUEST_LIMIT) return { status: "limited" };

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    await lockToken(tx, tokenHash);
    const auth = createAuth(tx, {
      generateToken: async () => token,
      storeToken: storedToken,
      sendMagicLink: async () => {
        const url = new URL(VERIFY_PATH, authOrigin());
        // URL fragments never reach HTTP access logs. The browser posts the token.
        url.hash = token;
        await sendSignInEmail(email, url.href);
      },
    });

    // Keep issuance, replacement and SMTP delivery under the same address lock.
    // A delivery failure rolls back both the verification and request history.
    await tx
      .delete(magicLinkRequests)
      .where(
        and(
          eq(magicLinkRequests.email, email),
          lte(
            magicLinkRequests.issuedAt,
            new Date(requestTime.valueOf() - LINK_LIFETIME * 1000),
          ),
        ),
      );
    await tx
      .update(magicLinkRequests)
      .set({ current: false })
      .where(
        and(
          eq(magicLinkRequests.email, email),
          eq(magicLinkRequests.current, true),
        ),
      );
    await tx
      .insert(magicLinkRequests)
      .values({ tokenHash, email, issuedAt: requestTime });
    const result = await auth.api.signInMagicLink({ body: { email }, headers });
    if (!result.status) throw new Error("Magic link request failed");
    return { status: "sent", email };
  });
}

export async function verifyMagicLink(
  token: string | null,
  headers: Headers,
): Promise<Response> {
  const origin = authOrigin();
  const expired = () => Response.redirect(new URL(EXPIRED_PATH, origin), 303);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return expired();
  const tokenHash = hashToken(token);

  const response = await getDb().transaction(async (tx) => {
    // Someone who opens the email as soon as it arrives can reach this route
    // before the SMTP call returns to the issuing transaction.
    await lockToken(tx, tokenHash);
    const [link] = await tx
      .select({ email: magicLinkRequests.email })
      .from(magicLinkRequests)
      .where(eq(magicLinkRequests.tokenHash, tokenHash));
    if (!link) return null;

    await lockEmail(tx, link.email);
    const [current] = await tx
      .update(magicLinkRequests)
      .set({ current: false })
      .where(
        and(
          eq(magicLinkRequests.tokenHash, tokenHash),
          eq(magicLinkRequests.current, true),
          gt(
            magicLinkRequests.issuedAt,
            new Date(Date.now() - LINK_LIFETIME * 1000),
          ),
        ),
      )
      .returning({ email: magicLinkRequests.email });
    if (!current) return null;

    return createAuth(tx, { storeToken: storedToken }).api.magicLinkVerify({
      asResponse: true,
      query: { token, callbackURL: "/", errorCallbackURL: EXPIRED_PATH },
      headers,
    });
  });

  if (response?.headers.get("location") !== new URL("/", origin).href)
    return expired();
  return response;
}
