"use client";

import { canResolveIssue } from "@/lib/core/issues";
import type { Issue } from "@/lib/types";

const statusActions = [
  ["处理中", "开始处理", "primary"],
  ["待澄清", "发起澄清", ""],
  ["已延后", "延后", ""],
  ["待验证", "标记待验证", ""],
  ["已接受风险", "接受风险", "dark"],
  ["已解决", "关闭问题", ""],
  ["重新打开", "重新打开", ""],
] as const;

export function AgentPanel({
  issue,
  activityCount,
  onOpenActivity,
  onStatusAction,
}: {
  issue: Issue | null;
  activityCount: number;
  onOpenActivity: () => void;
  onStatusAction: (status: string) => void;
}) {
  return (
    <aside className="right-pane">
      <div className="pane-head">
        <h2>Agent 助手</h2>
        <button className="text-button" onClick={onOpenActivity}>活动记录 · {activityCount}</button>
      </div>
      {!issue ? (
        <div className="agent-empty">
          <span className="agent-symbol">P</span>
          <h3>等待真实评审</h3>
          <p>Agent 的解读、证据、确认问题与验证条件会在运行成功后显示。API 失败时这里不会出现虚拟结果。</p>
        </div>
      ) : (
        <div className="agent-scroll">
          <div className="agent-intro">
            <span className="agent-kicker"><i>AI</i> 问题解读</span>
            <h3>{issue.title}</h3>
            <p>{issue.summary}</p>
          </div>
          <AgentSection title="为什么重要"><p>{issue.impact}</p></AgentSection>
          <AgentSection title="判断依据"><p>{issue.rationale}</p></AgentSection>
          <AgentSection title="建议确认问题">
            <div className="confirm-box">
              <p>{issue.clarificationQuestion || "当前证据足以形成草稿，仍需产品经理确认问题是否成立。"}</p>
              {issue.clarificationRole ? <small>建议确认角色：{issue.clarificationRole}</small> : null}
            </div>
          </AgentSection>
          <AgentSection title="验证标准（验收条件）">
            <div className="checklist">
              {issue.verificationCriteria.map((criterion) => <div className="check-row" key={criterion}><span />{criterion}</div>)}
            </div>
          </AgentSection>
          {issue.verifications[0] ? (
            <AgentSection title="最近复检结论">
              <div className="verification-box">
                <strong>{issue.verifications[0].result}</strong>
                <p>{issue.verifications[0].summary}</p>
                <small>{issue.verifications[0].fromVersionLabel} → {issue.verifications[0].toVersionLabel} · 等待人工确认</small>
              </div>
            </AgentSection>
          ) : null}
          <AgentSection title="人的决定记录">
            {issue.decisions.length ? issue.decisions.slice(0, 3).map((decision) => (
              <div className="decision-row" key={decision.id}><strong>{decision.action}</strong><p>{decision.reason}</p><small>{decision.actor} · {formatTime(decision.createdAt)}</small></div>
            )) : <p className="muted-copy">尚未记录产品经理决定。</p>}
          </AgentSection>
        </div>
      )}
      <div className="agent-actions">
        <h3>问题操作</h3>
        <div className="action-grid">
          {statusActions.map(([status, label, tone]) => (
            <button
              key={status}
              className={`action-button ${tone}`}
              disabled={!issue || (status === "已解决" && !canResolveIssue(issue.verifications[0]?.result))}
              title={status === "已解决" && !canResolveIssue(issue?.verifications[0]?.result) ? "仅当最新复检结论为“疑似已解决”时可由产品经理关闭" : undefined}
              onClick={() => onStatusAction(status)}
            >{label}</button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function AgentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="agent-section"><h3>{title}</h3>{children}</section>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
