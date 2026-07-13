import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

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
  botId: text("bot_id").notNull(),
  status: text("status").notNull().default("queued"),
  totalWorkers: integer("total_workers").notNull().default(1),
  successCount: integer("success_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error"),
  agentId: text("agent_id"),
  scenarioVersionId: text("scenario_version_id"),
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

export const logSteps = pgTable("log_steps", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  worker: integer("worker").notNull().default(0),
  level: text("level").notNull().default("info"),
  step: text("step").notNull().default(""),
  message: text("message").notNull().default(""),
  durationMs: integer("duration_ms").notNull().default(0),
  attempt: integer("attempt").notNull().default(1),
  metadata: jsonb("metadata").notNull().default({}),
})

export const runArtifacts = pgTable("run_artifacts", {
  id: text("id").primaryKey(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  name: text("name").notNull(),
  apiKey: text("api_key").notNull().unique(),
  os: text("os").notNull().default(""),
  status: text("status").notNull().default("offline"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Template = typeof templates.$inferSelect
export type Bot = typeof bots.$inferSelect
export type BotRef = typeof botRefs.$inferSelect
export type ScenarioVersion = typeof scenarioVersions.$inferSelect
export type Run = typeof runs.$inferSelect
export type LogStep = typeof logSteps.$inferSelect
export type RunArtifact = typeof runArtifacts.$inferSelect
export type Agent = typeof agents.$inferSelect
export type TestOtpChallenge = typeof testOtpChallenges.$inferSelect
