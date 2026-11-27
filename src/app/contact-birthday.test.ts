import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

import { updateContact } from "@/app/actions";
import { getDb } from "@/db";
import { contacts } from "@/db/schema";
import { getContactWithNotes } from "@/lib/contacts/queries";

import { insertContact, TEST_OWNER_ID } from "../../test/factories";
import { cardForm, idle } from "../../test/keep-in-touch";

const savedBirthday = { birthDay: 16, birthMonth: 5, birthYear: 1990 };

function birthdayForm(birthDay: string, birthMonth: string, birthYear = "") {
  const form = cardForm({ name: "Anna" });
  form.set("birthDay", birthDay);
  form.set("birthMonth", birthMonth);
  form.set("birthYear", birthYear);
  return form;
}

async function contactWithSavedBirthday() {
  const id = await insertContact("Anna");
  await getDb().update(contacts).set(savedBirthday).where(eq(contacts.id, id));
  return id;
}

async function readContact(id: string) {
  return (await getContactWithNotes(TEST_OWNER_ID, id))?.contact;
}

test("Saves a full birthday in the contact card", async () => {
  const id = await insertContact("Anna");
  const result = await updateContact(id, idle, birthdayForm("16", "5", "1990"));

  expect(result.status).toBe("success");
  expect(await readContact(id)).toMatchObject(savedBirthday);
});

test("Saves a birthday without a year", async () => {
  const id = await insertContact("Anna");
  const result = await updateContact(id, idle, birthdayForm("16", "05"));

  expect(result.status).toBe("success");
  expect(await readContact(id)).toMatchObject({
    ...savedBirthday,
    birthYear: null,
  });
});

test("Edits an existing birthday", async () => {
  const id = await contactWithSavedBirthday();
  const result = await updateContact(id, idle, birthdayForm("18", "6", "1991"));

  expect(result.status).toBe("success");
  expect(await readContact(id)).toMatchObject({
    birthDay: 18,
    birthMonth: 6,
    birthYear: 1991,
  });
});

test("Clears only the year of an existing birthday", async () => {
  const id = await contactWithSavedBirthday();
  const result = await updateContact(id, idle, birthdayForm("16", "5"));

  expect(result.status).toBe("success");
  expect(await readContact(id)).toMatchObject({
    ...savedBirthday,
    birthYear: null,
  });
});

test("Clears a birthday when all three fields are empty", async () => {
  const id = await contactWithSavedBirthday();
  const result = await updateContact(id, idle, birthdayForm("", ""));

  expect(result.status).toBe("success");
  expect(await readContact(id)).toMatchObject({
    birthDay: null,
    birthMonth: null,
    birthYear: null,
  });
});

test("Keeps the birthday if an older form does not include its fields", async () => {
  const id = await contactWithSavedBirthday();
  const result = await updateContact(id, idle, cardForm({ name: "Anna" }));

  expect(result.status).toBe("success");
  expect(await readContact(id)).toMatchObject(savedBirthday);
});

test.each([
  { birthYear: "", year: null },
  { birthYear: "2000", year: 2000 },
])(
  "Accepts February 29 with year '$birthYear'",
  async ({ birthYear, year }) => {
    const id = await insertContact("Anna");
    const result = await updateContact(
      id,
      idle,
      birthdayForm("29", "2", birthYear),
    );

    expect(result.status).toBe("success");
    expect(await readContact(id)).toMatchObject({
      birthDay: 29,
      birthMonth: 2,
      birthYear: year,
    });
  },
);

test.each([
  { birthDay: "31", birthMonth: "4", birthYear: "" },
  { birthDay: "29", birthMonth: "2", birthYear: "1900" },
  { birthDay: "16", birthMonth: "", birthYear: "" },
  { birthDay: "", birthMonth: "5", birthYear: "" },
  { birthDay: "", birthMonth: "", birthYear: "1990" },
  { birthDay: "2e1", birthMonth: "5", birthYear: "" },
])(
  "Rejects invalid birthday $birthDay/$birthMonth/$birthYear and keeps the old date",
  async (values) => {
    const id = await contactWithSavedBirthday();
    const form = birthdayForm(
      values.birthDay,
      values.birthMonth,
      values.birthYear,
    );
    form.set("name", "Changed");
    const result = await updateContact(id, idle, form);

    expect(result).toMatchObject({
      status: "error",
      birthDate: values,
      birthDateError: expect.any(String),
    });
    expect(await readContact(id)).toMatchObject({
      name: "Anna",
      ...savedBirthday,
    });
  },
);
