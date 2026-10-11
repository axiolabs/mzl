CREATE TYPE "public"."appeal_status" AS ENUM('open', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."participation_status" AS ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'removed');--> statement-breakpoint
CREATE TYPE "public"."plan_kind" AS ENUM('community', 'verified');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'pending_review', 'published', 'full', 'cancelled', 'finished');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('user', 'plan');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('verify_email', 'reset_password');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'approved', 'rejected', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."plan_visibility" AS ENUM('public', 'unlisted');--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"message" varchar(1000) NOT NULL,
	"status" "appeal_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" varchar(60) NOT NULL,
	"target_type" varchar(30) NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "auth_token_type" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "barrios" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"sector" varchar(80),
	"lat" double precision,
	"lng" double precision,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "barrios_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(40) NOT NULL,
	"name" varchar(60) NOT NULL,
	"icon" varchar(40) DEFAULT 'sparkles' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_address" varchar(254) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"provider" varchar(20) NOT NULL,
	"sent_at" timestamp with time zone,
	"error" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_plan_id_pk" PRIMARY KEY("user_id","plan_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider" varchar(20) DEFAULT 'db' NOT NULL,
	"mime" varchar(40) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea",
	"external_id" varchar(200),
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"title" varchar(140) NOT NULL,
	"body" varchar(400),
	"link" varchar(200),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizer_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_name" varchar(120) NOT NULL,
	"description" varchar(1000) NOT NULL,
	"evidence_url" varchar(300),
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" uuid,
	"review_note" varchar(500),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"barrio_id" integer,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "places_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "plan_participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "participation_status" DEFAULT 'pending' NOT NULL,
	"message" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"category_id" integer NOT NULL,
	"kind" "plan_kind" DEFAULT 'community' NOT NULL,
	"cover_url" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"place_id" integer,
	"location_name" varchar(140) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"capacity" integer NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"requirements" varchar(500),
	"visibility" "plan_visibility" DEFAULT 'public' NOT NULL,
	"status" "plan_status" DEFAULT 'published' NOT NULL,
	"creator_id" uuid NOT NULL,
	"moderation_note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_capacity_chk" CHECK ("plans"."accepted_count" >= 0 AND "plans"."accepted_count" <= "plans"."capacity" AND "plans"."capacity" BETWEEN 2 AND 500)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_user_id" uuid,
	"target_plan_id" uuid,
	"reason" varchar(40) NOT NULL,
	"details" varchar(1000),
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by_id" uuid,
	"resolution" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"user_id" uuid NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "user_interests_user_id_category_id_pk" PRIMARY KEY("user_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"show_barrio" boolean DEFAULT false NOT NULL,
	"show_interests" boolean DEFAULT true NOT NULL,
	"show_upcoming" boolean DEFAULT true NOT NULL,
	"use_barrio_for_recs" boolean DEFAULT false NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"username" varchar(30) NOT NULL,
	"first_name" varchar(60) NOT NULL,
	"last_name" varchar(60) NOT NULL,
	"password_hash" text NOT NULL,
	"birth_date" date NOT NULL,
	"city" varchar(60) DEFAULT 'Manizales, Caldas, Colombia' NOT NULL,
	"barrio_id" integer,
	"bio" varchar(280),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_verified_organizer" boolean DEFAULT false NOT NULL,
	"organizer_name" varchar(120),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"avatar_media_id" uuid,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_verifications" ADD CONSTRAINT "organizer_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_verifications" ADD CONSTRAINT "organizer_verifications_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_barrio_id_barrios_id_fk" FOREIGN KEY ("barrio_id") REFERENCES "public"."barrios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_participations" ADD CONSTRAINT "plan_participations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_participations" ADD CONSTRAINT "plan_participations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_plan_id_plans_id_fk" FOREIGN KEY ("target_plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_barrio_id_barrios_id_fk" FOREIGN KEY ("barrio_id") REFERENCES "public"."barrios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_media_id_media_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "verifications_status_idx" ON "organizer_verifications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_one_pending" ON "organizer_verifications" USING btree ("user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "places_geo_idx" ON "places" USING btree ("lat","lng");--> statement-breakpoint
CREATE UNIQUE INDEX "participation_unique" ON "plan_participations" USING btree ("plan_id","user_id");--> statement-breakpoint
CREATE INDEX "participation_user_idx" ON "plan_participations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "plans_status_start_idx" ON "plans" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "plans_geo_idx" ON "plans" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "plans_creator_idx" ON "plans" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "plans_category_idx" ON "plans" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");