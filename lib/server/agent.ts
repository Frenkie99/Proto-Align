import "server-only";

import { Agent, OpenAIProvider, Runner, setTracingDisabled, tool } from "@openai/agents";
import { z } from "zod";
import {
  addAgentEvent,
  createRun,
  discardReviewRunDrafts,
  finishRun,
  getIssue,
  getProject,
  getWorkspace,
  insertClaimDraft,
  insertIssueDraft,
  insertVerification,
  inspectPrototypeData,
  nextAgentEventSequence,
  searchSourceChunks,
  updateAgentEvent,
} from "./repository";

const MODEL = "deepseek-v4-pro";
const BASE_URL = "https://api.deepseek.com";

type RunInput = { projectId: string; mode: "review" | "verify"; versionId: string; issueId?: string };

export async function executeAgentRun(input: RunInput) {
  const project = getProject(input.projectId);
  const workspace = getWorkspace(input.projectId);
  const targetVersion = workspace.versions.find((version) => version.id === input.versionId);
  if (!targetVersion || targetVersion.captureStatus !== "captured") throw new Error("请选择已完成 DOM 采集的原型版本");
  if (!workspace.sources.length) throw new Error("请先导入至少一份真实文本资料或角色反馈");
  if (input.mode === "verify" && !input.issueId) throw new Error("复检必须指定历史问题");

  const runId = createRun({ projectId: input.projectId, mode: input.mode, model: MODEL, versionId: input.versionId, issueId: input.issueId });
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    addAgentEvent(runId, { sequence: 1, toolName: "model_connection", eventType: "error", paramsSummary: `模型：${MODEL}`, resultSummary: "服务端未配置 DEEPSEEK_API_KEY", status: "failed", durationMs: 0 });
    finishRun(runId, "failed", "服务端未配置 DEEPSEEK_API_KEY");
    throw new Error("DeepSeek 运行失败：服务端未配置 DEEPSEEK_API_KEY");
  }

  setTracingDisabled(true);
  const provider = new OpenAIProvider({ apiKey, baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || BASE_URL, useResponses: false, strictFeatureValidation: true });
  const counters = { savedIssues: 0, savedClaims: 0, clarifications: 0, verifications: 0 };
  try {
    const tools = input.mode === "verify"
      ? createVerificationTools({ ...input, runId }, counters)
      : createReviewTools({ ...input, runId }, counters);
    const agent = new Agent({
      name: "Prototype Review Agent",
      model: MODEL,
      instructions: input.mode === "verify" ? verificationInstructions : reviewInstructions,
      tools,
      toolUseBehavior: () => {
        if (input.mode === "verify" && counters.verifications > 0) {
          return { isFinalOutput: true, isInterrupted: undefined, finalOutput: "复检结论已保存，等待产品经理确认。" };
        }
        if (input.mode === "review" && counters.savedIssues >= 1) {
          return { isFinalOutput: true, isInterrupted: undefined, finalOutput: "高价值 Issue 草稿已保存，等待产品经理确认。" };
        }
        return { isFinalOutput: false, isInterrupted: undefined };
      },
      modelSettings: {
        providerData: { thinking: { type: "disabled" } },
        parallelToolCalls: false,
        maxTokens: 5_000,
      },
    });
    const runner = new Runner({ modelProvider: provider, tracingDisabled: true });
    const prompt = input.mode === "verify"
      ? `复检项目“${project.name}”中的问题 ${input.issueId}。目标版本 ID：${input.versionId}。先读取问题上下文，再比较历史版本和目标版本，最后保存一条复检结论。`
      : `评审项目“${project.name}”。产品目标：${project.goal}。评审范围：${project.scope}。目标原型版本 ID：${input.versionId}。已导入资料：${workspace.sources.map((source) => `${source.kind}《${source.title}》`).join("、")}。请自主选择具体检索词并检查原型，最多保存三条高价值 Issue 草稿，同时提取必要的待确认主张。`;
    const startedAt = Date.now();
    const result = await runner.run(agent, prompt, { maxTurns: 8 });
    const validResult = input.mode === "verify" ? counters.verifications > 0 : counters.savedIssues > 0 || counters.clarifications > 0;
    if (!validResult) throw new Error(input.mode === "verify" ? "模型没有保存结构化复检结论" : "模型没有保存 Issue 草稿或提出澄清问题");
    addAgentEvent(runId, {
      sequence: nextAgentEventSequence(runId), toolName: "agent_complete", eventType: "result", paramsSummary: `模式：${input.mode}`,
      resultSummary: summarize(String(result.finalOutput || "Agent 已完成运行"), 300), status: "completed", durationMs: Date.now() - startedAt,
    });
    finishRun(runId, "completed");
    return runId;
  } catch (cause) {
    const message = safeModelError(cause);
    if (input.mode === "review") discardReviewRunDrafts(runId);
    addAgentEvent(runId, { sequence: nextAgentEventSequence(runId), toolName: "agent_run", eventType: "error", paramsSummary: `模型：${MODEL}`, resultSummary: message, status: "failed", durationMs: null });
    finishRun(runId, "failed", message);
    throw new Error(`DeepSeek Agent 运行失败：${message}`);
  } finally {
    await provider.close();
  }
}

