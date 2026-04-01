CREATE TYPE "public"."summary_type" AS ENUM('daily_standup', 'overdue_nudge', 'weekly_report');--> statement-breakpoint
ALTER TABLE "daily_summaries" DROP CONSTRAINT "uq_team_summary_date";--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD COLUMN "summary_type" "summary_type" DEFAULT 'daily_standup' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "uq_team_summary_date_type" UNIQUE("team_id","summary_date","summary_type");