CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`target_id` text NOT NULL,
	`target_type` text NOT NULL,
	`seconds` real,
	`body` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`mime` text NOT NULL,
	`sha` text NOT NULL,
	`target_id` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`member_id` text NOT NULL,
	`seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`tag` text NOT NULL,
	`link` text NOT NULL,
	`version` integer NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`started` integer NOT NULL,
	`heartbeat` integer NOT NULL,
	`ended` integer,
	`video_id` text,
	`dataset` text NOT NULL,
	`commit_ref` text NOT NULL,
	`duration` real,
	`recording` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`payload` text NOT NULL,
	`created` integer NOT NULL
);
