import { expect } from "@playwright/test";

export type MailpitMessage = {
  ID: string;
  To: Array<{ Address: string }>;
  From: { Address: string; Name: string };
  Subject: string;
  HTML: string;
  Text: string;
};

export async function findMessages(email: string) {
  const url = new URL(
    "/api/v1/search",
    process.env.MAILPIT_URL ?? "http://127.0.0.1:8025",
  );
  url.searchParams.set("query", `to:"${email}"`);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Mailpit search failed (${response.status})`);
  const data: { messages: Array<Pick<MailpitMessage, "ID" | "To">> | null } =
    await response.json();
  return (data.messages ?? []).filter((message) =>
    message.To.some(({ Address }) => Address === email),
  );
}

export async function waitForMessage(
  email: string,
  previousIds: string[] = [],
): Promise<MailpitMessage> {
  let id: string | undefined;
  await expect
    .poll(async () => {
      id = (await findMessages(email)).find(
        (message) => !previousIds.includes(message.ID),
      )?.ID;
      return Boolean(id);
    })
    .toBe(true);
  const url = new URL(
    `/api/v1/message/${id}`,
    process.env.MAILPIT_URL ?? "http://127.0.0.1:8025",
  );
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Mailpit message request failed (${response.status})`);
  return response.json();
}