function createReviewTools(context: RunInput & { runId: string }, counters: { savedIssues: number; savedClaims: number; clarifications: number }) {
  const searchSources = loggedTool(context.runId, {
    name: "search_sources",
    description: "按关键词和可选资料类型检索当前项目的真实文本资料，返回可引用的 sourceId、chunkId、原文与位置。",
    parameters: z.object({ query: z.string().max(200), kind: z.string().max(60).nullable() }),
    execute: ({ query, kind }: { query: string; kind: string | null }) => searchSourceChunks(context.projectId, query, normalizeOptional(kind)),
  });
  const listPrototypePages = loggedTool(context.runId, {
    name: "list_prototype_pages",
    description: "列出当前项目已真实采集的原型版本与页面，供你决定检查哪个版本。",
    parameters: z.object({}),
    execute: () => getWorkspace(context.projectId).versions.map((version) => ({ id: version.id, label: version.label, title: version.title, pageUrl: version.pageUrl, captureStatus: version.captureStatus })),
  });
  const inspectPrototype = loggedTool(context.runId, {
    name: "inspect_prototype",
    description: "读取指定原型版本的渲染后可见文字、交互控件与 DOM 稳定选择器。",
    parameters: z.object({ versionId: z.string(), focus: z.string().max(200).nullable() }),
    execute: ({ versionId, focus }: { versionId: string; focus: string | null }) => {
      const snapshot = inspectPrototypeData(versionId);
      if (snapshot.projectId !== context.projectId) throw new Error("该原型不属于当前项目");
      const focusTerms = (normalizeOptional(focus) || "").toLowerCase().split(/\s+/).filter(Boolean);
      const matching = focusTerms.length ? snapshot.elements.filter((item) => focusTerms.some((term) => JSON.stringify(item).toLowerCase().includes(term))).slice(0, 80) : snapshot.elements.slice(0, 120);
      return { id: snapshot.id, label: snapshot.label, title: snapshot.title, pageUrl: snapshot.pageUrl, visibleText: snapshot.visibleText.slice(0, 30_000), controls: snapshot.controls.slice(0, 120), matchingElements: matching };
    },
  });
  const saveClaimDraft = loggedTool(context.runId, {
    name: "save_claim_draft",
    description: "保存从真实资料提取的待确认主张。不要把客户或研发反馈直接标记为已确认事实。",
    parameters: z.object({ sourceId: z.string().nullable(), kind: z.enum(["项目目标", "事实", "需求", "约束", "承诺", "建议", "假设", "待确认项", "冲突"]), content: z.string().min(4).max(800), quoteText: z.string().max(1_200), sourceLocation: z.string().max(500), aiInference: z.boolean() }),
    execute: (args) => { const claimId = insertClaimDraft({ projectId: context.projectId, runId: context.runId, ...args, sourceId: normalizeOptional(args.sourceId) }); counters.savedClaims += 1; return { claimId, status: "pending", message: "已保存为待产品经理确认的主张" }; },
  });
  const saveIssueDraft = loggedTool(context.runId, {
    name: "save_issue_draft",
    description: "保存一条有证据、有原型位置和验证条件的 Issue 草稿。最多调用三次；不得确认事实或关闭问题。",
    parameters: IssueDraftSchema,
    execute: (args) => {
      if (counters.savedIssues >= 3) throw new Error("每次评审最多保存三条 Issue 草稿");
      if (!args.evidence.length) throw new Error("Issue 必须至少关联一条真实资料或 DOM 证据");
      const issueId = insertIssueDraft({
        projectId: context.projectId, runId: context.runId, ...args,
        versionId: normalizeOptional(args.versionId),
        evidence: args.evidence.map((item) => ({
          ...item,
          sourceId: normalizeOptional(item.sourceId),
          chunkId: normalizeOptional(item.chunkId),
          prototypeVersionId: normalizeOptional(item.prototypeVersionId),
          selector: normalizeOptional(item.selector),
        })),
      });
      counters.savedIssues += 1;
      return { issueId, status: "待确认", message: "已保存草稿，等待产品经理确认" };
    },
  });
  const requestClarification = loggedTool(context.runId, {
    name: "request_clarification",
    description: "证据不足时保存一个具体澄清问题及应询问的角色。",
    parameters: z.object({ question: z.string().min(4).max(600), role: z.string().min(2).max(100), reason: z.string().min(4).max(600) }),
    execute: ({ question, role, reason }) => { counters.clarifications += 1; const claimId = insertClaimDraft({ projectId: context.projectId, runId: context.runId, kind: "待确认项", content: question, quoteText: reason, sourceLocation: `建议确认角色：${role}`, aiInference: true }); return { claimId, status: "pending", message: "已记录澄清问题，未生成无依据 Issue" }; },
  });
  return [searchSources, listPrototypePages, inspectPrototype, saveClaimDraft, saveIssueDraft, requestClarification];
}

