"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { canResolveIssue } from "@/lib/core/issues";
import type { Issue } from "@/lib/types";

/* ── All possible actions with their target status (Fix #3: wider conditions) ── */
const allActions: Array<{ status: string; label: string; tone: string; applies: (issue: Issue) => boolean }> = [
  { status: "处理中", label: "开始处理", tone: "primary", applies: (issue) => ["AI 草稿", "待确认", "待处理", "待澄清", "重新打开"].includes(issue.status) },
  { status: "待澄清", label: "发起澄清", tone: "", applies: (issue) => ["AI 草稿", "待确认", "待处理"].includes(issue.status) },
  { status: "已延后", label: "延后", tone: "", applies: (issue) => ["AI 草稿", "待确认", "待处理", "待澄清", "处理中", "待验证"].includes(issue.status) },
  { status: "待验证", label: "标记待验证", tone: "", applies: (issue) => issue.status === "处理中" },
  { status: "已接受风险", label: "接受风险", tone: "dark", applies: (issue) => ["AI 草稿", "待确认", "待处理", "待澄清", "处理中", "待验证"].includes(issue.status) },
  { status: "已解决", label: "关闭问题", tone: "primary", applies: (issue) => issue.status === "待验证" && canResolveIssue(issue.verifications[0]?.result) },
  { status: "重新打开", label: "重新打开", tone: "", applies: (issue) => ["已解决", "已延后", "已接受风险"].includes(issue.status) },
];

export function AgentPanel({
  issue,
  projectId,
  activityCount,
  onOpenActivity,
  onStatusAction,
}: {
  issue: Issue | null;
  projectId: string | null;
  activityCount: number;
  onOpenActivity: () => void;
  onStatusAction: (status: string) => void;
}) {
  const visibleActions = issue ? allActions.filter((a) => a.applies(issue)) : [];

  /* ── Fix #4: Chat state ── */
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "agent"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || !issue || !projectId) return;
    setChatInput("");
    setChatError("");
    setChatMessages((prev) => [...prev, { role: "user", text: message }]);
    setChatBusy(true);
    try {
      const { answer } = await api.chatWithAgent(projectId, { issueId: issue.id, message });
      setChatMessages((prev) => [...prev, { role: "agent", text: answer }]);
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : "Agent 暂时无法回复");
    } finally {
      setChatBusy(false);
    }
  }

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
        <>
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

            {/* ── Chat thread ── */}
            {chatMessages.length > 0 && (
              <AgentSection title="对话记录">
                <div className="chat-thread">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`chat-msg ${msg.role}`}>
                      <span className="chat-role">{msg.role === "user" ? "你" : "Agent"}</span>
                      <p>{msg.text}</p>
                    </div>
                  ))}
                  {chatBusy && <div className="chat-msg agent"><span className="chat-role">Agent</span><p className="chat-typing">正在查找资料…</p></div>}
                  {chatError && <div className="chat-msg agent error"><p>{chatError}</p></div>}
                </div>
              </AgentSection>
            )}

            {/* ── Fix #3: Merged decision section ── */}
            <section className="agent-section">
              <h3>人的决定记录</h3>
              {issue.decisions.length ? (
                <div className="decision-list">
                  {issue.decisions.slice(0, 5).map((decision) => (
                    <div className="decision-row" key={decision.id}>
                      <div className="decision-head">
                        <strong>{decision.action}</strong>
                        <small>{decision.actor} · {formatTime(decision.createdAt)}</small>
                      </div>
                      <p className="decision-reason">{decision.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">尚未记录产品经理决定。下方按钮触发状态变更后，操作记录会显示在这里。</p>
              )}
              {visibleActions.length > 0 && (
                <div className="decision-actions">
                  <span className="decision-actions-label">新增决定 · 当前状态：{issue.status}</span>
                  <div className={`action-grid action-grid-${Math.min(visibleActions.length, 4)}`}>
                    {visibleActions.map(({ status, label, tone }) => (
                      <button key={status} className={`action-button ${tone}`} onClick={() => onStatusAction(status)}>{label}</button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Fix #4: Chat input bar, pinned to bottom ── */}
          <form className="chat-bar" onSubmit={sendChat}>
            <input
              name="message"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={chatBusy ? "Agent 正在思考…" : "向 Agent 追问当前问题…"}
              disabled={chatBusy}
              autoComplete="off"
            />
            <button type="submit" disabled={chatBusy || !chatInput.trim()}>发送</button>
          </form>
        </>
      )}
    </aside>
  );
}

function AgentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="agent-section"><h3>{title}</h3>{children}</section>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
