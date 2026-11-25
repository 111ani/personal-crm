import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { POST as signOut } from "@/app/auth/sign-out/route";
import { getDb } from "@/db";
import { authSessions } from "@/db/schema";
import { proxy } from "@/proxy";

import { requestMagicLink, verifyMagicLink } from "./magic-link";

const { sendSignInEmail } = vi.hoisted(() => ({
  sendSignInEmail: vi.fn<(email: string, url: string) => Promise<void>>(),
}));
vi.mock("./mail", () => ({ sendSignInEmail }));
const base = "http://localhost:3100";

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_URL", base);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "vitest-fixture-only-4f391ab188f4e0cd98462258",
  );
  sendSignInEmail.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

async function createSession() {
  await requestMagicLink("reader@example.test", new Headers());
  const link = new URL(sendSignInEmail.mock.lastCall![1]);
  const response = await verifyMagicLink(link.hash.slice(1), new Headers());
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

test.each(["/", "/groups", "/contacts/00000000-0000-4000-8000-000000000001"])(
  "%s requires a session",
  async (path) => {
    expect(
      (await proxy(new NextRequest(base + path))).headers.get("location"),
    ).toBe(`${base}/login`);
  },
);

test("A visit extends the database session and the browser cookie by thirty days", async () => {
  const cookie = await createSession();
  const [session] = await getDb()
    .update(authSessions)
    .set({
      createdAt: sql`now() - interval '29 days'`,
      expiresAt: sql`now() + interval '1 day'`,
    })
    .returning();
  const response = await proxy(new NextRequest(base, { headers: { cookie } }));
  expect(response.headers.getSetCookie().join(" ")).toContain(
    "Max-Age=2592000",
  );
  const [extended] = await getDb()
    .select()
    .from(authSessions)
    .where(eq(authSessions.id, session.id));
  expect(extended.expiresAt.getTime() - Date.now()).toBeGreaterThan(
    29 * 24 * 60 * 60 * 1000,
  );
});

test("An expired session cannot be extended", async () => {
  const cookie = await createSession();
  await getDb()
    .update(authSessions)
    .set({ expiresAt: sql`now() - interval '1 second'` });
  expect(
    (await proxy(new NextRequest(base, { headers: { cookie } }))).headers.get(
      "location",
    ),
  ).toBe(`${base}/login`);
});

test("Signing out ends only the current browser session", async () => {
  const first = await createSession();
  const second = await createSession();
  const response = await signOut(
    new Request(`${base}/auth/sign-out`, {
      method: "POST",
      headers: { cookie: first, origin: base },
    }),
  );
  expect(response.headers.get("location")).toBe(`${base}/login`);
  expect(response.headers.getSetCookie().join(" ")).toContain("Max-Age=0");
  expect(
    (
      await proxy(new NextRequest(base, { headers: { cookie: first } }))
    ).headers.get("location"),
  ).toBe(`${base}/login`);
  expect(
    (
      await proxy(new NextRequest(base, { headers: { cookie: second } }))
    ).headers.get("location"),
  ).toBeNull();
  expect(await getDb().select().from(authSessions)).toHaveLength(1);
});
