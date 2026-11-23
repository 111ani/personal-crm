// Runs once before all tests: makes sure the test database exists and has
// all migrations applied.

import { getTestDatabaseUrl } from "./database-url";
import { prepareTestDatabase } from "./test-database";

export default async function setup() {
  await prepareTestDatabase(getTestDatabaseUrl());
}
