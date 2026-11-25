import { randomUUID } from "node:crypto";
import { expect, test, vi } from "vitest";

import {
  addNote,
  checkIn,
  clearTodayCheckIns,
  createContact,
  createGroup,
  deleteContact,
  deleteGroup,
  renameGroup,
  undoCheckIn,
  updateContact,
} from "@/app/actions";
import { getDb } from "@/db";
import {
  authUsers,
  contactCheckIns,
  contactGroups,
  contacts,
  groups,
  notes,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import {
  countContacts,
  getContactWithNotes,
  listContacts,
  listDueContacts,
} from "@/lib/contacts/queries";
import { listGroups } from "@/lib/groups/queries";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

async function fixtureAccounts() {
  const accounts = await getDb()
    .insert(authUsers)
    .values([
      { id: "account-a", name: "A", email: "a@example.test" },
      { id: "account-b", name: "B", email: "b@example.test" },
    ])
    .returning();
  return { a: accounts[0], b: accounts[1] };
}

function contactForm(name: string, groupId?: string) {
  const form = new FormData();
  form.set("name", name);
  if (groupId) form.append("groupIds", groupId);
  return form;
}

const idle = { status: "idle" } as const;

test("List, search, count and direct card reveal only the signed-in account's contacts", async () => {
  const { a, b } = await fixtureAccounts();
  const [first, second] = await getDb()
    .insert(contacts)
    .values([
      { ownerId: a.id, name: "Anna First" },
      { ownerId: b.id, name: "Boris Second" },
    ])
    .returning();
  await getDb()
    .insert(notes)
    .values({ contactId: first.id, body: "Private note" });
  expect((await listContacts(b.id, "")).map(({ id }) => id)).toEqual([
    second.id,
  ]);
  expect(await listContacts(b.id, "Anna")).toEqual([]);
  expect(await countContacts(b.id)).toBe(1);
  expect(await getContactWithNotes(b.id, first.id)).toBeNull();
  expect(await getContactWithNotes(b.id, randomUUID())).toBeNull();
  expect((await getContactWithNotes(a.id, first.id))?.notes[0].body).toBe(
    "Private note",
  );
});

test("An unauthenticated request does not change an existing contact", async () => {
  const { a } = await fixtureAccounts();
  const [contact] = await getDb()
    .insert(contacts)
    .values({ ownerId: a.id, name: "Anna" })
    .returning();
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  expect(
    await updateContact(contact.id, idle, contactForm("Changed")),
  ).toMatchObject({ status: "error" });
  expect(await getDb().select().from(contacts)).toEqual([contact]);
});

test("Foreign contact mutations are refused and leave the original contact, notes and check-ins intact", async () => {
  const { a, b } = await fixtureAccounts();
  const [contact] = await getDb()
    .insert(contacts)
    .values({ ownerId: a.id, name: "Anna" })
    .returning();
  const [note] = await getDb()
    .insert(notes)
    .values({ contactId: contact.id, body: "Original" })
    .returning();
  const [check] = await getDb()
    .insert(contactCheckIns)
    .values({ contactId: contact.id })
    .returning();
  vi.mocked(getCurrentUser).mockResolvedValue(b);
  const form = new FormData();
  form.set("body", "Changed");
  expect(await updateContact(contact.id, idle, contactForm("Changed"))).toEqual(
    await updateContact(randomUUID(), idle, contactForm("Changed")),
  );
  expect(await deleteContact(contact.id)).toMatchObject({ status: "error" });
  expect(await addNote(contact.id, idle, form)).toMatchObject({
    status: "error",
  });
  expect(await checkIn(contact.id)).toMatchObject({ status: "error" });
  expect(await undoCheckIn(check.id)).toMatchObject({ status: "error" });
  expect(await clearTodayCheckIns(contact.id)).toMatchObject({
    status: "error",
  });
  expect(await getDb().select().from(contacts)).toEqual([contact]);
  expect(await getDb().select().from(notes)).toEqual([note]);
  expect(await getDb().select().from(contactCheckIns)).toEqual([check]);
});

test("Both accounts can create their own group with the same name, and its count is account-specific", async () => {
  const { a, b } = await fixtureAccounts();
  vi.mocked(getCurrentUser).mockResolvedValue(a);
  const first = await createGroup("Friends");
  vi.mocked(getCurrentUser).mockResolvedValue(b);
  const second = await createGroup("Friends");
  expect(first.status).toBe("created");
  expect(second.status).toBe("created");
  expect((await createGroup("friends")).status).toBe("exists");
  if (second.status !== "created" || first.status !== "created")
    throw new Error("Fixture groups were not created");
  const saved = await createContact(
    idle,
    contactForm("Boris", second.group.id),
  );
  expect(saved.status).toBe("success");
  expect(await listGroups(b.id)).toEqual([
    { ...second.group, contactCount: 1 },
  ]);
  expect(await listGroups(a.id)).toEqual([{ ...first.group, contactCount: 0 }]);
  expect(await getDb().select().from(groups)).toHaveLength(2);
  expect(await getDb().select().from(contactGroups)).toHaveLength(1);
});

test("Foreign and missing groups have the same response for rename, delete and contact saves", async () => {
  const { a, b } = await fixtureAccounts();
  const [foreign, own] = await getDb()
    .insert(groups)
    .values([
      { ownerId: a.id, name: "Private group" },
      { ownerId: b.id, name: "Own group" },
    ])
    .returning();
  const [contact] = await getDb()
    .insert(contacts)
    .values({ ownerId: b.id, name: "Boris" })
    .returning();
  await getDb()
    .insert(contactGroups)
    .values({ contactId: contact.id, groupId: own.id });
  vi.mocked(getCurrentUser).mockResolvedValue(b);
  const missing = randomUUID();
  const renamed = await renameGroup(foreign.id, "Changed");
  expect(renamed).toMatchObject({ status: "error" });
  expect(renamed).toEqual(await renameGroup(missing, "Changed"));
  const deleted = await deleteGroup(foreign.id);
  expect(deleted).toMatchObject({ status: "error" });
  expect(deleted).toEqual(await deleteGroup(missing));

  for (const groupId of [foreign.id, missing]) {
    expect(
      await createContact(idle, contactForm("New contact", groupId)),
    ).toMatchObject({ status: "error" });
    expect(
      await updateContact(contact.id, idle, contactForm("Changed", groupId)),
    ).toMatchObject({ status: "error" });
  }
  expect(await getDb().select().from(contacts)).toEqual([contact]);
  expect(await getDb().select().from(groups)).toContainEqual(foreign);
  expect(await getDb().select().from(contactGroups)).toEqual([
    { contactId: contact.id, groupId: own.id },
  ]);
});

test("A check-in removes the current owner's reminder while the other owner's reminder stays", async () => {
  const { a, b } = await fixtureAccounts();
  const old = new Date("2020-01-01");
  const [first, second] = await getDb()
    .insert(contacts)
    .values([
      {
        ownerId: a.id,
        name: "Anna",
        contactFrequency: "week",
        contactFrequencySetAt: old,
      },
      {
        ownerId: b.id,
        name: "Boris",
        contactFrequency: "week",
        contactFrequencySetAt: old,
      },
    ])
    .returning();
  expect((await listDueContacts(b.id)).map(({ id }) => id)).toEqual([
    second.id,
  ]);
  vi.mocked(getCurrentUser).mockResolvedValue(b);
  expect((await checkIn(second.id)).status).toBe("success");
  expect(await listDueContacts(b.id)).toEqual([]);
  expect((await listDueContacts(a.id)).map(({ id }) => id)).toEqual([first.id]);
});

test("An account can save its own contact, group, note and check-in together", async () => {
  const { a } = await fixtureAccounts();
  vi.mocked(getCurrentUser).mockResolvedValue(a);
  const group = await createGroup("Friends");
  if (group.status !== "created")
    throw new Error("Could not create fixture group");
  const created = await createContact(
    idle,
    contactForm("Anna", group.group.id),
  );
  if (created.status !== "success")
    throw new Error("Could not create fixture contact");
  const data = contactForm("Anna", group.group.id);
  data.set("contactFrequency", "week");
  expect((await updateContact(created.contactId, idle, data)).status).toBe(
    "success",
  );
  const note = new FormData();
  note.set("body", "Called Anna");
  expect((await addNote(created.contactId, idle, note)).status).toBe("success");
  expect((await checkIn(created.contactId)).status).toBe("success");
  const card = await getContactWithNotes(a.id, created.contactId);
  expect(card).toMatchObject({
    groupIds: [group.group.id],
    notes: [{ body: "Called Anna" }],
    due: { checkedInToday: true },
  });
  expect(await listGroups(a.id)).toMatchObject([
    { id: group.group.id, contactCount: 1 },
  ]);
});
