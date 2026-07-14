import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique(),
  name: text("name").notNull(),
  legacyClaimedAt: timestamp("legacy_claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  engine: text("engine").notNull().default("nodriver"),
  flowType: text("flow_type").notNull().default("otp"),
  fields: jsonb("fields").notNull().default([]),
  defaultConfig: jsonb("default_config").notNull().default({}),
  scenarioSteps: jsonb("scenario_steps").notNull().default([]),
  scenarioDefinition: jsonb("scenario_definition").notNull().default({
    version: 1,
    name: "Untitled scenario",
    steps: [],
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const bots = pgTable("bots", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  name: text("name").notNull(),
  templateId: text("template_id").notNull(),
  targetUrl: text("target_url").notNull().default(""),
  status: text("status").notNull().default("idle"),
  workers: integer("workers").notNull().default(1),
  config: jsonb("config").notNull().default({}),
  scenarioDraft: jsonb("scenario_draft"),
  scenarioPublished: jsonb("scenario_published"),
  scenarioStatus: text("scenario_status").notNull().default("published"),
  publishedScenarioVersionId: text("published_scenario_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const scenarioVersions = pgTable("scenario_versions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  botId: text("bot_id").notNull(),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  author: text("author").notNull().default("system"),
  changeSummary: text("change_summary").notNull().default(""),
  sourceVersionId: text("source_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const botRefs = pgTable("bot_refs", {
  id: serial("id").primaryKey(),
  workspaceId: text("workspace_id"),
  botId: text("bot_id").notNull(),
  url: text("url").notNull(),
  successLimit: integer("success_limit").notNull().default(10),
  successCount: integer("success_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  status: text("status").notNull().default("active"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  botId: text("bot_id").notNull(),
  status: text("status").notNull().default("queued"),
  totalWorkers: integer("total_workers").notNull().default(1),
  successCount: integer("success_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error"),
  agentId: text("agent_id"),
  scenarioVersionId: text("scenario_version_id"),
  scheduleId: text("schedule_id"),
  scheduleFiringId: text("schedule_firing_id"),
  source: text("source").notNull().default("manual"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  attempt: integer("attempt").notNull().default(0),
  maxInfraAttempts: integer("max_infra_attempts").notNull().default(3),
  leaseOwnerAgentId: text("lease_owner_agent_id"),
  leaseTokenHash: text("lease_token_hash"),
  leasedAt: timestamp("leased_at", { withTimezone: true }),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  failureKind: text("failure_kind"),
  failureCode: text("failure_code"),
  recoveredCount: integer("recovered_count").notNull().default(0),
  retryOfRunId: text("retry_of_run_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  retentionHold: boolean("retention_hold").notNull().default(false),
  scenarioSnapshot: jsonb("scenario_snapshot").notNull().default({
    version: 1,
    name: "Untitled scenario",
    steps: [],
  }),
  cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const runAttempts = pgTable("run_attempts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  runId: text("run_id").notNull(),
  agentId: text("agent_id").notNull(),
  attempt: integer("attempt").notNull(),
  leaseTokenHash: text("lease_token_hash").notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  outcome: text("outcome"),
  failureKind: text("failure_kind"),
  failureCode: text("failure_code"),
  recoveryReason: text("recovery_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const logSteps = pgTable("log_steps", {
  id: serial("id").primaryKey(),
  workspaceId: text("workspace_id"),
  runId: text("run_id").notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  worker: integer("worker").notNull().default(0),
  level: text("level").notNull().default("info"),
  step: text("step").notNull().default(""),
  message: text("message").notNull().default(""),
  durationMs: integer("duration_ms").notNull().default(0),
  attempt: integer("attempt").notNull().default(1),
  runAttempt: integer("run_attempt").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
})

export const runArtifacts = pgTable("run_artifacts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  runId: text("run_id").notNull(),
  agentId: text("agent_id").notNull(),
  worker: integer("worker").notNull().default(0),
  stepId: text("step_id"),
  kind: text("kind").notNull(),
  pathname: text("pathname").notNull().unique(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull().default(0),
  redacted: boolean("redacted").notNull().default(true),
  metadata: jsonb("metadata").notNull().default({}),
  runAttempt: integer("run_attempt").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionHold: boolean("retention_hold").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const schedules = pgTable("schedules", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  botId: text("bot_id").notNull(),
  kind: text("kind").notNull(),
  intervalMinutes: integer("interval_minutes"),
  timeOfDay: text("time_of_day"),
  weekdays: jsonb("weekdays").notNull().default([]),
  timezone: text("timezone").notNull().default("UTC"),
  enabled: boolean("enabled").notNull().default(true),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const scheduleFirings = pgTable("schedule_firings", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  plannedAt: timestamp("planned_at", { withTimezone: true }).notNull(),
  runId: text("run_id"),
  status: text("status").notNull().default("created"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  runId: text("run_id"),
  scheduleId: text("schedule_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  notificationId: text("notification_id").notNull(),
  channel: text("channel").notNull().default("email"),
  recipient: text("recipient").notNull(),
  status: text("status").notNull().default("pending"),
  providerMessageId: text("provider_message_id"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const testOtpChallenges = pgTable("test_otp_challenges", {
  id: text("id").primaryKey(),
  mailboxToken: text("mailbox_token").notNull().unique(),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
})

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  name: text("name").notNull(),
  apiKey: text("api_key"),
  apiKeyHash: text("api_key_hash"),
  keyPrefix: text("key_prefix"),
  keyCreatedAt: timestamp("key_created_at", { withTimezone: true }),
  os: text("os").notNull().default(""),
  protocolVersion: integer("protocol_version").notNull().default(1),
  capabilities: jsonb("capabilities").notNull().default([]),
  status: text("status").notNull().default("offline"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof user.$inferSelect
export type Workspace = typeof workspaces.$inferSelect
export type Template = typeof templates.$inferSelect
export type Bot = typeof bots.$inferSelect
export type BotRef = typeof botRefs.$inferSelect
export type ScenarioVersion = typeof scenarioVersions.$inferSelect
export type Run = typeof runs.$inferSelect
export type RunAttempt = typeof runAttempts.$inferSelect
export type LogStep = typeof logSteps.$inferSelect
export type RunArtifact = typeof runArtifacts.$inferSelect
export type Agent = typeof agents.$inferSelect
export type Schedule = typeof schedules.$inferSelect
export type ScheduleFiring = typeof scheduleFirings.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect
export type TestOtpChallenge = typeof testOtpChallenges.$inferSelect
