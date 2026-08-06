import "server-only";

import { Agent, OpenAIProvider, Runner, setTracingDisabled, tool } from "@openai/agents";
import { z } from "zod";
import {
  addAgentEvent,
  createRun,
  finishRun,
  getIssue,
  getProject,
  getWorkspace,
  inspectPrototypeData,
  nextAgentEventSequence,
  searchSourceChunks,
  updateAgentEvent,
} from "./repository";

const MODEL = "deepseek-v4-pro";
const BASE_URL = "https://api.deepseek.com";

export async function executeChat(input: { projectId: string; issueId: string; message: string }) {
  const project = getProject(input.projectId);
  const workspace = getWorkspace(input.projectId);
  const issue = getIssue(input.issueId);
  if (issue.projectId !== input.projectId) throw new Error("该问题不属于当前项目");

  const runId = createRun({ projectId: input.projectId, mode: "review", model: MODEL, issueId: input.issueId });
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    addAgentEvent(runId, { sequence: 1, toolName: "model_connection", eventType: "error", paramsSummary: `模型：${MODEL}`, resultSummary: "未配置 DEEPSEEK_API_KEY", status: "failed", durationMs: 0 });
    finishRun(runId, "failed", "未配置 DEEPSEEK_API_KEY");
    throw new Error("DeepSeek 未配置");
  }

  setTracingDisabled(true);
  const provider = new OpenAIProvider({ apiKey, baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || BASE_URL, useResponses: false, strictFeatureValidation: true });

  try {
    const tools = createChatTools(input, runId);
    const agent = new Agent({
      name: "Prototype Review Agent",
      model: MODEL,
      instructions: chatInstructions,
      tools,
      modelSettings: {
        providerData: { thinking: { type: "disabled" } },
        parallelToolCalls: false,
        maxTokens: 3_000,
      },
    });
    const runner = new Runner({ modelProvider: provider, tracingDisabled: true });
    const targetVersion = workspace.versions.find((v) => issue.versionId === v.id);
    const prompt = `产品经理询问关于项目"${project.name}"中问题"${issue.title}"的问题。当前问题状态：${issue.status}。可参考的原型版本：${targetVersion?.label || "无"}。消息：${input.message}`;
    const startedAt = Date.now();
    const result = await runner.run(agent, prompt, { maxTurns: 4 });
    const answer = String(result.finalOutput || "Agent 没有返回内容。").slice(0, 2_000);
    addAgentEvent(runId, {
      sequence: nextAgentEventSequence(runId), toolName: "agent_chat", eventType: "result",
      paramsSummary: `问题：${input.message.slice(0, 120)}`,
      resultSummary: answer.slice(0, 300), status: "completed", durationMs: Date.now() - startedAt,
    });
    finishRun(runId, "completed");
    return { answer };
  } catch (cause) {
    const message = safeModelError(cause);
    addAgentEvent(runId, { sequence: nextAgentEventSequence(runId), toolName: "agent_chat", eventType: "error", paramsSummary: `模型：${MODEL}`, resultSummary: message, status: "failed", durationMs: null });
    finishRun(runId, "failed", message);
    throw new Error(`Agent 无法回复：${message}`);
  } finally {
    await provider.close();
  }
}

function createChatTools(context: { projectId: string; issueId: string }, runId: string) {
  const searchSources = loggedTool(runId, {
    name: "search_sources",
    description: "检索当前项目的文本资料，找到相关原文。",
    parameters: z.object({ query: z.string().max(200) }),
    execute: ({ query }: { query: string }) => searchSourceChunks(context.projectId, query),
  });
  const inspectPrototype = loggedTool(runId, {
    name: "inspect_prototype",
    description: "读取当前问题关联的原型版本 DOM 和控件。",
    parameters: z.object({}),
    execute: () => {
      const issue = getIssue(context.issueId);
      if (!issue.versionId) throw new Error("该问题没有关联原型版本");
      const snapshot = inspectPrototypeData(issue.versionId);
      if (snapshot.projectId !== context.projectId) throw new Error("原型不属于当前项目");
      return { id: snapshot.id, label: snapshot.label, visibleText: snapshot.visibleText.slice(0, 20_000), controls: snapshot.controls.slice(0, 80) };
    },
  });
  const getIssueContext = loggedTool(runId, {
    name: "get_issue_context",
    description: "读取当前问题的完整上下文、证据和决定记录。",
    parameters: z.object({}),
    execute: () => getIssue(context.issueId),
  });
  return [searchSources, inspectPrototype, getIssueContext];
}

const chatInstructions = `你是 ProtoAlign 的 Prototype Review Agent。产品经理正在询问一个具体问题，你需要结合资料、原型和问题上下文来回答。
- 优先调用 search_sources 查找相关资料原文，再调用 get_issue_context 了解已有证据和决定。
- 如果需要确认原型上的具体内容，调用 inspect_prototype。
- 回答要简短、具体、有依据，不要编造信息。引用资料原文时注明来源。
- 如果证据不足以回答，诚实说明并建议产品经理补充什么信息。
- 不要保存 Issue 或做出最终决定。`;

function loggedTool<TSchema extends z.ZodObject<z.ZodRawShape>, TResult>(runId: string, definition: { name: string; description: string; parameters: TSchema; execute: (args: z.infer<TSchema>) => TResult | Promise<TResult> }) {
  return tool({
    name: definition.name, description: definition.description, parameters: definition.parameters as never, strict: true, timeoutMs: 15_000, timeoutBehavior: "raise_exception",
    async execute(args) {
      const sequence = nextAgentEventSequence(runId);
      const startedAt = Date.now();
      const eventId = addAgentEvent(runId, { sequence, toolName: definition.name, eventType: "tool_call", paramsSummary: summarize(JSON.stringify(args), 200), resultSummary: "", status: "running", durationMs: null });
      try {
        const result = await definition.execute(args as z.infer<TSchema>);
        updateAgentEvent(eventId, { resultSummary: summarize(JSON.stringify(result), 360), status: "completed", durationMs: Date.now() - startedAt });
        return result;
      } catch (cause) {
        const message = safeModelError(cause);
        updateAgentEvent(eventId, { resultSummary: message, status: "failed", durationMs: Date.now() - startedAt });
        throw cause;
      }
    },
  });
}

function summarize(value: string, limit: number) { return value.length > limit ? `${value.slice(0, limit)}…` : value; }
function safeModelError(cause: unknown) { const raw = cause instanceof Error ? cause.message : "未知错误"; return raw.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[已隐藏]").replaceAll(process.cwd(), "[项目目录]").slice(0, 600); }
