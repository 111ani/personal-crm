import { afterEach, expect, test, vi } from "vitest";

import { sendSignInEmail } from "./mail";

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});

vi.mock("nodemailer", () => ({ default: { createTransport } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

test("The Mailpit message contains the sender, sign-in button and both explanations", async () => {
  vi.stubEnv("SMTP_HOST", "127.0.0.1");
  vi.stubEnv("SMTP_PORT", "1025");
  vi.stubEnv("SMTP_USER", "");
  vi.stubEnv("SMTP_PASSWORD", "");
  vi.stubEnv("SMTP_FROM", "noreply@mail.crm.example.test");
  await sendSignInEmail(
    "reader@example.test",
    "http://localhost:3000/auth/verify?token=example",
  );

  expect(createTransport).toHaveBeenCalledWith(
    expect.objectContaining({ port: 1025, secure: false }),
  );
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: { name: "Личная CRM", address: "noreply@mail.crm.example.test" },
      to: "reader@example.test",
      subject: "Вход в Личную CRM",
      html: expect.stringContaining(
        'href="http://localhost:3000/auth/verify?token=example">Войти</a>',
      ),
      text: expect.stringContaining(
        "Если вы не запрашивали вход - просто проигнорируйте письмо",
      ),
    }),
  );
  expect(sendMail.mock.calls[0][0].html).toContain("15 минут");
});

test("Authenticated SMTP requires an encrypted connection", async () => {
  vi.stubEnv("SMTP_HOST", "smtp.example.test");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USER", "smtp-fixture");
  vi.stubEnv("SMTP_PASSWORD", "test-only-placeholder");
  vi.stubEnv("SMTP_FROM", "noreply@mail.crm.example.test");
  await sendSignInEmail(
    "reader@example.test",
    "https://crm.example.test/auth/verify?token=example",
  );
  expect(createTransport).toHaveBeenCalledWith(
    expect.objectContaining({ port: 587, requireTLS: true }),
  );
});
