"use client";

import { useEffect, useMemo, useState } from "react";
import { reviewabilityLabel } from "@/lib/core/prototype-quality";
import { compareReviewRuns, type ComparableIssue } from "@/lib/core/run-comparison";
import type { AgentRun, Claim, Issue, PrototypeVersion, SourceItem } from "@/lib/types";

export type CanvasView = "review" | "baseline" | "versions" | "comparison";

export function ContextCanvas({
  view,
  issue,
  version,
  claims,
  versions,
  sources,
  issues,
  runs,
  projectId,
  selectedClaimIds,
  onToggleClaim,
  onConfirmClaims,
  isSavingClaims,
}: {
  view: CanvasView;
  issue: Issue | null;
  version: PrototypeVersion | null;
  claims: Claim[];
  versions: PrototypeVersion[];
  sources: SourceItem[];
  issues: Issue[];
  runs: AgentRun[];
  projectId: string;
  selectedClaimIds: string[];
  onToggleClaim: (claimId: string) => void;
  onConfirmClaims: () => void;
  isSavingClaims: boolean;
}) {
  if (view === "baseline") {
    return (
      <section className="center-pane">
        <CanvasHeader title="需求与约束基线" crumb="项目级上下文 / 产品经理确认" />
        <div className="canvas-card subview">
          <div className="subview-intro">
            <div>
              <h2>待确认主张</h2>
              <p>Agent 的抽取只是草稿。勾选并确认后才成为本项目的评审基线。</p>
            </div>
            <span>{claims.filter((claim) => claim.status === "confirmed").length} 项已确认</span>
          </div>
          <div className="claim-list">
            {claims.length ? claims.map((claim) => (
              <label className="claim-row" key={claim.id}>
                <input
                  type="checkbox"
                  checked={claim.status === "confirmed" || selectedClaimIds.includes(claim.id)}
                  disabled={claim.status === "confirmed"}
                  onChange={() => onToggleClaim(claim.id)}
                />
                <span className="claim-type">{claim.kind}</span>
                <span>
                  <strong>{claim.content}</strong>
                  <small>{claim.quoteText || "未保留原文摘录"}</small>
                </span>
                <em>{claim.sourceLocation || (claim.aiInference ? "AI 推断·待确认" : "资料原文")}</em>
              </label>
            )) : <EmptyCanvas title="尚无待确认主张" copy="首次评审后，Agent 提取的目标、需求、约束和待确认项会显示在这里。" />}
          </div>
          {claims.some((claim) => claim.status === "pending") ? (
            <div className="subview-actions">
              <button className="primary-button" disabled={!selectedClaimIds.length || isSavingClaims} onClick={onConfirmClaims}>
                {isSavingClaims ? "正在保存…" : "确认所选基线"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (view === "versions") {
    return (
      <section className="center-pane">
        <CanvasHeader title="原型版本记录" crumb="项目级上下文 / 版本与采集状态" />
        <div className="canvas-card subview">
          <div className="subview-intro">
            <div><h2>版本与复检记录</h2><p>这里只展示真实导入并完成采集的原型版本。</p></div>
            <span>{versions.length} 个版本</span>
          </div>
          <div className="version-list">
            {versions.length ? versions.map((item) => (
              <article className="version-row" key={item.id}>
                <span className="version-badge">{item.label}</span>
                <span>
                  <strong>{item.title || item.pageUrl || `${item.label} 原型`}</strong>
                  <small>{item.sourceType.toUpperCase()} · {item.pageUrl || item.sourceUrl || "本地静态文件"}</small>
                  <small>{item.reviewabilityReason}</small>
                </span>
                <span className={`capture-state ${item.reviewability === "reviewable" ? "" : "failed"}`}>{reviewabilityLabel(item.reviewability)}</span>
              </article>
            )) : <EmptyCanvas title="尚未导入原型" copy="从“导入资料”中添加可访问 URL、单文件 HTML 或静态构建 ZIP。" />}
          </div>
        </div>
      </section>
    );
  }

  if (view === "comparison") {
    return <RunComparisonView key={projectId} runs={runs} issues={issues} />;
  }

  return (
    <section className="center-pane">
      <CanvasHeader
        title="问题上下文画布"
        crumb={issue ? `${issue.id.slice(0, 8)} / ${issue.pageUrl || "待定位"} / ${issue.region || "待定位"}` : "等待 Agent 生成问题"}
        state={version ? `${version.label} · ${captureLabel(version)}` : undefined}
      />
      {!issue ? (
        <div className="canvas-card empty-review">
          <EmptyCanvas title="从真实输入开始评审" copy="创建空白项目后，先导入一个 AI 产品原型和至少一份文本资料，再启动 Agent。" />
        </div>
      ) : (
        <>
          <div className="prototype-card">
            <div className="prototype-toolbar">
              <span><strong>{version?.title || "原型页面"}</strong><small>{issue.selector || issue.pageUrl || "DOM 位置待补充"}</small></span>
              {version?.previewUrl ? <a href={version.previewUrl} target="_blank" rel="noreferrer">打开原型 ↗</a> : null}
            </div>
            <div className="prototype-stage">
              {version?.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={version.screenshotUrl} alt={`${version.label} 采集截图`} />
              ) : (
                <div className="dom-preview">
                  <span className="dom-kicker">渲染后 DOM 摘要</span>
                  <h3>{version?.title || issue.region || "原型位置"}</h3>
                  <p>{version?.visibleText.slice(0, 700) || "该版本没有可展示的截图或可见文本。"}</p>
                </div>
              )}
              <div className="location-callout">
                <strong>{issue.region || "Agent 定位区域"}</strong>
                <span>{issue.selector || "未提供稳定选择器"}</span>
              </div>
            </div>
          </div>
          <div className="evidence-heading"><h2>关联证据</h2><span>{issue.evidence.length} 条</span></div>
          <div className="evidence-grid">
            {issue.evidence.length ? issue.evidence.map((evidence) => (
              <article className="evidence-card" key={evidence.id}>
                <header><strong>{evidence.sourceTitle || evidence.versionLabel || "原型 DOM"}</strong><span>{evidence.sourceLocation || evidence.selector || "位置待确认"}</span></header>
                <p>{evidence.quoteText}</p>
                <small>{evidence.sourceId ? "资料原文" : "原型 DOM 证据"}</small>
              </article>
            )) : (
              <div className="evidence-card missing"><strong>缺少证据</strong><p>这条草稿不满足交付要求，请重新运行或补充资料。</p></div>
            )}
          </div>
        </>
      )}
      {sources.length === 0 && issue ? <span className="honesty-note">当前项目没有文本资料；AI 推断不会被当成已确认事实。</span> : null}
    </section>
  );
}

function RunComparisonView({ runs, issues }: { runs: AgentRun[]; issues: Issue[] }) {
  const reviewRuns = useMemo(() => runs.filter((run) => run.mode === "review" && run.status === "completed" && issues.some((issue) => issue.runId === run.id)), [runs, issues]);
  const [runAId, setRunAId] = useState(reviewRuns[1]?.id || "");
  const [runBId, setRunBId] = useState(reviewRuns[0]?.id || "");

  useEffect(() => {
    if (!reviewRuns.some((run) => run.id === runAId)) setRunAId(reviewRuns[1]?.id || "");
    if (!reviewRuns.some((run) => run.id === runBId)) setRunBId(reviewRuns[0]?.id || "");
  }, [reviewRuns, runAId, runBId]);

  const runA = reviewRuns.find((run) => run.id === runAId);
  const runB = reviewRuns.find((run) => run.id === runBId);
  const comparison = runA && runB && runA.id !== runB.id ? compareReviewRuns(runA, runB, issues) : null;

  return (
    <section className="center-pane">
      <CanvasHeader title="重复评审比较" crumb="项目级上下文 / 已保存的真实初评 Run" />
      <div className="canvas-card subview comparison-view">
        <div className="subview-intro">
          <div><h2>运行稳定性</h2><p>比较只读取已保存的 Issue 与证据，不调用模型补写；结果始终需要人工确认。</p></div>
          <span>{reviewRuns.length} 次可比较初评</span>
        </div>
        {reviewRuns.length < 2 ? <EmptyCanvas title="样本不足" copy="至少需要两次已完成且生成 Issue 的初评，才能比较共同主题与波动。" /> : (
          <>
            <div className="comparison-selectors">
              <RunSelect label="运行 A" value={runAId} runs={reviewRuns} exclude={runBId} onChange={setRunAId} />
              <RunSelect label="运行 B" value={runBId} runs={reviewRuns} exclude={runAId} onChange={setRunBId} />
            </div>
            {comparison ? (
              <>
                <div className={`stability-summary ${comparison.stability.label === "较稳定" ? "stable" : "variable"}`}>
                  <span><strong>{comparison.stability.label}</strong><small>待人工确认</small></span>
                  <div>{comparison.stability.reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
                </div>
                <ComparisonGroup title={`共同主题 · ${comparison.shared.length}`}>
                  {comparison.shared.map((item) => (
                    <article className="comparison-card shared" key={`${item.issueA.id}-${item.issueB.id}`}>
                      <header><strong>{item.issueA.title}</strong><span>匹配度 {Math.round(item.similarity * 100)}%</span></header>
                      <p>运行 B：{item.issueB.title}</p>
                      <div className="comparison-diffs">
                        <span className={item.severityChanged ? "changed" : ""}>严重程度：{item.issueA.severity} → {item.issueB.severity}</span>
                        <span className={item.evidenceChanged ? "changed" : ""}>证据：{evidenceSummary(item.issueA)} → {evidenceSummary(item.issueB)}</span>
                      </div>
                    </article>
                  ))}
                </ComparisonGroup>
                <div className="comparison-columns">
                  <ComparisonGroup title={`仅运行 A · ${comparison.onlyA.length}`}><IssueComparisonCards issues={comparison.onlyA} /></ComparisonGroup>
                  <ComparisonGroup title={`仅运行 B · ${comparison.onlyB.length}`}><IssueComparisonCards issues={comparison.onlyB} /></ComparisonGroup>
                </div>
              </>
            ) : <EmptyCanvas title="请选择两个不同运行" copy="运行 A 与运行 B 不能相同。" />}
          </>
        )}
      </div>
    </section>
  );
}

function RunSelect({ label, value, runs, exclude, onChange }: { label: string; value: string; runs: AgentRun[]; exclude: string; onChange: (value: string) => void }) {
  return <label className="field">{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{runs.filter((run) => run.id !== exclude || run.id === value).map((run) => <option key={run.id} value={run.id}>{formatRun(run)}</option>)}</select></label>;
}

function ComparisonGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="comparison-group"><h3>{title}</h3>{children}</section>;
}

function IssueComparisonCards({ issues }: { issues: ComparableIssue[] }) {
  return issues.length ? issues.map((issue) => <article className="comparison-card" key={issue.id}><strong>{issue.title}</strong><p>{issue.severity} · {issue.issueType}</p><small>{evidenceSummary(issue)}</small></article>) : <p className="comparison-empty">无</p>;
}

function evidenceSummary(issue: ComparableIssue) {
  const evidence = issue.evidence[0];
  if (!evidence) return "无可追溯证据";
  return `${evidence.sourceLocation || evidence.selector || "位置未标注"}｜${evidence.quoteText.slice(0, 60)}`;
}

function formatRun(run: AgentRun) {
  return `${new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(run.startedAt))} · ${run.id.slice(0, 8)}`;
}

function CanvasHeader({ title, crumb, state }: { title: string; crumb: string; state?: string }) {
  return <div className="canvas-head"><h2>{title}</h2><span className="crumb">{crumb}</span>{state ? <span className="version-state">{state}</span> : null}</div>;
}

function EmptyCanvas({ title, copy }: { title: string; copy: string }) {
  return <div className="pane-empty"><span className="empty-mark">P</span><strong>{title}</strong><p>{copy}</p></div>;
}

function captureLabel(version: PrototypeVersion) {
  if (version.captureStatus === "captured") return "DOM 已采集";
  if (version.captureStatus === "failed") return "采集失败";
  return "等待采集";
}
