// Runs once before the e2e tests: makes sure the e2e database exists and has
// all migrations applied. The app server is already up by then; it connects
// to the database only on the first request.

import { getE2eDatabaseUrl } from "../test/database-url";
import { prepareTestDatabase } from "../test/test-database";

export default async function globalSetup() {
  await prepareTestDatabase(getE2eDatabaseUrl());
}
