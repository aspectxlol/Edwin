CREATE TABLE "groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"platformId" varchar(255) NOT NULL UNIQUE,
	"name" varchar(255),
	"platform" varchar(50) DEFAULT 'whatsapp' NOT NULL,
	"autoParticipate" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '{}' NOT NULL,
	"preferences" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"platformId" varchar(255) NOT NULL UNIQUE,
	"displayName" varchar(255),
	"platform" varchar(50) DEFAULT 'whatsapp' NOT NULL,
	"isOwner" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '{}' NOT NULL,
	"preferences" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
