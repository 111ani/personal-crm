// How often to keep in touch with a contact. The one list for the form check,
// the database CHECK and the list in the card. No dependencies: the browser
// and plain Node scripts (scripts/seed.ts via src/db/schema.ts) import it too
export const contactFrequencies = ["week", "month", "quarter", "year"] as const;

export type ContactFrequency = (typeof contactFrequencies)[number];
