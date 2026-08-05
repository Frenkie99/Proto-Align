"use client";

import type { AgentEvent, Issue } from "@/lib/types";

const groups: Array<{ label: string; statuses: string[]; signal: string }> = [
  { label: "阻塞问题", statuses: ["待处理", "重新打开"], signal: "strong" },
  { label: "待确认", statuses: ["AI 草稿", "待确认", "待澄清"], signal: "mid" },
  { label: "处理中", statuses: ["处理中", "待验证"], signal: "soft" },
  { label: "已处理", statuses: ["已解决", "已延后", "已接受风险"], signal: "quiet" },
];

export function IssueList({
  issues,
  selectedIssueId,
  onSelect,
  events,
  onOpenActivity,
}: {
  issues: Issue[];
  selectedIssueId: string | null;
  onSelect: (issueId: string) => void;
  events: AgentEvent[];
  onOpenActivity: () => void;
}) {
  return (
    <aside className="left-pane">
      <div className="pane-head">
        <h2>问题列表</h2>
        <span>{issues.length ? `${issues.length} 项` : "等待首次评审"}</span>
      </div>
      <div className="issue-scroll">
        {issues.length === 0 ? (
          <div className="pane-empty compact">
            <span className="empty-mark">ISS</span>
            <strong>尚无问题</strong>
            <p>导入原型与资料后启动评审，Agent 将生成最多三条有证据的问题草稿。</p>
          </div>
        ) : null}
        {groups.map((group) => {
          const groupIssues = issues.filter((issue) => group.statuses.includes(issue.status));
          if (!groupIssues.length) return null;
          return (
            <section className="issue-group" key={group.label}>
              <div className="group-title">
                <span className={`signal ${group.signal}`} />
                {group.label} <em>{groupIssues.length}</em>
              </div>
              {groupIssues.map((issue) => (
                <button
                  className={`issue-card ${selectedIssueId === issue.id ? "active" : ""}`}
                  key={issue.id}
                  onClick={() => onSelect(issue.id)}
                >
                  <span className="issue-location">{issue.versionLabel || "未关联版本"} · {issue.region || "待定位"}</span>
                  <h3>{issue.title}</h3>
                  <span className="issue-foot">
                    <span className="tag">{issue.sourceKind}</span>
                    <span>{issue.status}</span>
                  </span>
                </button>
              ))}
            </section>
          );
        })}
      </div>
      <button className="activity-summary" onClick={onOpenActivity}>
        <span>
          <strong>活动追踪</strong>
          <small>{events.length ? `${events.length} 条真实工具事件` : "还没有 Agent 行动"}</small>
        </span>
        <span>查看 →</span>
      </button>
    </aside>
  );
}
