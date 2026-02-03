CREATE TABLE IF NOT EXISTS "RobinhoodSession" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"accountId" text,
	"accountUrl" text,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RobinhoodSession" ADD CONSTRAINT "RobinhoodSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
