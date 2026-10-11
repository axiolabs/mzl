import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const roleEnum = pgEnum("user_role", ["user", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const planKindEnum = pgEnum("plan_kind", ["community", "verified"]);
export const planStatusEnum = pgEnum("plan_status", [
  "draft",
  "pending_review",
  "published",
  "full",
  "cancelled",
  "finished",
]);
export const visibilityEnum = pgEnum("plan_visibility", ["public", "unlisted"]);
export const participationStatusEnum = pgEnum("participation_status", [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
  "removed",
]);
export const tokenTypeEnum = pgEnum("auth_token_type", ["verify_email", "reset_password"]);
export const reportTargetEnum = pgEnum("report_target", ["user", "plan"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "reviewing", "resolved", "dismissed"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "approved", "rejected", "revoked"]);
export const appealStatusEnum = pgEnum("appeal_status", ["open", "accepted", "rejected"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const barrios = pgTable("barrios", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  sector: varchar("sector", { length: 80 }),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  active: boolean("active").notNull().default(true),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 60 }).notNull(),
  icon: varchar("icon", { length: 40 }).notNull().default("sparkles"),
  active: boolean("active").notNull().default(true),
});

export const places = pgTable(
  "places",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull().unique(),
    description: text("description"),
    barrioId: integer("barrio_id").references(() => barrios.id, { onDelete: "set null" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("places_geo_idx").on(t.lat, t.lng)],
);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 20 }).notNull().default("db"),
  mime: varchar("mime", { length: 40 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  size: integer("size").notNull(),
  data: bytea("data"),
  externalId: varchar("external_id", { length: 200 }),
  url: text("url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    username: varchar("username", { length: 30 }).notNull().unique(),
    firstName: varchar("first_name", { length: 60 }).notNull(),
    lastName: varchar("last_name", { length: 60 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    birthDate: date("birth_date").notNull(),
    city: varchar("city", { length: 60 }).notNull().default("Manizales, Caldas, Colombia"),
    barrioId: integer("barrio_id").references(() => barrios.id, { onDelete: "set null" }),
    bio: varchar("bio", { length: 280 }),
    role: roleEnum("role").notNull().default("user"),
    isVerifiedOrganizer: boolean("is_verified_organizer").notNull().default(false),
    organizerName: varchar("organizer_name", { length: 120 }),
    status: userStatusEnum("status").notNull().default("active"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    avatarMediaId: uuid("avatar_media_id").references(() => media.id, { onDelete: "set null" }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("users_status_idx").on(t.status)],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  showBarrio: boolean("show_barrio").notNull().default(false),
  showInterests: boolean("show_interests").notNull().default(true),
  showUpcoming: boolean("show_upcoming").notNull().default(true),
  useBarrioForRecommendations: boolean("use_barrio_for_recs").notNull().default(false),
  emailNotifications: boolean("email_notifications").notNull().default(true),
});

export const userInterests = pgTable(
  "user_interests",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.categoryId] })],
);

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // sha256(token)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: varchar("user_agent", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: tokenTypeEnum("type").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.type)],
);

export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 100 }).notNull(),
    description: text("description").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    kind: planKindEnum("kind").notNull().default("community"),
    coverUrl: text("cover_url"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    placeId: integer("place_id").references(() => places.id, { onDelete: "set null" }),
    locationName: varchar("location_name", { length: 140 }).notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    capacity: integer("capacity").notNull(),
    acceptedCount: integer("accepted_count").notNull().default(0),
    requirements: varchar("requirements", { length: 500 }),
    visibility: visibilityEnum("visibility").notNull().default("public"),
    status: planStatusEnum("status").notNull().default("published"),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moderationNote: varchar("moderation_note", { length: 500 }),
    ...timestamps,
  },
  (t) => [
    index("plans_status_start_idx").on(t.status, t.startsAt),
    index("plans_geo_idx").on(t.lat, t.lng),
    index("plans_creator_idx").on(t.creatorId),
    index("plans_category_idx").on(t.categoryId),
    check("plans_capacity_chk", sql`${t.acceptedCount} >= 0 AND ${t.acceptedCount} <= ${t.capacity} AND ${t.capacity} BETWEEN 2 AND 500`),
  ],
);

export const planParticipations = pgTable(
  "plan_participations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: participationStatusEnum("status").notNull().default("pending"),
    message: varchar("message", { length: 300 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("participation_unique").on(t.planId, t.userId),
    index("participation_user_idx").on(t.userId, t.status),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.planId] })],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 140 }).notNull(),
    body: varchar("body", { length: 400 }),
    link: varchar("link", { length: 200 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: reportTargetEnum("target_type").notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }),
    targetPlanId: uuid("target_plan_id").references(() => plans.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 40 }).notNull(),
    details: varchar("details", { length: 1000 }),
    status: reportStatusEnum("status").notNull().default("open"),
    resolvedById: uuid("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolution: varchar("resolution", { length: 500 }),
    ...timestamps,
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt)],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const organizerVerifications = pgTable(
  "organizer_verifications",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationName: varchar("organization_name", { length: 120 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    evidenceUrl: varchar("evidence_url", { length: 300 }),
    status: verificationStatusEnum("status").notNull().default("pending"),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewNote: varchar("review_note", { length: 500 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("verifications_status_idx").on(t.status),
    uniqueIndex("verifications_one_pending").on(t.userId).where(sql`status = 'pending'`),
  ],
);

export const appeals = pgTable("appeals", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: varchar("message", { length: 1000 }).notNull(),
  status: appealStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    targetType: varchar("target_type", { length: 30 }).notNull(),
    targetId: varchar("target_id", { length: 64 }).notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    note: varchar("note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const emailOutbox = pgTable("email_outbox", {
  id: serial("id").primaryKey(),
  to: varchar("to_address", { length: 254 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  provider: varchar("provider", { length: 20 }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  error: varchar("error", { length: 300 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
