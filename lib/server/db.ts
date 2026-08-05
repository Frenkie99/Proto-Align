import "server-only";

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const runtimeRoot = process.env.PROTOALIGN_DATA_DIR
  ? path.resolve(process.env.PROTOALIGN_DATA_DIR)
  : path.join(process.cwd(), "data");

export const uploadsRoot = path.join(runtimeRoot, "uploads");
export const screenshotsRoot = path.join(runtimeRoot, "screenshots");
const databasePath = path.join(runtimeRoot, "protoalign.db");

fs.mkdirSync(runtimeRoot, { recursive: true });
fs.mkdirSync(uploadsRoot, { recursive: true });
fs.mkdirSync(screenshotsRoot, { recursive: true });

const globalDatabase = globalThis as typeof globalThis & { protoalignDb?: Database.Database };

export const db = globalDatabase.protoalignDb ?? new Database(databasePath);
if (process.env.NODE_ENV !== "production") globalDatabase.protoalignDb = db;

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    scope TEXT NOT NULL,
    readiness_suggestion TEXT NOT NULL DEFAULT '暂不可交付',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    role TEXT NOT NULL,
    title TEXT NOT NULL,
    original_location TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    parse_status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS source_chunks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS source_chunks_fts USING fts5(
    id UNINDEXED,
    project_id UNINDEXED,
    source_id UNINDEXED,
    content,
    tokenize='unicode61'
  );

  CREATE TABLE IF NOT EXISTS prototype_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    storage_path TEXT,
    entry_path TEXT,
    notes TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    page_url TEXT NOT NULL DEFAULT '',
    dom_json TEXT NOT NULL DEFAULT '[]',
    visible_text TEXT NOT NULL DEFAULT '',
    controls_json TEXT NOT NULL DEFAULT '[]',
    screenshot_path TEXT,
    capture_status TEXT NOT NULL DEFAULT 'pending',
    capture_error TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(project_id, label)
  );

  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    run_id TEXT,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    quote_text TEXT NOT NULL DEFAULT '',
    source_location TEXT NOT NULL DEFAULT '',
    ai_inference INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    confirmed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    model TEXT NOT NULL,
    target_version_id TEXT REFERENCES prototype_versions(id) ON DELETE SET NULL,
    issue_id TEXT,
    error_message TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT NOT NULL,
    impact TEXT NOT NULL,
    rationale TEXT NOT NULL,
    clarification_question TEXT NOT NULL DEFAULT '',
    clarification_role TEXT NOT NULL DEFAULT '',
    verification_criteria_json TEXT NOT NULL,
    version_id TEXT REFERENCES prototype_versions(id) ON DELETE SET NULL,
    page_url TEXT NOT NULL DEFAULT '',
    selector TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS issue_evidence (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    chunk_id TEXT REFERENCES source_chunks(id) ON DELETE SET NULL,
    prototype_version_id TEXT REFERENCES prototype_versions(id) ON DELETE SET NULL,
    quote_text TEXT NOT NULL,
    source_location TEXT NOT NULL DEFAULT '',
    selector TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS status_events (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    reason TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    from_version_id TEXT NOT NULL REFERENCES prototype_versions(id),
    to_version_id TEXT NOT NULL REFERENCES prototype_versions(id),
    result TEXT NOT NULL,
    summary TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    tool_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    params_summary TEXT NOT NULL,
    result_summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    duration_ms INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id);
  CREATE INDEX IF NOT EXISTS idx_versions_project ON prototype_versions(project_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_claims_project ON claims(project_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_runs_project ON agent_runs(project_id, started_at);
  CREATE INDEX IF NOT EXISTS idx_events_run ON agent_events(run_id, sequence);
`);

export function now() {
  return new Date().toISOString();
}

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
