import { expect, test } from "vitest";

import { getDb } from "@/db";
import { authUsers, contacts, type NewContact } from "@/db/schema";
import { listUpcomingBirthdays } from "@/lib/contacts/queries";

import { ensureTestOwner, TEST_OWNER_ID } from "../../../test/factories";

async function addContacts(
  ...entries: Pick<
    NewContact,
    "name" | "birthDay" | "birthMonth" | "birthYear"
  >[]
) {
  await ensureTestOwner();
  await getDb()
    .insert(contacts)
    .values(entries.map((contact) => ({ ...contact, ownerId: TEST_OWNER_ID })));
}

test("Includes today and six days ahead, excluding yesterday and the seventh day", async () => {
  await addContacts(
    { name: "Yesterday", birthDay: 26, birthMonth: 11, birthYear: 1980 },
    { name: "Today", birthDay: 27, birthMonth: 11, birthYear: 1990 },
    { name: "Six days ahead", birthDay: 3, birthMonth: 12, birthYear: 2000 },
    { name: "Seven days ahead", birthDay: 4, birthMonth: 12, birthYear: 2010 },
  );

  const results = await listUpcomingBirthdays(TEST_OWNER_ID, "2026-11-27");
  expect(results.map(({ name }) => name)).toEqual(["Today", "Six days ahead"]);
});

test("Omits contacts without a birthday", async () => {
  await addContacts(
    { name: "No birthday" },
    { name: "Today", birthDay: 27, birthMonth: 11 },
  );

  const results = await listUpcomingBirthdays(TEST_OWNER_ID, "2026-11-27");
  expect(results.map(({ name }) => name)).toEqual(["Today"]);
});

test("Includes birthdays with an unknown birth year", async () => {
  await addContacts({ name: "Anna", birthDay: 27, birthMonth: 11 });

  const results = await listUpcomingBirthdays(TEST_OWNER_ID, "2026-11-27");
  expect(results).toMatchObject([
    { name: "Anna", celebrationDate: "2026-11-27" },
  ]);
});

test("Keeps another owner's birthday out of the results", async () => {
  await addContacts({ name: "Anna", birthDay: 27, birthMonth: 11 });
  await getDb().insert(authUsers).values({
    id: "another-owner",
    name: "Another owner",
    email: "another-owner@example.test",
  });
  await getDb().insert(contacts).values({
    name: "Another contact",
    ownerId: "another-owner",
    birthDay: 27,
    birthMonth: 11,
  });

  const results = await listUpcomingBirthdays(TEST_OWNER_ID, "2026-11-27");
  expect(results.map(({ name }) => name)).toEqual(["Anna"]);
});

test("Includes February 29 only when it exists in the window", async () => {
  await addContacts({ name: "Anna", birthDay: 29, birthMonth: 2 });

  const leap = await listUpcomingBirthdays(TEST_OWNER_ID, "2028-02-26");
  expect(leap).toMatchObject([{ name: "Anna", celebrationDate: "2028-02-29" }]);
  expect(await listUpcomingBirthdays(TEST_OWNER_ID, "2027-02-26")).toEqual([]);
});

test("Sorts by celebration date rather than insertion order or birth year", async () => {
  await addContacts(
    { name: "Four days ahead", birthDay: 14, birthMonth: 5, birthYear: 1980 },
    { name: "Today", birthDay: 10, birthMonth: 5, birthYear: 2000 },
    { name: "Two days ahead", birthDay: 12, birthMonth: 5, birthYear: 1990 },
  );

  const results = await listUpcomingBirthdays(TEST_OWNER_ID, "2026-05-10");
  expect(results.map(({ name }) => name)).toEqual([
    "Today",
    "Two days ahead",
    "Four days ahead",
  ]);
});

test("Orders December and January celebrations across New Year", async () => {
  await addContacts(
    { name: "January 1", birthDay: 1, birthMonth: 1 },
    { name: "January 5", birthDay: 5, birthMonth: 1 },
    { name: "December 31", birthDay: 31, birthMonth: 12 },
    { name: "January 4", birthDay: 4, birthMonth: 1 },
  );

  const results = await listUpcomingBirthdays(TEST_OWNER_ID, "2026-12-29");
  expect(results).toMatchObject([
    { name: "December 31", celebrationDate: "2026-12-31" },
    { name: "January 1", celebrationDate: "2027-01-01" },
    { name: "January 4", celebrationDate: "2027-01-04" },
  ]);
});
