import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for migrations");
}

export async function runMigrations(url?: string) {
  const connectionUrl = url ?? DATABASE_URL!;
  const client = postgres(connectionUrl, { max: 1 });
  const db = drizzle(client);

  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations complete");

  await client.end();
}

// Run directly when executed as a script
const isDirectRun = process.argv[1]?.includes("migrate");
if (isDirectRun) {
  runMigrations().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
