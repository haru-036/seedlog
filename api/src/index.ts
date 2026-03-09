import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createSeedLogSchema } from "@seedlog/schema";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ message: "Seedlog API" });
});

export default app;
