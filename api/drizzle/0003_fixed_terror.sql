-- D1 では PRAGMA foreign_keys=OFF が別ステートメントに持続しないため
-- 子テーブル(logs, questions)を先にバックアップして drop し、users を再作成する

-- Step 1: データをバックアップ
CREATE TABLE `__backup_users` (
`id` text NOT NULL,
`discord_id` text,
`github_login` text NOT NULL,
`github_access_token` text,
`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__backup_users` SELECT `id`, `discord_id`, `github_login`, `github_access_token`, `created_at` FROM `users`;
--> statement-breakpoint
CREATE TABLE `__backup_questions` (
`id` text NOT NULL,
`user_id` text NOT NULL,
`github_repo` text NOT NULL,
`commit_sha` text NOT NULL,
`changed_files` text NOT NULL,
`question_text` text NOT NULL,
`discord_message_id` text,
`answered_at` integer,
`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__backup_questions` SELECT `id`, `user_id`, `github_repo`, `commit_sha`, `changed_files`, `question_text`, `discord_message_id`, `answered_at`, `created_at` FROM `questions`;
--> statement-breakpoint
CREATE TABLE `__backup_logs` (
`id` text NOT NULL,
`user_id` text NOT NULL,
`question_id` text,
`content` text NOT NULL,
`source` text NOT NULL,
`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__backup_logs` SELECT `id`, `user_id`, `question_id`, `content`, `source`, `created_at` FROM `logs`;
--> statement-breakpoint

-- Step 2: FK 制約を持つ子テーブルから順に drop
DROP TABLE `logs`;
--> statement-breakpoint
DROP TABLE `questions`;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint

-- Step 3: users を discord_id nullable で再作成
CREATE TABLE `users` (
`id` text PRIMARY KEY NOT NULL,
`discord_id` text,
`github_login` text NOT NULL,
`github_access_token` text,
`created_at` integer NOT NULL
);
--> statement-breakpoint

-- Step 4: questions, logs を再作成
CREATE TABLE `questions` (
`id` text PRIMARY KEY NOT NULL,
`user_id` text NOT NULL,
`github_repo` text NOT NULL,
`commit_sha` text NOT NULL,
`changed_files` text NOT NULL,
`question_text` text NOT NULL,
`discord_message_id` text,
`answered_at` integer,
`created_at` integer NOT NULL,
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `logs` (
`id` text PRIMARY KEY NOT NULL,
`user_id` text NOT NULL,
`question_id` text,
`content` text NOT NULL,
`source` text DEFAULT 'web' NOT NULL,
`created_at` integer NOT NULL,
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Step 5: データを復元
INSERT INTO `users` SELECT `id`, `discord_id`, `github_login`, `github_access_token`, `created_at` FROM `__backup_users`;
--> statement-breakpoint
INSERT INTO `questions` SELECT `id`, `user_id`, `github_repo`, `commit_sha`, `changed_files`, `question_text`, `discord_message_id`, `answered_at`, `created_at` FROM `__backup_questions`;
--> statement-breakpoint
INSERT INTO `logs` SELECT `id`, `user_id`, `question_id`, `content`, `source`, `created_at` FROM `__backup_logs`;
--> statement-breakpoint

-- Step 6: バックアップテーブルを削除
DROP TABLE `__backup_logs`;
--> statement-breakpoint
DROP TABLE `__backup_questions`;
--> statement-breakpoint
DROP TABLE `__backup_users`;
--> statement-breakpoint

-- Step 7: インデックスを再作成
CREATE UNIQUE INDEX `users_discord_id_unique` ON `users` (`discord_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_login_unique` ON `users` (`github_login`);
