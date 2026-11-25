import { expect, test, vi } from "vitest";

import { requestSignIn } from "./actions";

const { requestMagicLink } = vi.hoisted(() => ({ requestMagicLink: vi.fn() }));
vi.mock("@/lib/auth/magic-link", () => ({ requestMagicLink }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

test("The form reports an invalid email next to the address field", async () => {
  requestMagicLink.mockResolvedValueOnce({ status: "invalid" });
  const form = new FormData();
  form.set("email", "invalid");
  expect(await requestSignIn({ status: "idle" }, form)).toEqual({
    status: "invalid",
    email: "invalid",
  });
});

test("The form confirms the normalized address", async () => {
  requestMagicLink.mockResolvedValueOnce({
    status: "sent",
    email: "reader@example.test",
  });
  const form = new FormData();
  form.set("email", " READER@Example.Test ");
  expect(await requestSignIn({ status: "idle" }, form)).toEqual({
    status: "sent",
    email: "reader@example.test",
  });
});
