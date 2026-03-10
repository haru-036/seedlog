import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "./db";
import { usersRoute } from "./routes/users";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.json({ message: "Seedlog API" });
});

app.get("/health", async (c) => {
  const db = createDb(c.env.DB);
  await db.run(sql`SELECT 1`);
  return c.json({ status: "ok" });
});

app.route("/api/users", usersRoute);

export default app;
