import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "./db";
import { authRoute } from "./routes/auth";
import { episodesRoute } from "./routes/episodes";
import { githubRoute } from "./routes/github";
import { interactionsRoute } from "./routes/interactions";
import { logsRoute } from "./routes/logs";
import { usersRoute } from "./routes/users";
import { webhooksRoute } from "./routes/webhooks";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.json({ message: "Seedlog API" });
});

app.get("/health", async (c) => {
  const db = createDb(c.env.DB);
  await db.run(sql`SELECT 1`);
  return c.json({ status: "ok" });
});

app.route("/api/auth", authRoute);
app.route("/api/users", usersRoute);
app.route("/api/webhooks", githubRoute);
app.route("/api/webhooks", webhooksRoute);
app.route("/api/interactions", interactionsRoute);
app.route("/api/logs", logsRoute);
app.route("/api/episodes", episodesRoute);

export default app;
