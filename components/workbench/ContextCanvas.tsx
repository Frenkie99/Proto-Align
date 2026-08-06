"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { reviewabilityLabel } from "@/lib/core/prototype-quality";
import { compareReviewRuns, type ComparableIssue } from "@/lib/core/run-comparison";
import type { AgentRun, Claim, Issue, IssueEvidence, PrototypeControl, PrototypeVersion, SourceItem } from "@/lib/types";

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
  onWorkspaceChanged,
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
  onWorkspaceChanged: () => Promise<void>;
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
            )) : <EmptyCanvas title="尚未导入原型" copy={'从"导入资料"中添加可访问 URL、单文件 HTML 或静态构建 ZIP。'} />}
          </div>
        </div>
      </section>
    );
  }

  if (view === "comparison") {
    return <RunComparisonView key={projectId} runs={runs} issues={issues} />;
  }

  return (
    <IssueReviewView
      issue={issue}
      version={version}
      sources={sources}
      onWorkspaceChanged={onWorkspaceChanged}
    />
  );
}

/* ═══════════════════════════════════════════
   Issue Review View — Fix #1 (positioning) + Fix #2 (evidence)
   ═══════════════════════════════════════════ */

function IssueReviewView({
  issue,
  version,
  sources,
  onWorkspaceChanged,
}: {
  issue: Issue | null;
  version: PrototypeVersion | null;
  sources: SourceItem[];
  onWorkspaceChanged: () => Promise<void>;
}) {
  /* ── Fix #2: find element + scale coordinates to actual image size ── */
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);

  const onImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (img) setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  const matchedControl = useMemo<PrototypeControl | null>(() => {
    if (!issue?.selector || !version?.controls.length) return null;
    const exact = version.controls.find((c) => c.selector === issue.selector);
    if (exact) return exact;
    const tail = issue.selector.split(">").pop()?.trim() || "";
    if (!tail) return null;
    return version.controls.find((c) => c.selector?.includes(tail)) || null;
  }, [issue?.selector, version]);

  const highlightStyle = useMemo(() => {
    if (!matchedControl || !imgNatural) return null;
    const sx = imgNatural.w / 1440;
    const sy = imgNatural.h / 1000;
    const maxW = 88; const maxH = 88;
    return {
      left: `${Math.max(1, Math.min(maxW, (matchedControl.box.x * sx / imgNatural.w) * 100))}%`,
      top: `${Math.max(1, Math.min(maxH, (matchedControl.box.y * sy / imgNatural.h) * 100))}%`,
      width: `${Math.max(1.5, Math.min(18, (Math.max(20, matchedControl.box.width) * sx / imgNatural.w) * 100))}%`,
      height: `${Math.max(1, Math.min(14, (Math.max(8, matchedControl.box.height) * sy / imgNatural.h) * 100))}%`,
    };
  }, [matchedControl, imgNatural]);

  const calloutStyle = useMemo(() => {
    if (!matchedControl || !imgNatural) return { right: 12, bottom: 12 };
    const sy = imgNatural.h / 1000;
    const elemRight = ((matchedControl.box.x + matchedControl.box.width) / 1440) * 100;
    const elemBottom = ((matchedControl.box.y + matchedControl.box.height) * sy / imgNatural.h) * 100;
    const isBottom = elemBottom > 65;
    const isRight = elemRight > 55;
    const xPct = isRight
      ? Math.max(2, (matchedControl.box.x / 1440) * 100 - 28)
      : Math.min(72, (matchedControl.box.x / 1440) * 100);
    const yPct = isBottom
      ? Math.max(2, ((matchedControl.box.y - 10) * sy / imgNatural.h) * 100 - 12)
      : Math.min(86, elemBottom + 2);
    return { left: `${xPct}%`, top: `${yPct}%` };
  }, [matchedControl, imgNatural]);

  /* ── Fix #2: evidence with add form ── */
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");

  async function addEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue) return;
    setEvidenceBusy(true);
    setEvidenceError("");
    try {
      const formData = new FormData(event.currentTarget);
      const sourceId = String(formData.get("sourceId") || "");
      const quoteText = String(formData.get("quoteText") || "").trim();
      const sourceLocation = String(formData.get("sourceLocation") || "").trim();
      const side = String(formData.get("side") || "development") as "customer" | "development";
      if (!quoteText) throw new Error("请填写证据原文");
      await api.addEvidence(issue.id, {
        sourceId: sourceId || undefined,
        quoteText,
        sourceLocation: sourceLocation || "手动添加",
        sourceRole: side,
      });
      setShowAddEvidence(false);
      await onWorkspaceChanged();
    } catch (cause) {
      setEvidenceError(cause instanceof Error ? cause.message : "添加失败");
    } finally {
      setEvidenceBusy(false);
    }
  }

  /* ── Split evidence by side ── */
  const customerRoles = new Set(["客户反馈", "售前反馈", "产品负责人反馈"]);
  const devRoles = new Set(["研发反馈", "研发记录", "其他资料", "需求文档", "会议纪要"]);
  const { customerEvidence, devEvidence } = useMemo(() => {
    if (!issue) return { customerEvidence: [] as IssueEvidence[], devEvidence: [] as IssueEvidence[] };
    const cust: IssueEvidence[] = [];
    const dev: IssueEvidence[] = [];
    for (const evidence of issue.evidence) {
      if (evidence.prototypeVersionId && !evidence.sourceId) {
        dev.push(evidence);
        continue;
      }
      if (evidence.sourceId) {
        const src = sources.find((s) => s.id === evidence.sourceId);
        if (src && customerRoles.has(src.kind)) { cust.push(evidence); continue; }
        if (src && devRoles.has(src.kind)) { dev.push(evidence); continue; }
      }
      dev.push(evidence);
    }
    return { customerEvidence: cust, devEvidence: dev };
  }, [issue, sources]);

  /* ── Sources available for linking ── */
  const availableSources = useMemo(() => sources.filter((s) => s.parseStatus !== "已归档"), [sources]);

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
          {/* ── Prototype card with dynamic callout (Fix #1) ── */}
          <div className="prototype-card">
            <div className="prototype-toolbar">
              <span><strong>{version?.title || "原型页面"}</strong><small>{issue.selector || issue.pageUrl || "DOM 位置待补充"}</small></span>
              {version?.previewUrl ? <a href={version.previewUrl} target="_blank" rel="noreferrer">打开原型 ↗</a> : null}
            </div>
            <div className="prototype-stage">
              {version?.screenshotUrl ? (
                <div className="screenshot-container">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={imgRef} src={version.screenshotUrl} alt={`${version.label} 采集截图`} onLoad={onImgLoad} />
                  {highlightStyle && (
                    <div className="element-highlight" style={highlightStyle} />
                  )}
                </div>
              ) : (
                <div className="dom-preview">
                  <span className="dom-kicker">渲染后 DOM 摘要</span>
                  <h3>{version?.title || issue.region || "原型位置"}</h3>
                  <p>{version?.visibleText.slice(0, 700) || "该版本没有可展示的截图或可见文本。"}</p>
                </div>
              )}
              <div className="location-callout" style={calloutStyle}>
                <strong>{issue.region || "Agent 定位区域"}</strong>
                <span>{issue.selector || "未提供稳定选择器"}</span>
              </div>
            </div>
          </div>

          {/* ── Evidence section: split customer / dev (Fix #2) ── */}
          <div className="evidence-heading">
            <h2>关联证据</h2>
            <button className="add-evidence-btn" onClick={() => setShowAddEvidence((v) => !v)} disabled={evidenceBusy}>
              ＋ 添加证据
            </button>
          </div>

          {showAddEvidence && (
            <form className="evidence-add-form" onSubmit={addEvidence}>
              <div className="field-row">
                <label className="field">归属方
                  <select name="side" defaultValue="development">
                    <option value="customer">业务侧（客户 / 售前 / 产品负责人）</option>
                    <option value="development">研发与原型侧</option>
                  </select>
                </label>
                <label className="field">引用已有资料
                  <select name="sourceId" defaultValue="">
                    <option value="">— 直接输入原文 —</option>
                    {availableSources.map((s) => (
                      <option key={s.id} value={s.id}>{s.kind} · {s.title}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">证据原文<textarea name="quoteText" required placeholder="粘贴原文摘录，Agent 不会自动把输入当成事实" /></label>
              <label className="field">原文位置<input name="sourceLocation" placeholder="例如：第3段 / body > .reply-area" /></label>
              {evidenceError ? <div className="form-error">{evidenceError}</div> : null}
              <div className="form-actions">
                <button type="button" onClick={() => { setShowAddEvidence(false); setEvidenceError(""); }}>取消</button>
                <button className="primary-button" disabled={evidenceBusy}>{evidenceBusy ? "正在保存…" : "保存证据"}</button>
              </div>
            </form>
          )}

          <div className="evidence-split">
            {/* ── Left: Customer side ── */}
            <div className="evidence-column">
              <div className="evidence-column-head">
                <span className="evidence-col-dot customer" />
                <strong>业务侧 · 客户 / 售前 / 产品负责人</strong>
              </div>
              {customerEvidence.length ? customerEvidence.map((ev) => (
                <EvidenceCard key={ev.id} evidence={ev} />
              )) : <div className="evidence-card empty-hint">暂无可追溯的业务侧证据。<br />点击上方「＋ 添加证据」手动关联。</div>}
            </div>
            {/* ── Right: Dev & prototype side ── */}
            <div className="evidence-column">
              <div className="evidence-column-head">
                <span className="evidence-col-dot dev" />
                <strong>研发与原型侧 · 约束 / 技术限制 / DOM</strong>
              </div>
              {devEvidence.length ? devEvidence.map((ev) => (
                <EvidenceCard key={ev.id} evidence={ev} />
              )) : <div className="evidence-card empty-hint">暂无可追溯的研发侧或原型证据。</div>}
            </div>
          </div>
        </>
      )}
      {sources.length === 0 && issue ? <span className="honesty-note">当前项目没有文本资料；AI 推断不会被当成已确认事实。</span> : null}
    </section>
  );
}

function EvidenceCard({ evidence }: { evidence: IssueEvidence }) {
  return (
    <article className="evidence-card">
      <header>
        <strong>{evidence.sourceTitle || evidence.versionLabel || "原型 DOM"}</strong>
        <span>{evidence.sourceLocation || evidence.selector || "位置待确认"}</span>
      </header>
      <p>{evidence.quoteText}</p>
      <small>{evidence.sourceId ? "资料原文" : "原型 DOM 证据"}</small>
    </article>
  );
}

/* ═══════════════════════════════════════════
   Run Comparison View (unchanged logic)
   ═══════════════════════════════════════════ */

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
