import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const appUrl = process.env.PROTOALIGN_BASE_URL || "http://127.0.0.1:3000";
const artifactsDir = path.join(process.cwd(), ".artifacts", "overnight");
const v2Path = path.join(artifactsDir, "customer-service-v2.html");
const readmeUrl = "https://raw.githubusercontent.com/openai/openai-cs-agents-demo/main/README.md";
const v2Markup = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Airlines Agent Orchestration — cancellation confirmation V2</title>
<style>body{margin:0;background:#f3f4f6;color:#18181b;font:14px system-ui}main{display:grid;grid-template-columns:3fr 2fr;gap:8px;min-height:100vh;padding:8px}section{background:#fff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden}header{padding:13px 16px;background:#2563eb;color:#fff;font-weight:700}.content,.chat{padding:20px;display:grid;gap:16px}.card,.bubble{border:1px solid #d4d4d8;border-radius:10px;padding:14px;background:#fff}.detail{display:grid;grid-template-columns:1fr 1fr;gap:8px}.detail div{padding:10px;background:#f4f4f5}.tag{display:inline-block;padding:3px 8px;border-radius:99px;background:#dcfce7;color:#166534;font-size:12px}button{border:0;border-radius:7px;padding:10px 12px;background:#2563eb;color:#fff;font-weight:650}</style>
</head><body><main><section><header>Agent View</header><div class="content">
<div class="card" id="conversation-context"><h2>Conversation Context <span class="tag">Confirmation required</span></h2><p>Cancellation request detected. Review itinerary details before sending a cancellation command.</p><div class="detail"><div>Confirmation number<br><strong>LL0EZ6</strong></div><div>Flight<br><strong>FLT-123</strong></div></div><button aria-label="Ask customer to confirm cancellation details">Ask customer to confirm details</button></div>
<div class="card" id="guardrails"><h2>Guardrails</h2><p><span class="tag">Relevance guardrail: passed</span> <span class="tag">Jailbreak guardrail: passed</span></p><p>Guardrail outcomes are recorded before an action is available.</p></div>
<div class="card" id="runner-output"><h2>Runner Output</h2><p>Booking &amp; Cancellation Agent is waiting for customer confirmation. No cancellation action has been sent.</p></div>
</div></section><section><header>Customer View</header><div class="chat"><div class="bubble">I can help cancel flight <strong>FLT-123</strong>. Your confirmation number is <strong>LL0EZ6</strong>. Please confirm these details are correct before I proceed.</div></div></section></main></body></html>`;

await mkdir(artifactsDir, { recursive: true });
await writeFile(v2Path, v2Markup);
const sourceText = await fetchText(readmeUrl);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: artifactsDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
let videoPath = null;

try {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.locator(".brand").click();
  await page.getByRole("button", { name: "＋ 新建空白项目" }).click();
  await page.getByLabel("项目名称").fill("录制案例｜Customer Service Agents Demo｜第 2 次");
  await page.getByLabel("产品目标").fill("帮助航空客服将请求路由到专业 Agent，并在取消前清楚呈现并请求确认确认号与航班号。");
  await page.getByLabel("本次评审范围").fill("取消前确认、护栏状态、Agent 编排记录及客服界面中的人工确认边界。");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();

  await page.getByRole("button", { name: /导入资料/ }).click();
  await page.getByRole("button", { name: "添加文本资料" }).click();
  await page.getByLabel("来源角色").fill("OpenAI 开源项目维护者");
  await page.getByLabel("标题").fill("Customer Service Agents Demo README");
  await page.getByLabel("原始位置").fill(readmeUrl);
  await page.getByLabel("原文").fill(sourceText);
  await page.getByRole("button", { name: "保存并处理" }).click();
  await page.getByText("资料已保存，等待 Agent 提取待确认主张").waitFor();

  await page.getByRole("button", { name: "导入原型版本" }).click();
  await page.getByLabel("版本标识").fill("V1");
  await page.getByLabel("导入方式").selectOption("url");
  await page.getByLabel("原型 URL").fill("http://127.0.0.1:3101");
  await page.getByRole("button", { name: "保存并处理" }).click();
  await page.getByText("原型已完成真实 DOM 采集").waitFor({ timeout: 40_000 });
  await page.getByRole("dialog", { name: "资料与输入" }).getByRole("button", { name: "×" }).click();

  await page.getByRole("button", { name: "启动评审" }).click();
  await page.getByText("评审已完成，Issue 仍为待确认草稿").waitFor({ timeout: 130_000 });
  await page.locator(".activity-drawer").getByRole("button", { name: "×" }).click();
  await page.locator(".issue-card").first().waitFor({ state: "visible" });
  await page.locator(".issue-card").first().click();
  await page.screenshot({ path: path.join(artifactsDir, "recording-01-review-issue.png"), fullPage: true });

  await page.getByRole("button", { name: "开始处理" }).click();
  await page.getByLabel("操作依据").fill("产品经理确认该问题需要在 V2 中通过可见的确认号、航班号与等待确认状态处理。");
  await page.getByRole("button", { name: "确认操作" }).click();
  await page.getByText("问题状态已更新为“处理中”").waitFor();

  await page.getByRole("button", { name: /导入资料/ }).click();
  await page.getByRole("button", { name: "导入原型版本" }).click();
  await page.getByLabel("版本标识").fill("V2");
  await page.getByLabel("导入方式").selectOption("html");
  await page.getByLabel("HTML 或 ZIP 文件").setInputFiles(v2Path);
  await page.getByLabel("版本说明").fill("基于公开 Customer Service Agents Demo 的桌面 UI 补入取消确认详情、护栏状态和等待确认的运行记录。");
  await page.getByRole("button", { name: "保存并处理" }).click();
  await page.getByText("原型已完成真实 DOM 采集").waitFor({ timeout: 40_000 });
  await page.getByRole("dialog", { name: "资料与输入" }).getByRole("button", { name: "×" }).click();
  await page.getByLabel("原型版本").selectOption({ label: "V2" });

  await page.getByRole("button", { name: "启动复检" }).click();
  await page.getByText("复检已完成，等待你确认结论").waitFor({ timeout: 130_000 });
  await page.locator(".activity-drawer").getByRole("button", { name: "×" }).click();
  await page.screenshot({ path: path.join(artifactsDir, "recording-02-verification.png"), fullPage: true });

  const closeButton = page.getByRole("button", { name: "关闭问题" });
  const finalAction = await closeButton.isEnabled() ? "已解决" : "已接受风险";
  await page.getByRole("button", { name: finalAction === "已解决" ? "关闭问题" : "接受风险" }).click();
  await page.getByLabel("操作依据").fill(
    finalAction === "已解决"
      ? "产品经理核对 V2 的确认号、航班号和等待确认状态，确认满足本次复检条件后关闭。"
      : "产品经理确认复检未能充分证明该公开演示环境中的运行时行为，保留风险并记录后续需接入真实后端复验。",
  );
  await page.getByRole("button", { name: "确认操作" }).click();
  await page.getByText(`问题状态已更新为“${finalAction}”`).waitFor();
  await page.getByRole("button", { name: /活动追踪|活动记录/ }).first().click();
  await page.screenshot({ path: path.join(artifactsDir, "recording-03-final-audit.png"), fullPage: true });

  const projectsResponse = await page.request.get(`${appUrl}/api/projects`);
  const projects = await projectsResponse.json();
  const recordingProject = projects.projects.find((project) => project.name.startsWith("录制案例｜Customer Service Agents Demo"));
  if (!recordingProject) throw new Error("无法定位录制项目");
  const workspaceResponse = await page.request.get(`${appUrl}/api/projects/${recordingProject.id}`);
  const workspace = await workspaceResponse.json();
  await writeFile(path.join(artifactsDir, "recording-summary.json"), `${JSON.stringify({
    projectId: recordingProject.id,
    versions: workspace.versions.map((version) => ({ id: version.id, label: version.label, captureStatus: version.captureStatus })),
    runs: workspace.runs.map((run) => ({ id: run.id, mode: run.mode, status: run.status, model: run.model, events: run.events.map((event) => event.toolName) })),
    issues: workspace.issues.map((issue) => ({ id: issue.id, title: issue.title, status: issue.status, verification: issue.verifications[0]?.result || null })),
    finalAction,
  }, null, 2)}\n`);
} catch (error) {
  await page.screenshot({ path: path.join(artifactsDir, "recording-failure.png"), fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  const video = page.video();
  await context.close();
  videoPath = await video?.path().catch(() => null);
  await browser.close();
}

console.log(JSON.stringify({ videoPath }));

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`无法取得公开资料（${response.status}）：${url}`);
  return (await response.text()).slice(0, 1_800_000);
}
