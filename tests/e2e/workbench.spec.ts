import path from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

let qualityFixtureServer: Server;
let qualityFixtureBaseUrl = "";

test.beforeAll(async () => {
  qualityFixtureServer = createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (request.url === "/login") {
      response.end("<!doctype html><title>Sign in</title><main><h1>Sign in</h1><label>Email<input type='email'></label><label>Password<input type='password'></label><button>Sign in</button><a href='/forgot'>Forgot password</a></main>");
      return;
    }
    if (request.url === "/shell") {
      response.end("<!doctype html><title>Docs AI</title><main><div>Loading…</div></main>");
      return;
    }
    response.end("<!doctype html><title>AI Support Workbench</title><main><h1>AI Support Workbench</h1><nav>Inbox Knowledge Settings</nav><p>Select a conversation and generate a candidate reply. An agent must confirm before sending.</p><button>Generate candidate</button><textarea aria-label='Candidate reply'></textarea></main>");
  });
  await new Promise<void>((resolve) => qualityFixtureServer.listen(0, "127.0.0.1", resolve));
  const address = qualityFixtureServer.address() as AddressInfo;
  qualityFixtureBaseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => qualityFixtureServer.close((error) => error ? reject(error) : resolve()));
});

test("blank project imports real text and HTML DOM, then reports missing model key honestly", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ 新建项目" }).click();
  await page.getByLabel("项目名称").fill("退款解释助手 E2E");
  await page.getByLabel("产品目标").fill("帮助客服基于退款政策生成可编辑的候选解释，由客服确认后发送。");
  await page.getByLabel("本次评审范围").fill("候选回复生成、人工确认与发送流程");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();

  await expect(page.getByText("尚无问题")).toBeVisible();
  await page.getByRole("button", { name: /导入资料/ }).click();
  await page.getByRole("button", { name: /录入角色反馈/ }).click();
  await page.getByLabel("来源角色").fill("研发负责人");
  await page.getByLabel("标题").fill("发送前人工确认约束");
  await page.getByLabel("原始位置").fill("研发评审 12:10");
  await page.getByLabel("原文").fill("AI 只能生成候选回复，正式发送前必须由客服人工确认，不能直接自动发送。");
  await page.getByRole("button", { name: "保存并处理" }).click();

  await page.getByRole("button", { name: /导入原型版本/ }).click();
  await page.getByLabel("导入方式").selectOption("html");
  await page.getByLabel("HTML 或 ZIP 文件").setInputFiles(path.join(process.cwd(), "tests/fixtures/v1.html"));
  await page.getByRole("button", { name: "保存并处理" }).click();

  await expect(page.getByText("DOM 已采集").first()).toBeVisible();
  await page.getByRole("button", { name: /导入原型版本/ }).click();
  await page.getByLabel("导入方式").selectOption("zip");
  const zip = zipSync({
    "dist/index.html": strToU8("<!doctype html><html><head><title>退款解释助手 V2 ZIP</title><link rel='stylesheet' href='./assets/app.css'></head><body><h1>退款解释助手</h1><button>生成候选回复</button><textarea aria-label='候选回复'></textarea><div id='actions'></div><script src='./assets/app.js'></script></body></html>"),
    "dist/assets/app.css": strToU8("body { font-family: sans-serif; }"),
    "dist/assets/app.js": strToU8("document.querySelector('#actions').textContent = '确认并发送（脚本渲染）';"),
  });
  await page.getByLabel("HTML 或 ZIP 文件").setInputFiles({ name: "prototype-v2.zip", mimeType: "application/zip", buffer: Buffer.from(zip) });
  await page.getByRole("button", { name: "保存并处理" }).click();
  await expect(page.getByText("退款解释助手 V2 ZIP")).toBeVisible();
  const projectsResponse = await page.request.get("/api/projects");
  const projects = await projectsResponse.json() as { projects: Array<{ id: string }> };
  const workspaceResponse = await page.request.get(`/api/projects/${projects.projects[0].id}`);
  const workspace = await workspaceResponse.json() as { versions: Array<{ visibleText: string }> };
  expect(workspace.versions.at(-1)?.visibleText).toContain("确认并发送（脚本渲染）");
  await page.getByRole("dialog", { name: "资料与输入" }).getByRole("button", { name: "×" }).click();
  await expect(page.getByRole("button", { name: "启动评审" })).toBeEnabled();
  await page.getByRole("button", { name: "启动评审" }).click();

  await expect(page.getByText(/服务端未配置 DEEPSEEK_API_KEY/).first()).toBeVisible();
  await expect(page.getByText("尚无问题")).toBeVisible();
  await expect(page.getByText(/模型连接|model_connection/).first()).toBeVisible();

  await page.locator(".activity-drawer").getByRole("button", { name: "×" }).click();
  await page.setViewportSize({ width: 700, height: 820 });
  await page.getByRole("button", { name: "问题", exact: true }).click();
  await expect(page.locator(".left-pane")).toBeVisible();
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await expect(page.locator(".right-pane")).toBeVisible();
});

