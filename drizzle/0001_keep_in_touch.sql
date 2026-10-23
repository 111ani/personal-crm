CREATE TABLE "contact_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "contact_frequency" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "contact_frequency_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_check_ins" ADD CONSTRAINT "contact_check_ins_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_check_ins_contact_id_created_at_idx" ON "contact_check_ins" USING btree ("contact_id","created_at");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_frequency_check" CHECK ("contacts"."contact_frequency" in ('week', 'month', 'quarter', 'year'));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_frequency_set_at_check" CHECK (("contacts"."contact_frequency" is null) = ("contacts"."contact_frequency_set_at" is null));