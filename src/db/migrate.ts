import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client.js";
import { logger } from "../lib/logger.js";

export async function runMigrations() {
  logger.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "drizzle" });
  logger.info("Migrations complete");
}
