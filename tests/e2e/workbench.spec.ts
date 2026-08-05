import path from "node:path";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

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
