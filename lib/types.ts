export type IssueStatus =
  | "AI 草稿"
  | "待确认"
  | "待澄清"
  | "待处理"
  | "处理中"
  | "待验证"
  | "已解决"
  | "已延后"
  | "已接受风险"
  | "重新打开";

export type AgentRunStatus = "running" | "completed" | "failed";

export interface ProjectSummary {
  id: string;
  name: string;
  goal: string;
  scope: string;
  readinessSuggestion: "暂不可交付" | "有条件可交付" | "可以交付";
  sourceCount: number;
  issueCount: number;
  versionCount: number;
  updatedAt: string;
}

export interface SourceItem {
  id: string;
  projectId: string;
  kind: string;
  role: string;
  title: string;
  originalLocation: string;
  content: string;
  parseStatus: string;
  createdAt: string;
}

export interface PrototypeControl {
  tag: string;
  role: string;
  text: string;
  ariaLabel: string;
  selector: string;
  box: { x: number; y: number; width: number; height: number };
}

export interface PrototypeVersion {
  id: string;
  projectId: string;
  label: string;
  sourceType: "url" | "html" | "zip";
  sourceUrl: string | null;
  title: string;
  pageUrl: string;
  visibleText: string;
  controls: PrototypeControl[];
  captureStatus: "pending" | "captured" | "failed";
  captureError: string | null;
  reviewability: "reviewable" | "login_required" | "loading_shell" | "failed" | "unknown";
  reviewabilityReason: string;
  screenshotUrl: string | null;
  previewUrl: string | null;
  createdAt: string;
}

export interface Claim {
  id: string;
  projectId: string;
  sourceId: string | null;
  kind: string;
  content: string;
  quoteText: string;
  sourceLocation: string;
  aiInference: boolean;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
}

export interface IssueEvidence {
  id: string;
  sourceId: string | null;
  chunkId: string | null;
  prototypeVersionId: string | null;
  sourceTitle: string | null;
  versionLabel: string | null;
  quoteText: string;
  sourceLocation: string;
  selector: string;
}

export interface IssueDecision {
  id: string;
  action: string;
  reason: string;
  actor: string;
  createdAt: string;
}

export interface Verification {
  id: string;
  result: "疑似已解决" | "未解决" | "无法判断" | "引入新问题";
  summary: string;
  evidence: Array<{ location: string; before: string; after: string }>;
  fromVersionLabel: string;
  toVersionLabel: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  projectId: string;
  runId: string | null;
  title: string;
  issueType: string;
  sourceKind: string;
  severity: "阻塞" | "高" | "中" | "低";
  confidence: "高" | "中" | "低";
  status: IssueStatus;
  summary: string;
  impact: string;
  rationale: string;
  clarificationQuestion: string;
  clarificationRole: string;
  verificationCriteria: string[];
  versionId: string | null;
  versionLabel: string | null;
  pageUrl: string;
  selector: string;
  region: string;
  evidence: IssueEvidence[];
  decisions: IssueDecision[];
  verifications: Verification[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentEvent {
  id: string;
  sequence: number;
  toolName: string;
  eventType: string;
  paramsSummary: string;
  resultSummary: string;
  status: "running" | "completed" | "failed";
  durationMs: number | null;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  mode: "review" | "verify";
  status: AgentRunStatus;
  model: string;
  targetVersionId: string | null;
  issueId: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  events: AgentEvent[];
}

export interface WorkspaceData {
  project: ProjectSummary;
  sources: SourceItem[];
  versions: PrototypeVersion[];
  claims: Claim[];
  issues: Issue[];
  runs: AgentRun[];
}

export interface ApiErrorPayload {
  error: string;
}
