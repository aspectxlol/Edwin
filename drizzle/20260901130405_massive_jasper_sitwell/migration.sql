ALTER TABLE "notes" ADD COLUMN "recipientId" varchar(255);--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "conversationId" varchar(255);--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "recipientId" varchar(255);