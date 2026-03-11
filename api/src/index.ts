import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db";
import { authRoute } from "./routes/auth";
import { episodesRoute } from "./routes/episodes";
import { githubRoute } from "./routes/github";
import { interactionsRoute } from "./routes/interactions";
import { logsRoute } from "./routes/logs";
import { reposRoute } from "./routes/repos";
import { usersRoute } from "./routes/users";
import { webhooksRoute } from "./routes/webhooks";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("/api/*", async (c, next) => {
  const handler = cors({
    origin: c.env.FRONTEND_URL,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true
  });
  return handler(c, next);
});

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
app.route("/api/repos", reposRoute);

export default app;
