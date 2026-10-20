import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";

// Smoke check for deploys: 200 when the app runs and the database answers
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed: database is unavailable", error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
