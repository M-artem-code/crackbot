import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
export type Run = typeof runs.$inferSelect
export type LogStep = typeof logSteps.$inferSelect
export type Agent = typeof agents.$inferSelect
