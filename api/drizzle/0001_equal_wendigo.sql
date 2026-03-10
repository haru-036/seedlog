CREATE TABLE `oauth_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`discord_username` text NOT NULL,
	`expires_at` integer NOT NULL
);
