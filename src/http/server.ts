import { Hono } from "hono";
import { db } from "../db/client.js";
import { redisConnection } from "../queue/connection.js";
import { sql } from "drizzle-orm";

export const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/ready", async (c) => {
  try {
    await Promise.all([
      db.execute(sql`SELECT 1`),
      redisConnection.ping(),
    ]);
    return c.json({ status: "ready" }, 200);
  } catch {
    return c.json({ status: "not ready" }, 503);
  }
});