test("ingestion and model failures remain visible, then a valid recovery persists after refresh", async ({ page }) => {
  const projectName = "失败路径与恢复 E2E";
  const projectResponse = await page.request.post("/api/projects", {
    data: { name: projectName, goal: "验证导入与模型失败必须如实记录。", scope: "资料、原型与 Agent 失败路径" },
  });
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json() as { project: { id: string } };

  const emptySource = await page.request.post(`/api/projects/${project.project.id}/sources`, {
    multipart: { kind: "需求文档", role: "测试", title: "空资料", content: "" },
  });
  expect(emptySource.status()).toBe(400);
  await expect(emptySource.json()).resolves.toMatchObject({ error: expect.stringContaining("非空") });

  const unsafeZip = zipSync({ "../escape.txt": strToU8("escape"), "index.html": strToU8("<h1>Bad ZIP</h1>") });
  const unsafePrototype = await page.request.post(`/api/projects/${project.project.id}/prototypes`, {
    multipart: {
      label: "BADZIP", sourceType: "zip", notes: "路径穿越测试",
      file: { name: "unsafe.zip", mimeType: "application/zip", buffer: Buffer.from(unsafeZip) },
    },
  });
  expect(unsafePrototype.status()).toBe(400);
  await expect(unsafePrototype.json()).resolves.toMatchObject({ error: expect.stringContaining("不安全") });

  const inaccessiblePrototype = await page.request.post(`/api/projects/${project.project.id}/prototypes`, {
    multipart: { label: "BADURL", sourceType: "url", url: "http://127.0.0.1:9/unavailable", notes: "不可访问 URL 测试" },
  });
  expect(inaccessiblePrototype.status()).toBe(400);
  await expect(inaccessiblePrototype.json()).resolves.toMatchObject({ error: expect.stringContaining("DOM 采集失败") });

  const validSource = await page.request.post(`/api/projects/${project.project.id}/sources`, {
    multipart: { kind: "需求文档", role: "研发负责人", title: "恢复后的真实资料", originalLocation: "E2E", content: "AI 只能生成候选回复，正式发送前必须由客服人工确认。" },
  });
  expect(validSource.status()).toBe(201);
  const validPrototype = await page.request.post(`/api/projects/${project.project.id}/prototypes`, {
    multipart: {
      label: "V1", sourceType: "html", notes: "失败后恢复导入",
      file: { name: "recovery.html", mimeType: "text/html", buffer: await import("node:fs/promises").then((fs) => fs.readFile(path.join(process.cwd(), "tests/fixtures/v1.html"))) },
    },
  });
  expect(validPrototype.status()).toBe(201);
  const imported = await validPrototype.json() as { prototype: { id: string; captureStatus: string } };
  expect(imported.prototype.captureStatus).toBe("captured");

  const missingKeyRun = await page.request.post(`/api/projects/${project.project.id}/agent-runs`, {
    data: { mode: "review", versionId: imported.prototype.id },
  });
  expect(missingKeyRun.status()).toBe(502);
  await expect(missingKeyRun.json()).resolves.toMatchObject({ error: expect.stringContaining("未配置 DEEPSEEK_API_KEY") });

  const workspaceResponse = await page.request.get(`/api/projects/${project.project.id}`);
  const workspace = await workspaceResponse.json() as { issues: unknown[]; versions: Array<{ label: string; captureStatus: string }>; runs: Array<{ status: string; events: Array<{ toolName: string; status: string }> }> };
  expect(workspace.issues).toHaveLength(0);
  expect(workspace.versions).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "BADURL", captureStatus: "failed" }),
    expect.objectContaining({ label: "V1", captureStatus: "captured" }),
  ]));
  expect(workspace.runs.at(0)).toMatchObject({ status: "failed" });
  expect(workspace.runs.at(0)?.events).toEqual(expect.arrayContaining([expect.objectContaining({ toolName: "model_connection", status: "failed" })]));

  await page.goto("/");
  await page.locator(".brand").click();
  await page.locator(".project-menu").getByRole("button", { name: new RegExp(projectName) }).click();
  await page.getByRole("button", { name: /导入资料/ }).click();
  await expect(page.getByText("恢复后的真实资料")).toBeVisible();
  await expect(page.getByText("DOM 已采集").first()).toBeVisible();
});

