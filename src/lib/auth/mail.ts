import "server-only";

import nodemailer from "nodemailer";

import { normalizeEmail } from "./email";

const expiration = "Ссылка действует 15 минут.";
const unsolicited =
  "Если вы не запрашивали вход - просто проигнорируйте письмо";

export async function sendSignInEmail(email: string, url: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = normalizeEmail(process.env.SMTP_FROM);
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !from ||
    Boolean(user) !== Boolean(pass)
  ) {
    throw new Error("SMTP settings are incomplete or invalid");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: Boolean(user) && port !== 465,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const href = url
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  await transport.sendMail({
    from: { name: "Личная CRM", address: from },
    to: email,
    subject: "Вход в Личную CRM",
    text: `Войти: ${url}\n\n${expiration}\n\n${unsolicited}`,
    html: `<p><a style="display:inline-block;padding:12px 24px;border:1px solid;border-radius:8px;text-decoration:none" href="${href}">Войти</a></p><p>${expiration}</p><p>${unsolicited}</p>`,
  });
}
