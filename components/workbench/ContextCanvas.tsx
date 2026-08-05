"use client";

import type { Claim, Issue, PrototypeVersion, SourceItem } from "@/lib/types";

export type CanvasView = "review" | "baseline" | "versions";

export function ContextCanvas({
  view,
  issue,
  version,
  claims,
  versions,
  sources,
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
                </span>
                <span className={`capture-state ${item.captureStatus}`}>{captureLabel(item)}</span>
              </article>
            )) : <EmptyCanvas title="尚未导入原型" copy="从“导入资料”中添加可访问 URL、单文件 HTML 或静态构建 ZIP。" />}
          </div>
        </div>
      </section>
    );
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