test("URL capture distinguishes reviewable, login and loading-shell pages before Agent review", async ({ page }) => {
  const projectName = "URL 采集质量 E2E";
  const projectResponse = await page.request.post("/api/projects", {
    data: { name: projectName, goal: "验证 URL 导入质量诊断。", scope: "公开页面、登录门槛与加载空壳" },
  });
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json() as { project: { id: string } };
  const sourceResponse = await page.request.post(`/api/projects/${project.project.id}/sources`, {
    multipart: { kind: "需求文档", role: "产品经理", title: "评审范围", content: "客服必须确认候选回复后才能发送。" },
  });
  expect(sourceResponse.status()).toBe(201);

  async function importUrl(label: string, pathname: string) {
    const response = await page.request.post(`/api/projects/${project.project.id}/prototypes`, {
      multipart: { label, sourceType: "url", url: `${qualityFixtureBaseUrl}${pathname}`, notes: "确定性本地页面" },
    });
    expect(response.status()).toBe(201);
    return response.json() as Promise<{ prototype: { id: string; reviewability: string; reviewabilityReason: string } }>;
  }

  const reviewable = await importUrl("READY", "/reviewable");
  const login = await importUrl("LOGIN", "/login");
  const shell = await importUrl("SHELL", "/shell");
  expect(reviewable.prototype.reviewability).toBe("reviewable");
  expect(login.prototype).toMatchObject({ reviewability: "login_required", reviewabilityReason: expect.stringContaining("登录") });
  expect(shell.prototype).toMatchObject({ reviewability: "loading_shell", reviewabilityReason: expect.stringContaining("加载") });

  const blockedRun = await page.request.post(`/api/projects/${project.project.id}/agent-runs`, {
    data: { mode: "review", versionId: login.prototype.id },
  });
  expect(blockedRun.status()).toBe(502);
  await expect(blockedRun.json()).resolves.toMatchObject({ error: expect.stringContaining("不可评审") });
  const workspaceResponse = await page.request.get(`/api/projects/${project.project.id}`);
  const workspace = await workspaceResponse.json() as { issues: unknown[]; runs: unknown[] };
  expect(workspace.issues).toHaveLength(0);
  expect(workspace.runs).toHaveLength(0);

  await page.goto("/");
  await page.locator(".brand").click();
  await page.locator(".project-menu").getByRole("button", { name: new RegExp(projectName) }).click();
  await page.getByRole("button", { name: "版本记录" }).click();
  await expect(page.getByText("疑似登录页")).toBeVisible();
  await expect(page.getByText("加载未完成 / 空壳")).toBeVisible();
  await expect(page.getByRole("button", { name: "原型不可评审" })).toBeDisabled();
  await page.getByRole("button", { name: "运行比较" }).click();
  await expect(page.getByText("样本不足", { exact: true })).toBeVisible();
  await expect(page.getByText(/至少需要两次已完成且生成 Issue 的初评/)).toBeVisible();
});
