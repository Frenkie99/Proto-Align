import "server-only";

import type { AgentEvent, AgentRun, Claim, Issue, IssueDecision, IssueEvidence, ProjectSummary, PrototypeVersion, SourceItem, Verification, WorkspaceData } from "@/lib/types";
import { canResolveIssue } from "@/lib/core/issues";
import { chunkText } from "@/lib/core/text";
import { db, id, now } from "./db";

type Row = Record<string, unknown>;

export function listProjects(): ProjectSummary[] {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM sources s WHERE s.project_id = p.id) AS source_count,
      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id) AS issue_count,
      (SELECT COUNT(*) FROM prototype_versions v WHERE v.project_id = p.id) AS version_count
    FROM projects p ORDER BY p.updated_at DESC
  `).all() as Row[];
  return rows.map(mapProject);
}

export function createProject(input: { name: string; goal: string; scope: string }): ProjectSummary {
  const projectId = id("prj");
  const timestamp = now();
  db.prepare(`INSERT INTO projects (id, name, goal, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(projectId, input.name, input.goal, input.scope, timestamp, timestamp);
  return getProject(projectId);
}

export function getProject(projectId: string): ProjectSummary {
  const row = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM sources s WHERE s.project_id = p.id) AS source_count,
      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id) AS issue_count,
      (SELECT COUNT(*) FROM prototype_versions v WHERE v.project_id = p.id) AS version_count
    FROM projects p WHERE p.id = ?
  `).get(projectId) as Row | undefined;
  if (!row) throw new Error("项目不存在");
  return mapProject(row);
}

export function getWorkspace(projectId: string): WorkspaceData {
  const project = getProject(projectId);
  const sources = (db.prepare(`SELECT * FROM sources WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Row[]).map(mapSource);
  const versions = (db.prepare(`SELECT * FROM prototype_versions WHERE project_id = ? ORDER BY created_at ASC`).all(projectId) as Row[]).map(mapVersion);
  const claims = (db.prepare(`SELECT * FROM claims WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Row[]).map(mapClaim);
  const issues = (db.prepare(`SELECT * FROM issues WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Row[]).map((row) => mapIssue(row));
  const runs = (db.prepare(`SELECT * FROM agent_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 20`).all(projectId) as Row[]).map(mapRun);
  return { project, sources, versions, claims, issues, runs };
}

export function addSource(input: Omit<SourceItem, "id" | "createdAt" | "parseStatus"> & { parseStatus?: string }) {
  getProject(input.projectId);
  const sourceId = id("src");
  const timestamp = now();
  const parseStatus = input.parseStatus ?? "已解析·待确认";
  const insert = db.transaction(() => {
    db.prepare(`INSERT INTO sources (id, project_id, kind, role, title, original_location, content, parse_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(sourceId, input.projectId, input.kind, input.role, input.title, input.originalLocation, input.content, parseStatus, timestamp);
    chunkText(input.content).forEach((chunk, index) => {
      const chunkId = id("chk");
      db.prepare(`INSERT INTO source_chunks (id, source_id, project_id, chunk_index, content, start_offset, end_offset) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(chunkId, sourceId, input.projectId, index, chunk.content, chunk.start, chunk.end);
      db.prepare(`INSERT INTO source_chunks_fts (id, project_id, source_id, content) VALUES (?, ?, ?, ?)`)
        .run(chunkId, input.projectId, sourceId, chunk.content);
    });
    touchProject(input.projectId);
  });
  insert();
  return mapSource(db.prepare(`SELECT * FROM sources WHERE id = ?`).get(sourceId) as Row);
}

