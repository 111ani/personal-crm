ALTER TABLE "contacts" ADD COLUMN "birth_day" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_month" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_date_parts_check" CHECK (("contacts"."birth_day" is null) = ("contacts"."birth_month" is null) and ("contacts"."birth_year" is null or "contacts"."birth_day" is not null));