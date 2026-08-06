export interface ComparableRun {
  id: string;
  startedAt: string;
}

export interface ComparableEvidence {
  sourceLocation: string;
  selector: string;
  quoteText: string;
}

export interface ComparableIssue {
  id: string;
  runId: string | null;
  title: string;
  issueType: string;
  severity: string;
  evidence: ComparableEvidence[];
}

export interface SharedIssueComparison {
  issueA: ComparableIssue;
  issueB: ComparableIssue;
  similarity: number;
  severityChanged: boolean;
  evidenceChanged: boolean;
}

export interface RunComparisonResult {
  runA: ComparableRun;
  runB: ComparableRun;
  shared: SharedIssueComparison[];
  onlyA: ComparableIssue[];
  onlyB: ComparableIssue[];
  stability: {
    label: "较稳定" | "有波动";
    matchRatio: number;
    severityChangeCount: number;
    evidenceChangeCount: number;
    needsHumanConfirmation: true;
    reasons: string[];
  };
}

const MATCH_THRESHOLD = 0.48;
const GENERIC_PHRASES = /(?:问题|存在|页面|原型|功能|入口|没有|缺少|未提供|无法|相关)/g;

export function compareReviewRuns(runA: ComparableRun, runB: ComparableRun, issues: ComparableIssue[]): RunComparisonResult {
  const issuesA = issues.filter((issue) => issue.runId === runA.id);
  const issuesB = issues.filter((issue) => issue.runId === runB.id);
  const candidates = issuesA.flatMap((issueA) => issuesB.map((issueB) => ({
    issueA,
    issueB,
    score: issueSimilarity(issueA, issueB),
  }))).filter((candidate) => candidate.score >= MATCH_THRESHOLD)
    .sort((left, right) => right.score - left.score || left.issueA.id.localeCompare(right.issueA.id) || left.issueB.id.localeCompare(right.issueB.id));

  const matchedA = new Set<string>();
  const matchedB = new Set<string>();
  const shared: SharedIssueComparison[] = [];
  for (const candidate of candidates) {
    if (matchedA.has(candidate.issueA.id) || matchedB.has(candidate.issueB.id)) continue;
    matchedA.add(candidate.issueA.id);
    matchedB.add(candidate.issueB.id);
    shared.push({
      issueA: candidate.issueA,
      issueB: candidate.issueB,
      similarity: round(candidate.score),
      severityChanged: candidate.issueA.severity !== candidate.issueB.severity,
      evidenceChanged: evidenceFingerprint(candidate.issueA) !== evidenceFingerprint(candidate.issueB),
    });
  }

  const onlyA = issuesA.filter((issue) => !matchedA.has(issue.id));
  const onlyB = issuesB.filter((issue) => !matchedB.has(issue.id));
  const matchRatio = Math.max(issuesA.length, issuesB.length) ? shared.length / Math.max(issuesA.length, issuesB.length) : 0;
  const severityChangeCount = shared.filter((item) => item.severityChanged).length;
  const evidenceChangeCount = shared.filter((item) => item.evidenceChanged).length;
  const stable = matchRatio >= 0.75 && severityChangeCount === 0 && evidenceChangeCount === 0;
  const reasons = [
    `共同主题 ${shared.length} 个；仅运行 A ${onlyA.length} 个；仅运行 B ${onlyB.length} 个。`,
    `主题匹配率 ${Math.round(matchRatio * 100)}%；严重程度变化 ${severityChangeCount} 个；证据变化 ${evidenceChangeCount} 个。`,
  ];

  return {
    runA,
    runB,
    shared,
    onlyA,
    onlyB,
    stability: {
      label: stable ? "较稳定" : "有波动",
      matchRatio: round(matchRatio),
      severityChangeCount,
      evidenceChangeCount,
      needsHumanConfirmation: true,
      reasons,
    },
  };
}

function issueSimilarity(issueA: ComparableIssue, issueB: ComparableIssue) {
  const typeScore = normalize(issueA.issueType) === normalize(issueB.issueType) ? 0.45 : 0;
  const titleSimilarity = dice(tokens(issueA.title), tokens(issueB.title));
  const titleScore = titleSimilarity * 0.45;
  const evidenceScore = titleSimilarity > 0 && evidenceLocations(issueA).some((location) => evidenceLocations(issueB).includes(location)) ? 0.1 : 0;
  return typeScore + titleScore + evidenceScore;
}

function tokens(value: string) {
  const normalized = normalize(value).replace(GENERIC_PHRASES, "");
  const latin = normalized.match(/[a-z0-9]+/g) || [];
  const chinese = (normalized.match(/[\u3400-\u9fff]+/g) || []).flatMap((part) => part.length < 2 ? [part] : Array.from({ length: part.length - 1 }, (_, index) => part.slice(index, index + 2)));
  return new Set([...latin, ...chinese].filter(Boolean));
}

function dice(left: Set<string>, right: Set<string>) {
  if (!left.size && !right.size) return 1;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return (2 * intersection) / (left.size + right.size || 1);
}

function evidenceLocations(issue: ComparableIssue) {
  return issue.evidence.flatMap((item) => [normalize(item.sourceLocation), normalize(item.selector)]).filter(Boolean);
}

function evidenceFingerprint(issue: ComparableIssue) {
  return issue.evidence.map((item) => [item.sourceLocation, item.selector, item.quoteText].map(normalize).join("|")).sort().join("\n");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
