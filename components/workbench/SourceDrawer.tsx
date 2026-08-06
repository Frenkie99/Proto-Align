"use client";

import { useState, type FormEvent } from "react";
import { reviewabilityLabel } from "@/lib/core/prototype-quality";
import type { PrototypeVersion, SourceItem } from "@/lib/types";

type ImportMode = "source" | "feedback" | "prototype";

export function SourceDrawer({
  open,
  onClose,
  sources,
  versions,
  onAddSource,
  onAddPrototype,
  publicMode = false,
}: {
  open: boolean;
  onClose: () => void;
  sources: SourceItem[];
  versions: PrototypeVersion[];
  onAddSource: (formData: FormData) => Promise<void>;
  onAddPrototype: (formData: FormData) => Promise<void>;
  publicMode?: boolean;
}) {
  const [mode, setMode] = useState<ImportMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return;
    setBusy(true);
    setError("");
    try {
      const formData = new FormData(event.currentTarget);
      if (mode === "prototype") await onAddPrototype(formData);
      else await onAddSource(formData);
      setMode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="source-drawer" role="dialog" aria-modal="true" aria-label="资料与输入">
        <header className="source-head">
          <div><h2>资料与输入</h2><p>项目级上下文 · 原型与评审依据分开管理</p></div>
          <button className="icon-button" onClick={onClose}>×</button>
        </header>
        <div className="source-body">
          <div className="source-principle"><strong>输入原则：</strong>原型版本是被评审对象；文本资料和角色反馈是评审依据。当前真实支持 URL、HTML、静态 ZIP、纯文本与 Markdown。</div>
          {publicMode ? <p className="public-demo-warning"><strong>公开演示提醒：</strong>请勿上传机密、客户或个人资料。输入会保存在当前单机演示环境中，模型或工具失败会如实显示，不会生成虚拟结果。</p> : null}
          {!mode ? (
            <>
              <div className="section-heading"><h3>添加输入</h3><span>保存后由真实采集器或 Agent 处理</span></div>
              <div className="import-grid">
                <ImportCard title="导入原型版本" copy="可访问 URL、单文件 HTML 或静态构建 ZIP" action="作为新版本 →" onClick={() => setMode("prototype")} />
                <ImportCard title="录入角色反馈" copy="保留客户、售前、研发或产品负责人的原始表达" action="保留角色与原文 →" onClick={() => setMode("feedback")} />
                <ImportCard title="添加文本资料" copy="手工粘贴，或上传 TXT / Markdown / HTML 文本" action="建立项目证据 →" onClick={() => setMode("source")} />
              </div>
              <div className="section-heading"><h3>已导入资料</h3><span>{sources.length + versions.length} 项</span></div>
              <div className="source-list">
                {versions.map((version) => (
                  <div className="source-row" key={version.id}><span className="source-kind">版</span><span><strong>{version.title || `${version.label} 原型`}</strong><small>{version.label} · {version.sourceType.toUpperCase()} · {version.pageUrl || version.sourceUrl || "本地文件"}</small><small>{version.reviewabilityReason}</small></span><em className={version.reviewability === "reviewable" ? "" : "failed"}>{version.captureStatus === "captured" ? `DOM 已采集 · ${reviewabilityLabel(version.reviewability)}` : reviewabilityLabel(version.reviewability)}</em></div>
                ))}
                {sources.map((source) => (
                  <div className="source-row" key={source.id}><span className="source-kind">{source.kind.includes("反馈") ? "馈" : "资"}</span><span><strong>{source.title}</strong><small>{source.kind} · {source.role} · {source.originalLocation || "手工录入"}</small></span><em>{source.parseStatus}</em></div>
                ))}
                {!sources.length && !versions.length ? <div className="source-empty">还没有项目资料。请先导入一个真实原型版本和评审依据。</div> : null}
              </div>
            </>
          ) : (
            <form className="import-form" onSubmit={submit}>
              <button className="back-button" type="button" onClick={() => { setMode(null); setError(""); }}>← 返回输入类型</button>
              <h3>{mode === "prototype" ? "导入原型版本" : mode === "feedback" ? "录入角色反馈" : "添加文本资料"}</h3>
              {mode === "prototype" ? <PrototypeFields nextVersion={nextVersionLabel(versions)} /> : <SourceFields feedback={mode === "feedback"} />}
              {error ? <div className="form-error">{error}</div> : null}
              <div className="form-actions"><button type="button" onClick={() => setMode(null)}>取消</button><button className="primary-button" disabled={busy}>{busy ? "正在处理真实输入…" : "保存并处理"}</button></div>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}

function ImportCard({ title, copy, action, onClick }: { title: string; copy: string; action: string; onClick: () => void }) {
  return <button className="import-card" onClick={onClick}><strong>{title}</strong><span>{copy}</span><em>{action}</em></button>;
}

function SourceFields({ feedback }: { feedback: boolean }) {
  return (
    <>
      <div className="field-row">
        <label className="field">资料类型<select name="kind" defaultValue={feedback ? "客户反馈" : "需求文档"}>{feedback ? <><option>客户反馈</option><option>研发反馈</option><option>售前反馈</option><option>产品负责人反馈</option></> : <><option>需求文档</option><option>会议纪要</option><option>研发记录</option><option>其他资料</option></>}</select></label>
        <label className="field">来源角色<input name="role" required placeholder={feedback ? "例如：甲方一线用户" : "例如：产品经理"} /></label>
      </div>
      <label className="field">标题<input name="title" required placeholder="资料或反馈标题" /></label>
      <label className="field">原始位置<input name="originalLocation" placeholder="文件名、会议时间或章节" /></label>
      <label className="field">原文<textarea name="content" placeholder="粘贴原始文本；Agent 提取不会自动成为事实" /></label>
      {!feedback ? <label className="field">或上传文本文件<input name="file" type="file" accept=".txt,.md,.html,text/plain,text/markdown,text/html" /></label> : null}
    </>
  );
}

function PrototypeFields({ nextVersion }: { nextVersion: string }) {
  return (
    <>
      <div className="field-row">
        <label className="field">版本标识<input name="label" required defaultValue={nextVersion} /></label>
        <label className="field">导入方式<select name="sourceType" defaultValue="url"><option value="url">可访问 URL</option><option value="html">单文件 HTML</option><option value="zip">静态构建 ZIP</option></select></label>
      </div>
      <label className="field">原型 URL<input name="url" type="url" placeholder="https://…（使用文件上传时可留空）" /></label>
      <label className="field">HTML 或 ZIP 文件<input name="file" type="file" accept=".html,.htm,.zip,text/html,application/zip" /></label>
      <label className="field">版本说明<textarea name="notes" placeholder="本次版本范围或主要改动（可选）" /></label>
      <p className="security-note">上传内容只作为静态网页在受控浏览器中运行，不执行任何服务端代码。</p>
    </>
  );
}

function nextVersionLabel(versions: PrototypeVersion[]) {
  const numbers = versions.map((version) => Number(version.label.replace(/\D/g, ""))).filter(Number.isFinite);
  return `V${Math.max(0, ...numbers) + 1}`;
}
