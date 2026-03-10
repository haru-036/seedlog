import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // nanoid で生成される一意の識別子（Discord ID は discordId フィールドに格納）
  discordId: text("discord_id").notNull().unique(),
  githubLogin: text("github_login").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  // GitHub push info
  githubRepo: text("github_repo").notNull(),
  commitSha: text("commit_sha").notNull(),
  changedFiles: text("changed_files").notNull(), // JSON array of file paths
  // Generated question
  questionText: text("question_text").notNull(),
  // Discord message ID for tracking the DM
  discordMessageId: text("discord_message_id"),
  answeredAt: integer("answered_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
});

export const logs = sqliteTable("logs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  questionId: text("question_id").references(() => questions.id), // null if manually added
  content: text("content").notNull(),
  source: text("source")
    .$type<"github_push" | "discord_command" | "web">()
    .notNull()
    .default("web"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
});
