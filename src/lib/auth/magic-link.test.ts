import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getDb } from "@/db";
import {
  authSessions,
  authUsers,
  authVerifications,
  magicLinkRequests,
} from "@/db/schema";

import { requestMagicLink, verifyMagicLink } from "./magic-link";

const { sendSignInEmail } = vi.hoisted(() => ({
  sendSignInEmail: vi.fn<(email: string, url: string) => Promise<void>>(),
}));
vi.mock("./mail", () => ({ sendSignInEmail }));

const base = "http://localhost:3100";
const headers = new Headers({ origin: base });
const email = "reader@example.test";

function token(index = 0) {
  return new URL(sendSignInEmail.mock.calls[index][1]).hash.slice(1);
}

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_URL", base);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "vitest-fixture-only-4f391ab188f4e0cd98462258",
  );
  sendSignInEmail.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

test("Invalid addresses are rejected before sending email", async () => {
  expect(await requestMagicLink("invalid", headers)).toEqual({
    status: "invalid",
  });
  expect(sendSignInEmail).not.toHaveBeenCalled();
});

test("New and existing addresses receive the same confirmation", async () => {
  await getDb()
    .insert(authUsers)
    .values({ id: "reader", name: "Reader", email });
  expect(await requestMagicLink(" READER@Example.Test ", headers)).toEqual({
    status: "sent",
    email,
  });
  expect(await requestMagicLink("new@example.test", headers)).toEqual({
    status: "sent",
    email: "new@example.test",
  });
  expect(sendSignInEmail.mock.calls.map(([address]) => address)).toEqual([
    email,
    "new@example.test",
  ]);
  expect(await getDb().select().from(authUsers)).toHaveLength(1);
});

test("A valid link creates an account, and another link opens the existing account", async () => {
  await requestMagicLink(email, headers);
  const firstLink = await verifyMagicLink(token(), headers);
  expect(firstLink.headers.get("location")).toBe(`${base}/`);
  expect(firstLink.headers.getSetCookie().length).toBeGreaterThan(0);
  const firstUsers = await getDb().select().from(authUsers);
  expect(firstUsers).toMatchObject([{ email, emailVerified: true }]);
  await requestMagicLink(" READER@Example.Test ", headers);
  expect(
    (await verifyMagicLink(token(1), headers)).headers.get("location"),
  ).toBe(`${base}/`);
  expect(await getDb().select().from(authUsers)).toEqual(firstUsers);
  expect(await getDb().select().from(authSessions)).toHaveLength(2);
});

test("A used link redirects to the expired link page", async () => {
  await requestMagicLink(email, headers);
  await verifyMagicLink(token(), headers);
  expect(
    (await verifyMagicLink(token(), headers)).headers.get("location"),
  ).toBe(`${base}/login/expired`);
});

test("A link expires after fifteen minutes", async () => {
  await requestMagicLink(email, headers);
  await getDb()
    .update(magicLinkRequests)
    .set({ issuedAt: sql`now() - interval '15 minutes'` });
  expect(
    (await verifyMagicLink(token(), headers)).headers.get("location"),
  ).toBe(`${base}/login/expired`);
  expect(await getDb().select().from(authUsers)).toEqual([]);
});

test("Two concurrent verifications create one session", async () => {
  await requestMagicLink(email, headers);
  const responses = await Promise.all([
    verifyMagicLink(token(), headers),
    verifyMagicLink(token(), headers),
  ]);
  expect(
    responses.map((response) => response.headers.get("location")).sort(),
  ).toEqual([`${base}/`, `${base}/login/expired`]);
  expect(await getDb().select().from(authSessions)).toHaveLength(1);
});

test("Only the latest link remains valid after concurrent requests", async () => {
  await Promise.all([
    requestMagicLink(email, headers),
    requestMagicLink(email, headers),
  ]);
  expect(
    (await verifyMagicLink(token(), headers)).headers.get("location"),
  ).toBe(`${base}/login/expired`);
  expect(
    (await verifyMagicLink(token(1), headers)).headers.get("location"),
  ).toBe(`${base}/`);
});

test("Three requests per address in ten minutes, with no effect on other addresses", async () => {
  const results = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      requestMagicLink(
        index % 2 ? email : " READER@Example.Test ",
        new Headers(),
      ),
    ),
  );
  expect(results.map(({ status }) => status).sort()).toEqual([
    "limited",
    "sent",
    "sent",
    "sent",
  ]);
  expect(sendSignInEmail).toHaveBeenCalledTimes(3);
  expect(await requestMagicLink("other@example.test", headers)).toEqual({
    status: "sent",
    email: "other@example.test",
  });
  expect(
    (await verifyMagicLink(token(2), headers)).headers.get("location"),
  ).toBe(`${base}/`);
  await getDb()
    .update(magicLinkRequests)
    .set({ issuedAt: sql`now() - interval '10 minutes'` })
    .where(
      and(
        eq(magicLinkRequests.email, email),
        sql`${magicLinkRequests.tokenHash} = (select token_hash from magic_link_requests where email = ${email} order by issued_at limit 1)`,
      ),
    );
  expect(await requestMagicLink(email, headers)).toEqual({
    status: "sent",
    email,
  });
});

test("A failed delivery preserves the working link and does not count as a sent email", async () => {
  await requestMagicLink(email, headers);
  sendSignInEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));
  await expect(requestMagicLink(email, headers)).rejects.toThrow();
  expect(await getDb().select().from(magicLinkRequests)).toHaveLength(1);
  expect(await getDb().select().from(authVerifications)).toHaveLength(1);
  expect(
    (await verifyMagicLink(token(), headers)).headers.get("location"),
  ).toBe(`${base}/`);
});

test("A link opened before SMTP returns waits for its issuance to commit", async () => {
  const { promise: delivered, resolve: notifyDelivery } =
    Promise.withResolvers<void>();
  const { promise: smtpReply, resolve: finishDelivery } =
    Promise.withResolvers<void>();
  sendSignInEmail.mockImplementationOnce(async () => {
    notifyDelivery();
    await smtpReply;
  });
  const requested = requestMagicLink(email, headers);
  await delivered;
  const verified = verifyMagicLink(token(), headers);
  try {
    const outcome = await Promise.race([
      verified.then(() => "finished"),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("pending"), 100),
      ),
    ]);
    expect(outcome).toBe("pending");
  } finally {
    finishDelivery();
    await requested;
  }
  expect((await verified).headers.get("location")).toBe(`${base}/`);
});