function createVerificationTools(context: RunInput & { runId: string }, counters: { verifications: number }) {
  const getIssueContext = loggedTool(context.runId, {
    name: "get_issue_context",
    description: "读取历史 Issue、真实证据、人的决定、验证条件和历史复检。",
    parameters: z.object({ issueId: z.string() }),
    execute: ({ issueId }: { issueId: string }) => { const issue = getIssue(issueId); if (issue.projectId !== context.projectId || issueId !== context.issueId) throw new Error("只能读取本次复检指定的问题"); return issue; },
  });
  const compareVersions = loggedTool(context.runId, {
    name: "compare_versions",
    description: "围绕指定 Issue 对比其历史原型版本与当前目标版本的真实 DOM 文本和控件变化。",
    parameters: z.object({ issueId: z.string(), toVersionId: z.string() }),
    execute: ({ issueId, toVersionId }: { issueId: string; toVersionId: string }) => {
      const issue = getIssue(issueId);
      if (issue.projectId !== context.projectId || issueId !== context.issueId || !issue.versionId) throw new Error("问题没有可比较的历史原型版本");
      if (toVersionId !== context.versionId) throw new Error("只能比较本次复检指定的目标版本");
      const before = inspectPrototypeData(issue.versionId);
      const after = inspectPrototypeData(toVersionId);
      if (after.projectId !== context.projectId) throw new Error("目标版本不属于当前项目");
      return buildVersionDiff(issue.verificationCriteria, before, after);
    },
  });
  const saveVerification = loggedTool(context.runId, {
    name: "save_verification",
    description: "保存复检建议。结果只能是疑似已解决、未解决、无法判断或引入新问题；不能关闭 Issue。",
    parameters: z.object({ issueId: z.string(), fromVersionId: z.string(), toVersionId: z.string(), result: z.enum(["疑似已解决", "未解决", "无法判断", "引入新问题"]), summary: z.string().min(4).max(1_200), evidence: z.array(z.object({ location: z.string().max(500), before: z.string().max(1_500), after: z.string().max(1_500) })).min(1).max(12) }),
    execute: (args) => { const issue = getIssue(args.issueId); if (issue.projectId !== context.projectId || args.issueId !== context.issueId || args.fromVersionId !== issue.versionId || args.toVersionId !== context.versionId) throw new Error("复检结论引用了本次范围之外的问题或版本"); const verificationId = insertVerification({ runId: context.runId, ...args }); counters.verifications += 1; return { verificationId, issueStatus: "待验证", message: "复检结论已保存，等待产品经理最终确认" }; },
  });
  return [getIssueContext, compareVersions, saveVerification];
}

const EvidenceSchema = z.object({ sourceId: z.string().nullable(), chunkId: z.string().nullable(), prototypeVersionId: z.string().nullable(), quoteText: z.string().min(1).max(1_500), sourceLocation: z.string().max(500), selector: z.string().max(800).nullable() });
const IssueDraftSchema = z.object({
  title: z.string().min(4).max(160), issueType: z.string().min(2).max(60), sourceKind: z.enum(["客户反馈", "研发反馈", "AI 推断·待确认", "多源冲突"]),
  severity: z.enum(["阻塞", "高", "中", "低"]), confidence: z.enum(["高", "中", "低"]), summary: z.string().min(4).max(1_200), impact: z.string().min(4).max(1_200), rationale: z.string().min(4).max(1_500),
  clarificationQuestion: z.string().max(800), clarificationRole: z.string().max(100), verificationCriteria: z.array(z.string().min(3).max(400)).min(1).max(8), versionId: z.string().nullable(), pageUrl: z.string().max(2_000), selector: z.string().max(800), region: z.string().min(1).max(160), evidence: z.array(EvidenceSchema).min(1).max(8),
});