export function insertPrototype(input: {
  projectId: string;
  label: string;
  sourceType: "url" | "html" | "zip";
  sourceUrl?: string;
  storagePath?: string;
  entryPath?: string;
  notes: string;
}) {
  getProject(input.projectId);
  const versionId = id("ver");
  db.prepare(`INSERT INTO prototype_versions (id, project_id, label, source_type, source_url, storage_path, entry_path, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(versionId, input.projectId, input.label, input.sourceType, input.sourceUrl || null, input.storagePath || null, input.entryPath || null, input.notes, now());
  touchProject(input.projectId);
  return versionId;
}

export function updatePrototypeCapture(versionId: string, input: {
  title?: string;
  pageUrl?: string;
  dom?: unknown[];
  visibleText?: string;
  controls?: unknown[];
  screenshotPath?: string | null;
  status: "captured" | "failed";
  error?: string | null;
  reviewability: PrototypeVersion["reviewability"];
  reviewabilityReason: string;
}) {
  db.prepare(`UPDATE prototype_versions SET title = ?, page_url = ?, dom_json = ?, visible_text = ?, controls_json = ?, screenshot_path = ?, capture_status = ?, capture_error = ?, reviewability = ?, reviewability_reason = ? WHERE id = ?`)
    .run(input.title || "", input.pageUrl || "", JSON.stringify(input.dom || []), input.visibleText || "", JSON.stringify(input.controls || []), input.screenshotPath || null, input.status, input.error || null, input.reviewability, input.reviewabilityReason, versionId);
}

export function getPrototype(versionId: string): PrototypeVersion {
  const row = db.prepare(`SELECT * FROM prototype_versions WHERE id = ?`).get(versionId) as Row | undefined;
  if (!row) throw new Error("原型版本不存在");
  return mapVersion(row);
}

export function getPrototypeFileInfo(versionId: string) {
  const row = db.prepare(`SELECT source_type, storage_path, entry_path, screenshot_path FROM prototype_versions WHERE id = ?`).get(versionId) as Row | undefined;
  if (!row) throw new Error("原型版本不存在");
  return {
    sourceType: String(row.source_type),
    storagePath: row.storage_path ? String(row.storage_path) : null,
    entryPath: row.entry_path ? String(row.entry_path) : null,
    screenshotPath: row.screenshot_path ? String(row.screenshot_path) : null,
  };
}

export function inspectPrototypeData(versionId: string) {
  const row = db.prepare(`SELECT id, project_id, label, title, page_url, visible_text, dom_json, controls_json, capture_status, capture_error, reviewability, reviewability_reason FROM prototype_versions WHERE id = ?`).get(versionId) as Row | undefined;
  if (!row) throw new Error("原型版本不存在");
  return {
    id: String(row.id), projectId: String(row.project_id), label: String(row.label), title: String(row.title), pageUrl: String(row.page_url),
    visibleText: String(row.visible_text), elements: parseJson<unknown[]>(row.dom_json, []), controls: parseJson<unknown[]>(row.controls_json, []),
    captureStatus: String(row.capture_status), captureError: row.capture_error ? String(row.capture_error) : null,
    reviewability: String(row.reviewability), reviewabilityReason: String(row.reviewability_reason || ""),
  };
}

export function confirmClaims(projectId: string, claimIds: string[]) {
  getProject(projectId);
  const timestamp = now();
  const update = db.transaction(() => {
    for (const claimId of claimIds) {
      const result = db.prepare(`UPDATE claims SET status = 'confirmed', confirmed_at = ? WHERE id = ? AND project_id = ? AND status = 'pending'`).run(timestamp, claimId, projectId);
      if (!result.changes) throw new Error("待确认主张不存在或已经处理");
    }
    touchProject(projectId);
  });
  update();
}

export function updateIssueStatus(issueId: string, status: string, reason: string) {
  const row = db.prepare(`SELECT project_id, status FROM issues WHERE id = ?`).get(issueId) as Row | undefined;
  if (!row) throw new Error("问题不存在");
  if (status === "已解决") {
    const latestVerification = db.prepare(`SELECT result FROM verifications WHERE issue_id = ? ORDER BY created_at DESC LIMIT 1`).get(issueId) as Row | undefined;
    if (!canResolveIssue(latestVerification ? String(latestVerification.result) : null)) {
      throw new Error("只有最近一次复检结论为“疑似已解决”时，产品经理才能确认关闭问题");
    }
  }
  const timestamp = now();
  const actor = "产品经理";
  const update = db.transaction(() => {
    db.prepare(`UPDATE issues SET status = ?, updated_at = ? WHERE id = ?`).run(status, timestamp, issueId);
    db.prepare(`INSERT INTO decisions (id, issue_id, action, reason, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id("dec"), issueId, status, reason, actor, timestamp);
    db.prepare(`INSERT INTO status_events (id, issue_id, from_status, to_status, reason, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id("evt"), issueId, String(row.status), status, reason, actor, timestamp);
    recomputeReadiness(String(row.project_id));
    touchProject(String(row.project_id));
  });
  update();
}

export function createRun(input: { projectId: string; mode: "review" | "verify"; model: string; versionId?: string; issueId?: string }) {
  const runId = id("run");
  db.prepare(`INSERT INTO agent_runs (id, project_id, mode, status, model, target_version_id, issue_id, started_at) VALUES (?, ?, ?, 'running', ?, ?, ?, ?)`)
    .run(runId, input.projectId, input.mode, input.model, input.versionId || null, input.issueId || null, now());
  return runId;
}

export function countAgentRunsStartedSince(startedAt: string) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM agent_runs WHERE started_at >= ?`).get(startedAt) as Row;
  return Number(row.count || 0);
}

export function finishRun(runId: string, status: "completed" | "failed", errorMessage?: string) {
  db.prepare(`UPDATE agent_runs SET status = ?, error_message = ?, completed_at = ? WHERE id = ?`).run(status, errorMessage || null, now(), runId);
}

export function discardReviewRunDrafts(runId: string) {
  const remove = db.transaction(() => {
    db.prepare(`DELETE FROM issues WHERE run_id = ?`).run(runId);
    db.prepare(`DELETE FROM claims WHERE run_id = ?`).run(runId);
  });
  remove();
}

export function addAgentEvent(runId: string, input: Omit<AgentEvent, "id" | "createdAt">) {
  const eventId = id("aev");
  db.prepare(`INSERT INTO agent_events (id, run_id, sequence, tool_name, event_type, params_summary, result_summary, status, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(eventId, runId, input.sequence, input.toolName, input.eventType, input.paramsSummary, input.resultSummary, input.status, input.durationMs, now());
  return eventId;
}

export function updateAgentEvent(eventId: string, input: { resultSummary: string; status: "completed" | "failed"; durationMs: number }) {
  db.prepare(`UPDATE agent_events SET result_summary = ?, status = ?, duration_ms = ? WHERE id = ?`).run(input.resultSummary, input.status, input.durationMs, eventId);
}

export function nextAgentEventSequence(runId: string) {
  const row = db.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM agent_events WHERE run_id = ?`).get(runId) as Row;
  return Number(row.next);
}

export function insertClaimDraft(input: {
  projectId: string; runId: string; sourceId?: string; kind: string; content: string; quoteText: string;
  sourceLocation: string; aiInference: boolean;
}) {
  if (input.sourceId) assertProjectEntity("sources", input.sourceId, input.projectId);
  const claimId = id("clm");
  db.prepare(`INSERT INTO claims (id, project_id, source_id, run_id, kind, content, quote_text, source_location, ai_inference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(claimId, input.projectId, input.sourceId || null, input.runId, input.kind, input.content, input.quoteText, input.sourceLocation, input.aiInference ? 1 : 0, now());
  return claimId;
}

export function insertIssueDraft(input: {
  projectId: string; runId: string; title: string; issueType: string; sourceKind: string; severity: string; confidence: string;
  summary: string; impact: string; rationale: string; clarificationQuestion: string; clarificationRole: string;
  verificationCriteria: string[]; versionId?: string; pageUrl: string; selector: string; region: string;
  evidence: Array<{ sourceId?: string; chunkId?: string; prototypeVersionId?: string; quoteText: string; sourceLocation: string; selector?: string }>;
}) {
  if (input.versionId) assertProjectEntity("prototype_versions", input.versionId, input.projectId);
  for (const evidence of input.evidence) {
    if (evidence.sourceId) assertProjectEntity("sources", evidence.sourceId, input.projectId);
    if (evidence.chunkId) assertProjectEntity("source_chunks", evidence.chunkId, input.projectId);
    if (evidence.prototypeVersionId) assertProjectEntity("prototype_versions", evidence.prototypeVersionId, input.projectId);
  }
  const issueId = id("iss");
  const timestamp = now();
  const insert = db.transaction(() => {
    db.prepare(`INSERT INTO issues (id, project_id, run_id, title, issue_type, source_kind, severity, confidence, status, summary, impact, rationale, clarification_question, clarification_role, verification_criteria_json, version_id, page_url, selector, region, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '待确认', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(issueId, input.projectId, input.runId, input.title, input.issueType, input.sourceKind, input.severity, input.confidence, input.summary, input.impact, input.rationale, input.clarificationQuestion, input.clarificationRole, JSON.stringify(input.verificationCriteria), input.versionId || null, input.pageUrl, input.selector, input.region, timestamp, timestamp);
    for (const evidence of input.evidence) {
      db.prepare(`INSERT INTO issue_evidence (id, issue_id, source_id, chunk_id, prototype_version_id, quote_text, source_location, selector) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id("evd"), issueId, evidence.sourceId || null, evidence.chunkId || null, evidence.prototypeVersionId || null, evidence.quoteText, evidence.sourceLocation, evidence.selector || "");
    }
    touchProject(input.projectId);
  });
  insert();
  return issueId;
}

export function insertVerification(input: {
  issueId: string; runId: string; fromVersionId: string; toVersionId: string;
  result: string; summary: string; evidence: Array<{ location: string; before: string; after: string }>;
}) {
  const verificationId = id("vrf");
  db.prepare(`INSERT INTO verifications (id, issue_id, run_id, from_version_id, to_version_id, result, summary, evidence_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(verificationId, input.issueId, input.runId, input.fromVersionId, input.toVersionId, input.result, input.summary, JSON.stringify(input.evidence), now());
  db.prepare(`UPDATE issues SET status = '待验证', updated_at = ? WHERE id = ?`).run(now(), input.issueId);
  return verificationId;
}

export function searchSourceChunks(projectId: string, query: string, kind?: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean).map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
  let rows = terms ? db.prepare(`
    SELECT c.id AS chunk_id, c.source_id, c.content, s.title, s.kind, s.role, s.original_location
    FROM source_chunks_fts f JOIN source_chunks c ON c.id = f.id JOIN sources s ON s.id = c.source_id
    WHERE f.project_id = ? AND source_chunks_fts MATCH ? AND (? = '' OR s.kind = ?)
    ORDER BY rank LIMIT 8
  `).all(projectId, terms, kind || "", kind || "") as Row[] : db.prepare(`
    SELECT c.id AS chunk_id, c.source_id, c.content, s.title, s.kind, s.role, s.original_location
    FROM source_chunks c JOIN sources s ON s.id = c.source_id WHERE c.project_id = ? AND (? = '' OR s.kind = ?) ORDER BY s.created_at DESC LIMIT 8
  `).all(projectId, kind || "", kind || "") as Row[];
  if (!rows.length && query.trim()) {
    const likeTerms = query.trim().split(/\s+/).filter(Boolean).slice(0, 8);
    const predicates = likeTerms.map(() => "(c.content LIKE ? OR s.title LIKE ?)").join(" OR ");
    rows = db.prepare(`
      SELECT c.id AS chunk_id, c.source_id, c.content, s.title, s.kind, s.role, s.original_location
      FROM source_chunks c JOIN sources s ON s.id = c.source_id
      WHERE c.project_id = ? AND (? = '' OR s.kind = ?) AND (${predicates})
      ORDER BY s.created_at DESC LIMIT 8
    `).all(projectId, kind || "", kind || "", ...likeTerms.flatMap((term) => [`%${term}%`, `%${term}%`])) as Row[];
  }
  return rows.map((row) => ({
    chunkId: String(row.chunk_id), sourceId: String(row.source_id), content: String(row.content), title: String(row.title),
    kind: String(row.kind), role: String(row.role), originalLocation: String(row.original_location),
  }));
}

export function getIssue(issueId: string): Issue {
  const row = db.prepare(`SELECT * FROM issues WHERE id = ?`).get(issueId) as Row | undefined;
  if (!row) throw new Error("问题不存在");
  return mapIssue(row);
}

function mapProject(row: Row): ProjectSummary {
  return { id: String(row.id), name: String(row.name), goal: String(row.goal), scope: String(row.scope), readinessSuggestion: String(row.readiness_suggestion) as ProjectSummary["readinessSuggestion"], sourceCount: Number(row.source_count || 0), issueCount: Number(row.issue_count || 0), versionCount: Number(row.version_count || 0), updatedAt: String(row.updated_at) };
}

function mapSource(row: Row): SourceItem {
  return { id: String(row.id), projectId: String(row.project_id), kind: String(row.kind), role: String(row.role), title: String(row.title), originalLocation: String(row.original_location), content: String(row.content), parseStatus: String(row.parse_status), createdAt: String(row.created_at) };
}

function mapVersion(row: Row): PrototypeVersion {
  const versionId = String(row.id);
  return { id: versionId, projectId: String(row.project_id), label: String(row.label), sourceType: String(row.source_type) as PrototypeVersion["sourceType"], sourceUrl: row.source_url ? String(row.source_url) : null, title: String(row.title || ""), pageUrl: String(row.page_url || ""), visibleText: String(row.visible_text || ""), controls: parseJson(row.controls_json, []), captureStatus: String(row.capture_status) as PrototypeVersion["captureStatus"], captureError: row.capture_error ? String(row.capture_error) : null, reviewability: String(row.reviewability || "unknown") as PrototypeVersion["reviewability"], reviewabilityReason: String(row.reviewability_reason || ""), screenshotUrl: row.screenshot_path ? `/api/prototypes/${versionId}/screenshot` : null, previewUrl: String(row.source_type) === "url" ? String(row.source_url || "") : `/api/prototypes/${versionId}/assets/${String(row.entry_path || "index.html")}`, createdAt: String(row.created_at) };
}

function mapClaim(row: Row): Claim {
  return { id: String(row.id), projectId: String(row.project_id), sourceId: row.source_id ? String(row.source_id) : null, kind: String(row.kind), content: String(row.content), quoteText: String(row.quote_text), sourceLocation: String(row.source_location), aiInference: Boolean(row.ai_inference), status: String(row.status) as Claim["status"], createdAt: String(row.created_at) };
}

function mapIssue(row: Row): Issue {
  const issueId = String(row.id);
  const evidence = (db.prepare(`SELECT e.*, s.title AS source_title, v.label AS version_label FROM issue_evidence e LEFT JOIN sources s ON s.id = e.source_id LEFT JOIN prototype_versions v ON v.id = e.prototype_version_id WHERE e.issue_id = ?`).all(issueId) as Row[]).map(mapEvidence);
  const decisions = (db.prepare(`SELECT * FROM decisions WHERE issue_id = ? ORDER BY created_at DESC`).all(issueId) as Row[]).map(mapDecision);
  const verifications = (db.prepare(`SELECT x.*, fv.label AS from_version_label, tv.label AS to_version_label FROM verifications x JOIN prototype_versions fv ON fv.id = x.from_version_id JOIN prototype_versions tv ON tv.id = x.to_version_id WHERE x.issue_id = ? ORDER BY x.created_at DESC`).all(issueId) as Row[]).map(mapVerification);
  const versionRow = row.version_id ? db.prepare(`SELECT label FROM prototype_versions WHERE id = ?`).get(row.version_id) as Row | undefined : undefined;
  return { id: issueId, projectId: String(row.project_id), runId: row.run_id ? String(row.run_id) : null, title: String(row.title), issueType: String(row.issue_type), sourceKind: String(row.source_kind), severity: String(row.severity) as Issue["severity"], confidence: String(row.confidence) as Issue["confidence"], status: String(row.status) as Issue["status"], summary: String(row.summary), impact: String(row.impact), rationale: String(row.rationale), clarificationQuestion: String(row.clarification_question), clarificationRole: String(row.clarification_role), verificationCriteria: parseJson(row.verification_criteria_json, []), versionId: row.version_id ? String(row.version_id) : null, versionLabel: versionRow ? String(versionRow.label) : null, pageUrl: String(row.page_url), selector: String(row.selector), region: String(row.region), evidence, decisions, verifications, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

function mapEvidence(row: Row): IssueEvidence { return { id: String(row.id), sourceId: row.source_id ? String(row.source_id) : null, chunkId: row.chunk_id ? String(row.chunk_id) : null, prototypeVersionId: row.prototype_version_id ? String(row.prototype_version_id) : null, sourceTitle: row.source_title ? String(row.source_title) : null, versionLabel: row.version_label ? String(row.version_label) : null, quoteText: String(row.quote_text), sourceLocation: String(row.source_location), selector: String(row.selector) }; }
function mapDecision(row: Row): IssueDecision { return { id: String(row.id), action: String(row.action), reason: String(row.reason), actor: String(row.actor), createdAt: String(row.created_at) }; }
function mapVerification(row: Row): Verification { return { id: String(row.id), result: String(row.result) as Verification["result"], summary: String(row.summary), evidence: parseJson(row.evidence_json, []), fromVersionLabel: String(row.from_version_label), toVersionLabel: String(row.to_version_label), createdAt: String(row.created_at) }; }
function mapRun(row: Row): AgentRun { const runId = String(row.id); const events = (db.prepare(`SELECT * FROM agent_events WHERE run_id = ? ORDER BY sequence ASC`).all(runId) as Row[]).map(mapAgentEvent); return { id: runId, mode: String(row.mode) as AgentRun["mode"], status: String(row.status) as AgentRun["status"], model: String(row.model), targetVersionId: row.target_version_id ? String(row.target_version_id) : null, issueId: row.issue_id ? String(row.issue_id) : null, errorMessage: row.error_message ? String(row.error_message) : null, startedAt: String(row.started_at), completedAt: row.completed_at ? String(row.completed_at) : null, events }; }
function mapAgentEvent(row: Row): AgentEvent { return { id: String(row.id), sequence: Number(row.sequence), toolName: String(row.tool_name), eventType: String(row.event_type), paramsSummary: String(row.params_summary), resultSummary: String(row.result_summary), status: String(row.status) as AgentEvent["status"], durationMs: row.duration_ms == null ? null : Number(row.duration_ms), createdAt: String(row.created_at) }; }

function parseJson<T>(value: unknown, fallback: T): T { try { return JSON.parse(String(value)) as T; } catch { return fallback; } }
function touchProject(projectId: string) { db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now(), projectId); }
function assertProjectEntity(table: "sources" | "source_chunks" | "prototype_versions", entityId: string, projectId: string) { const row = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND project_id = ?`).get(entityId, projectId); if (!row) throw new Error("Agent 引用了不属于当前项目的证据"); }
function recomputeReadiness(projectId: string) { const counts = db.prepare(`SELECT SUM(CASE WHEN severity = '阻塞' AND status NOT IN ('已解决','已延后','已接受风险') THEN 1 ELSE 0 END) AS blockers, SUM(CASE WHEN status IN ('已延后','已接受风险') THEN 1 ELSE 0 END) AS risks FROM issues WHERE project_id = ?`).get(projectId) as Row; const readiness = Number(counts.blockers || 0) > 0 ? "暂不可交付" : Number(counts.risks || 0) > 0 ? "有条件可交付" : "可以交付"; db.prepare(`UPDATE projects SET readiness_suggestion = ? WHERE id = ?`).run(readiness, projectId); }
