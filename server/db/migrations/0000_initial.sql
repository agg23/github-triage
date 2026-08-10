CREATE TABLE `item_details` (
	`item_id` text PRIMARY KEY NOT NULL,
	`body_html` text NOT NULL,
	`comments` text NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`additions` integer,
	`deletions` integer,
	`changed_files` integer,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item_state` (
	`item_id` text PRIMARY KEY NOT NULL,
	`wake_at` text,
	`wake_on_activity_after` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` integer NOT NULL,
	`repo` text NOT NULL,
	`number` integer NOT NULL,
	`type` text NOT NULL,
	`state` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`author` text NOT NULL,
	`author_type` text NOT NULL,
	`is_draft` integer DEFAULT false NOT NULL,
	`labels` text NOT NULL,
	`assignees` text NOT NULL,
	`participants` text DEFAULT '[]' NOT NULL,
	`reviewers` text DEFAULT '[]' NOT NULL,
	`review_requests` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	`last_actor` text NOT NULL,
	`last_actor_type` text NOT NULL,
	`last_activity_at` text NOT NULL,
	`last_action_kind` text,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`github_token` text,
	`token_login` text,
	`me` text DEFAULT '' NOT NULL,
	`team_members` text DEFAULT '[]' NOT NULL,
	`trusted_contributors` text DEFAULT '[]' NOT NULL,
	`bots` text DEFAULT '[]' NOT NULL,
	`new_within_hours` integer DEFAULT 24 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`repo` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`backfill_days` integer DEFAULT 30 NOT NULL,
	`last_synced_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`rules` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