const reviewInstructions = `你是 ProtoAlign 的唯一 Prototype Review Agent。你评审真实 AI 产品原型是否达到研发可开工状态。
必须先自主调用 search_sources 检索至少一份资料，再调用 list_prototype_pages 和 inspect_prototype 检查目标版本；工具结果必须影响后续判断。
search_sources 最多调用两次；kind 只能使用项目中实际存在的资料类型。若第一次结果为空，改用原文中更短的关键词或省略 kind，不要反复尝试无关词。
每次运行优先创建一条最高价值 Issue，最多不得超过三条。每条必须带至少一条可追溯资料原文或 DOM 证据、具体原型位置、影响、判断依据、需要确认的问题和可验证条件。
客户/研发反馈只是待确认主张，不等于正式需求。纯专业判断标记为“AI 推断·待确认”。严重程度与可信度分开。
可用 save_claim_draft 保存待确认主张；证据不足时调用 request_clarification，不得编造证据。
用 save_issue_draft 保存问题后，仅简短汇总。不得接受风险、确认事实、关闭 Issue 或宣布最终交付。不得输出隐藏思维链。`;

const verificationInstructions = `你是 ProtoAlign 的 Prototype Review Agent，当前只做跨版本复检。
必须先调用 get_issue_context，再调用 compare_versions；根据历史验证条件和真实 DOM 差异调用 save_verification。
复检结果只能是“疑似已解决 / 未解决 / 无法判断 / 引入新问题”，并至少保存一条前后版本证据。
页面有变化不等于问题解决。你只能提出复检建议并把 Issue 标记到待验证，不能关闭问题、接受风险或确认最终交付。不得输出隐藏思维链。`;

function loggedTool<TSchema extends z.ZodObject<z.ZodRawShape>, TResult>(runId: string, definition: { name: string; description: string; parameters: TSchema; execute: (args: z.infer<TSchema>) => TResult | Promise<TResult> }) {
  return tool({
    name: definition.name,
    description: definition.description,
    parameters: definition.parameters as never,
    strict: true,
    timeoutMs: 20_000,
    timeoutBehavior: "raise_exception",
    async execute(args) {
      const sequence = nextAgentEventSequence(runId);
      const startedAt = Date.now();
      const eventId = addAgentEvent(runId, { sequence, toolName: definition.name, eventType: "tool_call", paramsSummary: summarize(JSON.stringify(args), 240), resultSummary: "", status: "running", durationMs: null });
      try {
        const result = await definition.execute(args as z.infer<TSchema>);
        updateAgentEvent(eventId, { resultSummary: summarize(JSON.stringify(result), 420), status: "completed", durationMs: Date.now() - startedAt });
        return result;
      } catch (cause) {
        const message = safeModelError(cause);
        updateAgentEvent(eventId, { resultSummary: message, status: "failed", durationMs: Date.now() - startedAt });
        throw cause;
      }
    },
  });
}

function buildVersionDiff(criteria: string[], before: ReturnType<typeof inspectPrototypeData>, after: ReturnType<typeof inspectPrototypeData>) {
  const beforeLines = uniqueLines(before.visibleText);
  const afterLines = uniqueLines(after.visibleText);
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const added = afterLines.filter((line) => !beforeSet.has(line)).slice(0, 80);
  const removed = beforeLines.filter((line) => !afterSet.has(line)).slice(0, 80);
  return {
    fromVersion: { id: before.id, label: before.label, pageUrl: before.pageUrl },
    toVersion: { id: after.id, label: after.label, pageUrl: after.pageUrl },
    criteria,
    addedVisibleText: added,
    removedVisibleText: removed,
    controlsBefore: before.controls.slice(0, 120),
    controlsAfter: after.controls.slice(0, 120),
    warning: "这是 DOM/文案差异证据，不代表问题已经解决，需按验证条件判断。",
  };
}

function uniqueLines(text: string) { return [...new Set(text.split(/\n+/).map((line) => line.trim().replace(/\s+/g, " ")).filter((line) => line.length >= 2))]; }
function summarize(value: string, limit: number) { return value.length > limit ? `${value.slice(0, limit)}…` : value; }
function normalizeOptional(value: string | null | undefined) { return value && value !== "null" ? value : undefined; }
function safeModelError(cause: unknown) { const raw = cause instanceof Error ? cause.message : "未知模型或工具错误"; return raw.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[已隐藏]").replaceAll(process.cwd(), "[项目目录]").slice(0, 800); }
