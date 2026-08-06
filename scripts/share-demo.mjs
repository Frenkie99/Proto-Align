import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const localPort = 3010;
const localUrl = `http://127.0.0.1:${localPort}`;
const fileEnv = {
  ...readEnvFile(path.join(root, ".env.local")),
  ...readEnvFile(path.join(root, ".env.demo.local")),
};
const runtimeEnv = { ...fileEnv, ...process.env, PROTOALIGN_PUBLIC_MODE: "1", PORT: String(localPort) };
const password = runtimeEnv.PROTOALIGN_ACCESS_PASSWORD?.trim();
const dailyLimit = Number(runtimeEnv.PROTOALIGN_DAILY_AGENT_LIMIT);
const featuredProjectIds = [...new Set((runtimeEnv.PROTOALIGN_FEATURED_PROJECT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean))];

if (!password || password === "replace_with_a_long_demo_password" || password.length < 12) {
  fail("请先在 .env.demo.local 设置至少 12 位的 PROTOALIGN_ACCESS_PASSWORD，再启动公网演示。");
}
if (!Number.isSafeInteger(dailyLimit) || dailyLimit <= 0) {
  fail("请先在 .env.demo.local 设置正整数 PROTOALIGN_DAILY_AGENT_LIMIT，例如 12。");
}
if (featuredProjectIds.length !== 3) {
  fail("请在 .env.demo.local 设置恰好 3 个逗号分隔的 PROTOALIGN_FEATURED_PROJECT_IDS，并把 Customer Service 完整闭环案例放在第一位。");
}
assertFeaturedProjectsExist(featuredProjectIds);
if (spawnSync("cloudflared", ["--version"], { stdio: "ignore" }).status !== 0) {
  fail("未找到 cloudflared。macOS 可先运行：brew install cloudflared");
}

console.log("正在生成最新生产构建…");
await runOnce("npm", ["run", "build"]);

const app = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(localPort)], {
  cwd: root,
  env: runtimeEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
pipeWithPrefix(app.stdout, "应用");
pipeWithPrefix(app.stderr, "应用");

try {
  await waitForApp();
} catch (error) {
  app.kill("SIGTERM");
  fail(error instanceof Error ? error.message : "ProtoAlign 启动失败");
}

console.log(`本地受保护服务已启动：${localUrl}`);
console.log(`Agent 每日额度：${dailyLimit} 次（Asia/Shanghai 自然日）`);
console.log("公开项目：3 个精选真实案例；本次会话新建的空白项目也会显示");
console.log("正在创建免费的 Cloudflare 临时公网链接…");

const tunnel = spawn("cloudflared", ["tunnel", "--url", localUrl, "--no-autoupdate"], {
  cwd: root,
  env: runtimeEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
let announced = false;
const handleTunnelOutput = (chunk) => {
  const text = chunk.toString();
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && !announced) {
    announced = true;
    console.log(`\n公网演示链接：${match[0]}`);
    console.log("访问用户名：protoalign");
    console.log("访问密码：使用 .env.demo.local 中的 PROTOALIGN_ACCESS_PASSWORD");
    console.log("保持本窗口、电脑和网络在线；按 Control-C 关闭公网入口。\n");
  }
};
tunnel.stdout.on("data", handleTunnelOutput);
tunnel.stderr.on("data", handleTunnelOutput);

const shutdown = () => {
  tunnel.kill("SIGTERM");
  app.kill("SIGTERM");
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

const exitCode = await new Promise((resolve) => tunnel.once("exit", (code) => resolve(code ?? 1)));
shutdown();
if (!announced) fail("Cloudflare Tunnel 未能生成公网链接，请检查网络后重试。");
process.exitCode = Number(exitCode);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: runtimeEnv, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} 执行失败（${code ?? "unknown"}）`)));
  });
}

async function waitForApp() {
  const authorization = `Basic ${Buffer.from(`protoalign:${password}`).toString("base64")}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) throw new Error(`ProtoAlign 启动进程提前退出（${app.exitCode}）`);
    try {
      const response = await fetch(localUrl, { headers: { authorization } });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("等待 ProtoAlign 启动超时");
}

function pipeWithPrefix(stream, prefix) {
  stream.on("data", (chunk) => process.stdout.write(`[${prefix}] ${chunk}`));
}

function assertFeaturedProjectsExist(projectIds) {
  const dataRoot = runtimeEnv.PROTOALIGN_DATA_DIR ? path.resolve(runtimeEnv.PROTOALIGN_DATA_DIR) : path.join(root, "data");
  const databasePath = path.join(dataRoot, "protoalign.db");
  if (!fs.existsSync(databasePath)) fail(`未找到演示数据库：${databasePath}`);
  const placeholders = projectIds.map(() => "?").join(",");
  const check = spawnSync("node", ["--input-type=module", "-e", `
    import Database from "better-sqlite3";
    const db = new Database(process.argv[1], { readonly: true });
    const ids = JSON.parse(process.argv[2]);
    const found = db.prepare("SELECT id FROM projects WHERE id IN (${placeholders})").all(...ids);
    if (found.length !== ids.length) process.exit(2);
  `, databasePath, JSON.stringify(projectIds)], { cwd: root, env: runtimeEnv, stdio: "ignore" });
  if (check.status !== 0) fail("PROTOALIGN_FEATURED_PROJECT_IDS 包含当前演示数据库中不存在的项目。");
}

function fail(message) {
  console.error(`ProtoAlign 公网演示启动失败：${message}`);
  process.exit(1);
}
