CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_requests" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"current" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DROP INDEX "contacts_name_idx";--> statement-breakpoint
DROP INDEX "groups_name_lower_idx";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "owner_id" text;--> statement-breakpoint
DO $$
DECLARE
	owner_email text := nullif(current_setting('crm.owner_email', true), '');
	legacy_owner_id text;
BEGIN
	IF EXISTS (SELECT FROM "contacts") OR EXISTS (SELECT FROM "groups") THEN
		IF owner_email IS NULL THEN
			RAISE EXCEPTION 'CRM_OWNER_EMAIL is required to migrate existing contacts or groups'
				USING ERRCODE = 'CR001';
		END IF;

		INSERT INTO "auth_user" ("id", "name", "email")
		VALUES (gen_random_uuid()::text, owner_email, owner_email)
		RETURNING "id" INTO legacy_owner_id;

		UPDATE "contacts" SET "owner_id" = legacy_owner_id;
		UPDATE "groups" SET "owner_id" = legacy_owner_id;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "magic_link_requests_email_issued_idx" ON "magic_link_requests" USING btree ("email","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_link_requests_current_email_idx" ON "magic_link_requests" USING btree ("email") WHERE "magic_link_requests"."current";--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_auth_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_auth_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_owner_name_idx" ON "contacts" USING btree ("owner_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_owner_name_lower_idx" ON "groups" USING btree ("owner_id",lower("name"));
