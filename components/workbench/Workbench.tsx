"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { reviewabilityLabel } from "@/lib/core/prototype-quality";
import type { AgentEvent, Issue, ProjectSummary, WorkspaceData } from "@/lib/types";
import { AgentPanel } from "./AgentPanel";
import { ContextCanvas, type CanvasView } from "./ContextCanvas";
import { IssueList } from "./IssueList";
import { Modal } from "./Modal";
import { SourceDrawer } from "./SourceDrawer";

export function Workbench({ publicMode = false }: { publicMode?: boolean }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [view, setView] = useState<CanvasView>("review");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [demoGuideOpen, setDemoGuideOpen] = useState(publicMode);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"issues" | "agent" | null>(null);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; message: string } | null>(null);

  const loadWorkspace = useCallback(async (projectId: string) => {
    const next = await api.getWorkspace(projectId);
    setWorkspace(next);
    setProjects((current) => current.map((item) => item.id === projectId ? next.project : item));
    setSelectedIssueId((current) => {
      if (next.issues.some((issue) => issue.id === current)) return current;
      const demonstratedLoop = publicMode ? next.issues.find((issue) => issue.verifications.length > 0 && issue.decisions.length > 0) : null;
      return demonstratedLoop?.id ?? next.issues[0]?.id ?? null;
    });
    setSelectedVersionId((current) => next.versions.some((version) => version.id === current) ? current : next.versions.at(-1)?.id ?? null);
    setSelectedClaimIds([]);
  }, [publicMode]);

  useEffect(() => {
    let active = true;
    api.listProjects()
      .then(async ({ projects: items }) => {
        if (!active) return;
        setProjects(items);
        if (items[0]) {
          setSelectedProjectId(items[0].id);
          await loadWorkspace(items[0].id);
        }
      })
      .catch((error) => active && showError(error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadWorkspace]);

  const selectedIssue = useMemo(() => workspace?.issues.find((issue) => issue.id === selectedIssueId) ?? null, [workspace, selectedIssueId]);
  const selectedVersion = useMemo(() => workspace?.versions.find((version) => version.id === selectedVersionId) ?? null, [workspace, selectedVersionId]);
  const activityEvents = useMemo(() => workspace?.runs.flatMap((run) => run.events) ?? [], [workspace]);
  const canRun = Boolean(workspace?.sources.length && selectedVersion?.captureStatus === "captured" && selectedVersion.reviewability === "reviewable");
  const canVerify = Boolean(selectedIssue && selectedVersion && selectedIssue.versionId !== selectedVersion.id && workspace && workspace.versions.length > 1);

  function showError(cause: unknown) {
    const message = cause instanceof Error ? cause.message : "操作失败";
    setNotice({ tone: "error", message });
  }

  function showInfo(message: string) {
    setNotice({ tone: "info", message });
    window.setTimeout(() => setNotice((current) => current?.message === message ? null : current), 2600);
  }

  async function selectProject(projectId: string) {
    setLoading(true);
    setProjectMenuOpen(false);
    setSelectedProjectId(projectId);
    setView("review");
    try {
      await loadWorkspace(projectId);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = new FormData(event.currentTarget);
      const { project } = await api.createProject({
        name: String(data.get("name") || ""),
        goal: String(data.get("goal") || ""),
        scope: String(data.get("scope") || ""),
      });
      setProjects((current) => [project, ...current]);
      setSelectedProjectId(project.id);
      await loadWorkspace(project.id);
      setNewProjectOpen(false);
      setView("review");
      showInfo(`已创建空白项目“${project.name}”`);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function addSource(formData: FormData) {
    if (!selectedProjectId) return;
    await api.addSource(selectedProjectId, formData);
    await loadWorkspace(selectedProjectId);
    showInfo("资料已保存，等待 Agent 提取待确认主张");
  }

  async function addPrototype(formData: FormData) {
    if (!selectedProjectId) return;
    const { prototype } = await api.addPrototype(selectedProjectId, formData);
    await loadWorkspace(selectedProjectId);
    showInfo(prototype.reviewability === "reviewable" ? "原型已完成 DOM 采集，可开始评审" : `原型已采集，但识别为“${reviewabilityLabel(prototype.reviewability)}”`);
  }

  async function runAgent() {
    if (!selectedProjectId || !selectedVersionId) return;
    setBusy(true);
    setNotice(null);
    try {
      const input = canVerify && selectedIssueId
        ? { mode: "verify" as const, versionId: selectedVersionId, issueId: selectedIssueId }
        : { mode: "review" as const, versionId: selectedVersionId };
      await api.runAgent(selectedProjectId, input);
      await loadWorkspace(selectedProjectId);
      setActivityOpen(true);
      showInfo(input.mode === "verify" ? "复检已完成，等待你确认结论" : "评审已完成，Issue 仍为待确认草稿");
    } catch (error) {
      await loadWorkspace(selectedProjectId).catch(() => undefined);
      setActivityOpen(true);
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmClaims() {
    if (!selectedProjectId || !selectedClaimIds.length) return;
    setBusy(true);
    try {
      await api.confirmClaims(selectedProjectId, selectedClaimIds);
      await loadWorkspace(selectedProjectId);
      showInfo("已由产品经理确认所选需求与约束基线");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function updateIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIssue || !pendingStatus || !selectedProjectId) return;
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") || "").trim();
    setBusy(true);
    try {
      await api.updateIssue(selectedIssue.id, { status: pendingStatus, reason });
      await loadWorkspace(selectedProjectId);
      setPendingStatus(null);
      showInfo(`问题状态已更新为“${pendingStatus}”`);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-background">
      <div className="workbench-shell">
        <header className="top-bar">
          <button className="brand" onClick={() => setProjectMenuOpen((open) => !open)} aria-expanded={projectMenuOpen}>
            <span className="logo">P</span>
            <span><strong>{workspace?.project.name || "ProtoAlign"}</strong><small>{workspace ? "研发交付前评审" : "从空白项目开始"}</small></span>
            <i />
          </button>
          <nav className="main-nav" aria-label="工作台视图">
            <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}>问题评审</button>
            <button className={view === "baseline" ? "active" : ""} disabled={!workspace} onClick={() => setView("baseline")}>需求基线</button>
            <button className={view === "versions" ? "active" : ""} disabled={!workspace} onClick={() => setView("versions")}>版本记录</button>
            <button className={view === "comparison" ? "active" : ""} disabled={!workspace} onClick={() => setView("comparison")}>运行比较</button>
          </nav>
          <label className="version-select">原型版本
            <select value={selectedVersionId || ""} disabled={!workspace?.versions.length} onChange={(event) => setSelectedVersionId(event.target.value)}>
              {!workspace?.versions.length ? <option value="">未导入</option> : null}
              {workspace?.versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
            </select>
          </label>
          {publicMode ? <button className="guide-button" onClick={() => setDemoGuideOpen(true)}>作品导览</button> : null}
          <button className="source-button" disabled={!workspace} onClick={() => setSourceDrawerOpen(true)}>＋ 导入资料</button>
          <button className="mobile-toggle issues-toggle" disabled={!workspace} onClick={() => setMobilePane((pane) => pane === "issues" ? null : "issues")}>问题</button>
          <button className="mobile-toggle agent-toggle" disabled={!workspace} onClick={() => setMobilePane((pane) => pane === "agent" ? null : "agent")}>Agent</button>
          <span className="top-spacer" />
          <div className="top-actions">
            <span className="readiness">{workspace?.project.readinessSuggestion || "等待项目"}</span>
            <button className="run-button" disabled={!canRun || busy} title={selectedVersion && selectedVersion.reviewability !== "reviewable" ? selectedVersion.reviewabilityReason : undefined} onClick={runAgent}>{busy ? "真实运行中…" : selectedVersion && selectedVersion.reviewability !== "reviewable" ? "原型不可评审" : canVerify ? "启动复检" : "启动评审"}</button>
          </div>
        </header>

        <div className={`workspace-grid ${mobilePane ? `mobile-${mobilePane}` : ""}`}>
          {workspace ? (
            <>
              <IssueList issues={workspace.issues} selectedIssueId={selectedIssueId} onSelect={(id) => { setSelectedIssueId(id); setView("review"); setMobilePane(null); }} events={activityEvents} onOpenActivity={() => setActivityOpen(true)} />
              <ContextCanvas
                view={view}
                issue={selectedIssue}
                version={selectedVersion}
                claims={workspace.claims}
                versions={workspace.versions}
                sources={workspace.sources}
                issues={workspace.issues}
                runs={workspace.runs}
                projectId={workspace.project.id}
                selectedClaimIds={selectedClaimIds}
                onToggleClaim={(claimId) => setSelectedClaimIds((current) => current.includes(claimId) ? current.filter((id) => id !== claimId) : [...current, claimId])}
                onConfirmClaims={confirmClaims}
                isSavingClaims={busy}
                onWorkspaceChanged={async () => { if (selectedProjectId) await loadWorkspace(selectedProjectId); }}
              />
              <AgentPanel issue={selectedIssue} projectId={selectedProjectId} activityCount={activityEvents.length} onOpenActivity={() => setActivityOpen(true)} onStatusAction={setPendingStatus} />
            </>
          ) : (
            <div className="project-empty-state">
              <span className="empty-mark large">P</span>
              <h1>{loading ? "正在读取本地项目…" : "创建第一个空白项目"}</h1>
              <p>{loading ? "项目、资料与运行记录正在从服务端加载。" : "项目不会预置 Issue。请填写真实产品目标与评审范围，再导入你的 AI 产品和资料。"}</p>
              {!loading ? <button className="primary-button" onClick={() => setNewProjectOpen(true)}>＋ 新建项目</button> : null}
            </div>
          )}
        </div>
      </div>

      {projectMenuOpen ? (
        <div className="project-menu">
          <span className="menu-label">当前工作项目</span>
          {projects.map((project) => (
            <button className={project.id === selectedProjectId ? "active" : ""} key={project.id} onClick={() => selectProject(project.id)}>
              <span className="project-dot">{project.name.slice(0, 1)}</span>
              <span><strong>{project.name}</strong><small>{project.versionCount} 个版本 · {project.issueCount} 个问题</small></span>
              <em>{project.id === selectedProjectId ? "✓" : ""}</em>
            </button>
          ))}
          <button className="new-project-entry" onClick={() => { setProjectMenuOpen(false); setNewProjectOpen(true); }}>＋ 新建空白项目</button>
        </div>
      ) : null}

      <SourceDrawer open={sourceDrawerOpen} onClose={() => setSourceDrawerOpen(false)} sources={workspace?.sources || []} versions={workspace?.versions || []} onAddSource={addSource} onAddPrototype={addPrototype} publicMode={publicMode} />
      <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} events={activityEvents} runs={workspace?.runs || []} />
      <Modal open={newProjectOpen} title="新建空白项目" description="只建立项目上下文，不创建任何预置 Issue。" onClose={() => setNewProjectOpen(false)}>
        <form onSubmit={createProject}>
          <label className="field">项目名称<input name="name" required maxLength={80} placeholder="例如：销售话术生成助手" /></label>
          <label className="field">产品目标<textarea name="goal" required placeholder="这个 AI 产品要帮助谁完成什么目标？" /></label>
          <label className="field">本次评审范围<textarea name="scope" required placeholder="例如：候选话术生成、编辑、确认与发送流程" /></label>
          <div className="form-actions"><button type="button" onClick={() => setNewProjectOpen(false)}>取消</button><button className="primary-button" disabled={busy}>{busy ? "正在创建…" : "创建项目"}</button></div>
        </form>
      </Modal>
      <Modal open={demoGuideOpen} title="5 分钟看懂 ProtoAlign" description="建议先浏览真实记录，再决定是否创建空白项目亲自运行。" onClose={() => setDemoGuideOpen(false)} wide>
        <ol className="demo-guide-steps">
          <li><strong>Customer Service Agents · 完整闭环</strong><span>从证据看到 V1→V2 复检和产品经理关闭问题。打开左下角活动记录，确认工具事件不是预设动画。</span></li>
          <li><strong>OpenAgent · 工具与隔离</strong><span>查看工具权限、知识库隔离、审计与加载阻塞等另一类 AI 产品风险。</span></li>
          <li><strong>HuggingChat · 稳定性评审</strong><span>查看两次真实评审的共同主题和证据波动；系统不会把模型输出包装成确定事实。</span></li>
        </ol>
        <div className="demo-guide-boundary"><strong>真实试用：</strong>可新建空白项目，导入文本、TXT / Markdown、公开 URL、HTML 或静态 ZIP，再启动 DeepSeek Agent。请勿上传机密或个人资料；当前不支持 PDF、Figma、登录态和多页采集。</div>
        <div className="form-actions"><button type="button" onClick={() => { setDemoGuideOpen(false); setNewProjectOpen(true); }}>创建空白项目</button><button className="primary-button" type="button" onClick={() => setDemoGuideOpen(false)}>开始浏览精选案例</button></div>
      </Modal>
      <Modal open={Boolean(pendingStatus)} title={statusTitle(pendingStatus)} description="状态变化必须由产品经理确认并记录依据；Agent 不会自动执行。" onClose={() => setPendingStatus(null)}>
        <form onSubmit={updateIssue}>
          <label className="field">操作依据<textarea name="reason" required placeholder="记录事实依据、外部角色结论或你的取舍理由" /></label>
          <div className="form-actions"><button type="button" onClick={() => setPendingStatus(null)}>取消</button><button className="primary-button" disabled={busy}>确认操作</button></div>
        </form>
      </Modal>
      {notice ? <div className={`toast ${notice.tone}`}>{notice.message}<button onClick={() => setNotice(null)}>×</button></div> : null}
    </main>
  );
}

function ActivityDrawer({ open, onClose, events, runs }: { open: boolean; onClose: () => void; events: AgentEvent[]; runs: WorkspaceData["runs"] }) {
  if (!open) return null;
  const latestRun = runs[0];
  return (
    <div className="drawer-scrim activity-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="activity-drawer">
        <header className="source-head"><div><h2>Agent 活动记录</h2><p>只显示真实工具行动、参数摘要和结果，不展示隐藏思维链</p></div><button className="icon-button" onClick={onClose}>×</button></header>
        <div className="activity-body">
          {latestRun ? <div className={`run-banner ${latestRun.status}`}><strong>{latestRun.mode === "verify" ? "跨版本复检" : "首次原型评审"} · {runStatus(latestRun.status)}</strong><span>{latestRun.model}</span>{latestRun.errorMessage ? <p>{latestRun.errorMessage}</p> : null}</div> : null}
          {events.length ? events.map((event) => (
            <article className={`event-row ${event.status}`} key={event.id}>
              <span className="event-number">{String(event.sequence).padStart(2, "0")}</span>
              <span><strong>{event.toolName}</strong><small>{event.paramsSummary}</small><p>{event.resultSummary || (event.status === "running" ? "工具正在执行" : "没有结果摘要")}</p></span>
              <em>{event.durationMs == null ? "—" : `${event.durationMs}ms`}</em>
            </article>
          )) : <div className="source-empty">还没有 Agent 运行记录。启动评审后，这里只会出现真实事件。</div>}
        </div>
      </aside>
    </div>
  );
}

function statusTitle(status: string | null) {
  if (status === "已解决") return "确认关闭问题";
  if (status === "已接受风险") return "确认接受风险";
  return `更新问题状态为“${status || ""}”`;
}

function runStatus(status: string) {
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  return "运行中";
}
