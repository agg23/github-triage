ALTER TABLE `items` ADD `mergeable` text;--> statement-breakpoint
ALTER TABLE `items` ADD `conflicted_since` text;--> statement-breakpoint
ALTER TABLE `items` ADD `activity_at` text GENERATED ALWAYS AS (max(last_activity_at, coalesce(conflicted_since, ''))) VIRTUAL;
