import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.PROTOALIGN_BASE_URL || "http://127.0.0.1:3000";
const requestedCase = process.argv.find((argument) => argument.startsWith("--case="))?.slice("--case=".length);
const requestedAttempt = Number(process.argv.find((argument) => argument.startsWith("--attempt="))?.slice("--attempt=".length) || 1);

const cases = [
  {
    key: "customer-service",
    name: "OpenAI Customer Service Agents Demo",
    goal: "帮助航空客服把请求路由到专业 Agent，并在高风险操作前向客服呈现需要确认的信息。",
    scope: "取消航班前确认确认号与航班号，以及 Agent 编排、护栏和客服界面的可理解性。",
    prototypeUrl: "http://127.0.0.1:3101",
    sourceUrl: "https://raw.githubusercontent.com/openai/openai-cs-agents-demo/main/README.md",
    sourceTitle: "OpenAI Customer Service Agents Demo README",
  },
  {
    key: "openagent",
    name: "OpenAgent",
    goal: "帮助个人用户在知识库、浏览器、代码和 MCP 工具之间安全地委托 AI Agent 完成工作。",
    scope: "知识库和工具权限、Agent 行动边界及详细运行记录在桌面工作台中的可见性。",
    prototypeUrl: "https://demo.openagentai.org",
    sourceUrl: "https://raw.githubusercontent.com/the-open-agent/openagent/master/README.md",
    sourceTitle: "OpenAgent README",
  },
  {
    key: "huggingchat",
    name: "HuggingChat / Chat UI",
    goal: "让用户在网页中与可选择的大语言模型对话，并清楚理解模型、工具和数据处理边界。",
    scope: "模型选择、聊天创建、工具/MCP 使用及数据共享控制在未登录桌面体验中的可见性。",
    prototypeUrl: "https://huggingface.co/chat/",
    sourceUrl: "https://raw.githubusercontent.com/huggingface/chat-ui/main/README.md",
    sourceTitle: "Hugging Face Chat UI README",
  },
];

const selectedCases = requestedCase ? cases.filter((candidate) => candidate.key === requestedCase) : cases;
if (!selectedCases.length) throw new Error(`未知案例：${requestedCase}`);

const allResults = [];
for (const candidate of selectedCases) {
  for (let attempt = requestedCase ? requestedAttempt : 1; attempt <= (requestedCase ? requestedAttempt : 2); attempt += 1) {
    const result = await runCase(candidate, attempt);
    allResults.push(result);
    console.log(JSON.stringify(result));
  }
}

await mkdir(path.join(process.cwd(), ".artifacts", "overnight"), { recursive: true });
await writeFile(
  path.join(process.cwd(), ".artifacts", "overnight", `real-case-runs-${new Date().toISOString().replaceAll(":", "-")}.json`),
  `${JSON.stringify(allResults, null, 2)}\n`,
);

async function runCase(candidate, attempt) {
  const startedAt = new Date().toISOString();
  const sourceText = await fetchText(candidate.sourceUrl);
  const project = await request("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `真实案例｜${candidate.name}｜第 ${attempt} 次`,
      goal: candidate.goal,
      scope: candidate.scope,
    }),
  });
  const projectId = project.project.id;

  const sourceData = new FormData();
  sourceData.set("kind", "需求文档");
  sourceData.set("role", "开源项目维护者");
  sourceData.set("title", candidate.sourceTitle);
  sourceData.set("originalLocation", candidate.sourceUrl);
  sourceData.set("content", sourceText);
  await request(`/api/projects/${projectId}/sources`, { method: "POST", body: sourceData });

  const prototypeData = new FormData();
  prototypeData.set("label", "V1");
  prototypeData.set("sourceType", "url");
  prototypeData.set("url", candidate.prototypeUrl);
  prototypeData.set("notes", `公开真实产品 V1；第 ${attempt} 次独立评审。`);
  const prototype = await request(`/api/projects/${projectId}/prototypes`, { method: "POST", body: prototypeData });

  const runStartedAt = Date.now();
  const run = await request(`/api/projects/${projectId}/agent-runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "review", versionId: prototype.prototype.id }),
  });
  const workspace = await request(`/api/projects/${projectId}`);
  const agentRun = workspace.runs.find((item) => item.id === run.runId);
  if (!agentRun) throw new Error(`运行 ${run.runId} 未保存到项目`);
  const completedTools = agentRun.events.filter((event) => event.status === "completed").map((event) => event.toolName);
  for (const requiredTool of ["search_sources", "inspect_prototype"]) {
    if (!completedTools.includes(requiredTool)) throw new Error(`运行 ${run.runId} 未真实调用必需工具：${requiredTool}`);
  }
  if (agentRun.status !== "completed") throw new Error(`运行 ${run.runId} 未完成：${agentRun.errorMessage || "无错误摘要"}`);
  if (!workspace.issues.length) throw new Error(`运行 ${run.runId} 未生成 Issue 或澄清问题`);

  return {
    case: candidate.key,
    attempt,
    startedAt,
    projectId,
    versionId: prototype.prototype.id,
    runId: run.runId,
    model: agentRun.model,
    elapsedMs: Date.now() - runStartedAt,
    capture: { title: prototype.prototype.title, pageUrl: prototype.prototype.pageUrl, controls: prototype.prototype.controls.length },
    toolEvents: agentRun.events.map((event) => ({ sequence: event.sequence, tool: event.toolName, status: event.status, durationMs: event.durationMs, result: event.resultSummary })),
    issues: workspace.issues.map((issue) => ({ id: issue.id, title: issue.title, severity: issue.severity, status: issue.status, selector: issue.selector, region: issue.region, evidence: issue.evidence })),
  };
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`无法取得公开资料（${response.status}）：${url}`);
  const text = await response.text();
  if (text.trim().length < 300) throw new Error(`公开资料内容不足：${url}`);
  return text.slice(0, 1_800_000);
}

async function request(endpoint, init) {
  const response = await fetch(`${baseUrl}${endpoint}`, { ...init, signal: AbortSignal.timeout(125_000) });
  const body = await response.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`ProtoAlign API 返回非 JSON（${response.status}）：${body.slice(0, 300)}`);
  }
  if (!response.ok) throw new Error(payload.error || `ProtoAlign API 请求失败（${response.status}）`);
  return payload;
}
