import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

// Personal single-user tool: no auth, no workspaces, no agents/queue/lease.
// Bots run locally via `python bot.py` (see lib/local-runner.ts).

export const aiProviders = pgTable("ai_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  providerType: text("provider_type").notNull().default("openai-compatible"),
  baseUrl: text("base_url").notNull(),
  modelId: text("model_id").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  keyPrefix: text("key_prefix").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),
  lastTestStatus: text("last_test_status"),
  lastTestMessage: text("last_test_message").notNull().default(""),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const assistantMessages = pgTable("assistant_messages", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  label: text("label").notNull().default(""),
  position: integer("position").notNull().default(0),
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
  scenarioVersionId: text("scenario_version_id"),
  source: text("source").notNull().default("manual"),
  retryOfRunId: text("retry_of_run_id"),
  scenarioSnapshot: jsonb("scenario_snapshot").notNull().default({
    version: 1,
    name: "Untitled scenario",
    steps: [],
  }),
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
  runAttempt: integer("run_attempt").notNull().default(1),
  metadata: jsonb("metadata").notNull().default({}),
})

export const pythonWorkspaces = pgTable("python_workspaces", {
  botId: text("bot_id").primaryKey(),
  draftCode: text("draft_code").notNull().default(""),
  draftRequirements: text("draft_requirements").notNull().default(""),
  publishedCode: text("published_code").notNull().default(""),
  publishedRequirements: text("published_requirements").notNull().default(""),
  status: text("status").notNull().default("draft"),
  publishedVersionId: text("published_version_id"),
  lastTestStatus: text("last_test_status"),
  lastTestOutput: text("last_test_output").notNull().default(""),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const pythonVersions = pgTable("python_versions", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  version: integer("version").notNull(),
  code: text("code").notNull(),
  requirements: text("requirements").notNull().default(""),
  author: text("author").notNull().default("dashboard"),
  changeSummary: text("change_summary").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const aiCodeProposals = pgTable("ai_code_proposals", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  baseCodeHash: text("base_code_hash").notNull(),
  request: text("request").notNull(),
  selectedStepId: text("selected_step_id"),
  analysis: jsonb("analysis").notNull().default({}),
  proposedCode: text("proposed_code").notNull(),
  proposedRequirements: text("proposed_requirements").notNull().default(""),
  explanation: text("explanation").notNull().default(""),
  warnings: jsonb("warnings").notNull().default([]),
  status: text("status").notNull().default("pending"),
  model: text("model").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Template = typeof templates.$inferSelect
export type Bot = typeof bots.$inferSelect
export type BotRef = typeof botRefs.$inferSelect
export type ScenarioVersion = typeof scenarioVersions.$inferSelect
export type Run = typeof runs.$inferSelect
export type LogStep = typeof logSteps.$inferSelect
export type PythonWorkspace = typeof pythonWorkspaces.$inferSelect
export type PythonVersion = typeof pythonVersions.$inferSelect
export type AiCodeProposal = typeof aiCodeProposals.$inferSelect
export type AiProvider = typeof aiProviders.$inferSelect
