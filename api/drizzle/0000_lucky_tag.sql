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
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`github_login` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_unique` ON `users` (`discord_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_login_unique` ON `users` (`github_login`);