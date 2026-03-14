import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  discordId: text("discord_id").unique(), // GitHub OAuthで作成後、Discord OAuth で紐付け
  githubLogin: text("github_login").notNull().unique(),
  githubAccessToken: text("github_access_token"),
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

export const oauthCodes = sqliteTable("oauth_codes", {
  code: text("code").primaryKey(),
  discordId: text("discord_id").notNull(),
  discordUsername: text("discord_username").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull()
});

export const logs = sqliteTable("logs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  questionId: text("question_id").references(() => questions.id), // null if manually added
  repo: text("repo"), // owner/repo
  content: text("content").notNull(),
  source: text("source")
    .$type<"github_push" | "discord_command" | "discord_reply" | "web">()
    .notNull()
    .default("web"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
});

export const episodes = sqliteTable("episodes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  prompt: text("prompt").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
});
