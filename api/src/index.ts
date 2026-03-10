import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "./db";

type Env = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.json({ message: "Seedlog API" });
});

app.get("/health", async (c) => {
  const db = createDb(c.env.DB);
  await db.run(sql`SELECT 1`);
  return c.json({ status: "ok" });
});

export default app;
