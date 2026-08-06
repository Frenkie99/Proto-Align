import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "overnight");
fs.mkdirSync(artifactsDir, { recursive: true });

const PASSWORD = (() => {
  const envFile = path.join(root, ".env.demo.local");
  if (!fs.existsSync(envFile)) throw new Error("缺少 .env.demo.local");
  const match = fs.readFileSync(envFile, "utf8").match(/PROTOALIGN_ACCESS_PASSWORD\s*=\s*(.+)/);
  if (!match) throw new Error("未找到 PROTOALIGN_ACCESS_PASSWORD");
  return match[1].trim().replace(/^["']|["']$/g, "");
})();

const TARGET_SECONDS = 30;
const BASE = "http://127.0.0.1:3010";
const AUTH = `Basic ${Buffer.from(`protoalign:${PASSWORD}`).toString("base64")}`;

console.log("启动 Chromium…");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  serviceWorkers: "block",
  recordVideo: { dir: artifactsDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

/* ── Custom cursor ── */
await page.addStyleTag({ content: `
  * { cursor: none !important; }
  body { cursor: none !important; }
  #__c { position:fixed;z-index:10000;pointer-events:none;width:36px;height:36px;
    border:3px solid #ec4899;border-radius:50%;transform:translate(-50%,-50%);
    box-shadow:0 0 0 6px rgba(236,72,153,0.22); }
  #__c.down { width:20px;height:20px;border-color:#e11d48;box-shadow:0 0 0 12px rgba(225,29,72,0.35); }
  #__r { position:fixed;z-index:9999;pointer-events:none;width:20px;height:20px;
    border-radius:50%;background:rgba(236,72,153,0.4);transform:translate(-50%,-50%) scale(0);opacity:1; }
  #__r.on { animation:__rpl 0.5s ease-out forwards; }
  @keyframes __rpl { 0% { transform:translate(-50%,-50%) scale(0);opacity:1; }
    100% { transform:translate(-50%,-50%) scale(6);opacity:0; } }
` });

await page.evaluate(() => {
  const c = Object.assign(document.createElement("div"), { id: "__c" });
  const r = Object.assign(document.createElement("div"), { id: "__r" });
  document.body.append(c, r);
  document.addEventListener("mousemove", e => {
    c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; c.classList.remove("down");
  });
  document.addEventListener("mousedown", () => {
    c.classList.add("down");
    r.style.left = c.style.left; r.style.top = c.style.top;
    r.classList.remove("on"); void r.offsetWidth; r.classList.add("on");
  });
  document.addEventListener("mouseup", () => c.classList.remove("down"));
});

/* ── Helpers ── */
async function safeClick(sel) {
  try {
    const loc = page.locator(sel).first();
    await loc.waitFor({ state: "visible", timeout: 3000 });
    const box = await loc.boundingBox();
    if (!box) return false;
    await page.mouse.move(box.x + box.width / 2 - 25, box.y + box.height / 2 - 15, { steps: 5 });
    await pause(100);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
    await pause(80);
    await page.mouse.down();
    await pause(120);
    await page.mouse.up();
    await pause(180);
    return true;
  } catch { return false; }
}

async function safeMove(sel) {
  try {
    const loc = page.locator(sel).first();
    await loc.waitFor({ state: "visible", timeout: 2000 });
    const box = await loc.boundingBox();
    if (!box) return false;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    return true;
  } catch { return false; }
}

async function pause(ms) { await page.waitForTimeout(ms); }
const XXL = 2200, LONG = 1300, MED = 750, SHORT = 350;

/* ═══════════ SCENE 1: Auth & project selection (~25s) ═══════════ */
console.log("Scene 1…");
await page.setExtraHTTPHeaders({ authorization: AUTH });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await pause(XXL);

// Dismiss guide
if (await page.locator(".modal button.primary-button").isVisible({ timeout: 2000 }).catch(() => false)) {
  await safeClick(".modal button.primary-button");
  await pause(LONG);
}

// Panoramic scan of the empty/new state
await page.mouse.move(100, 250, { steps: 20 });
await pause(MED);
await page.mouse.move(720, 450, { steps: 25 });
await pause(LONG);
await page.mouse.move(1340, 250, { steps: 20 });
await pause(LONG);

// Open project menu
await safeClick(".brand");
await pause(LONG);

// Hover projects
const menuItems = page.locator(".project-menu > button:not(.new-project-entry)");
const menuCount = await menuItems.count();
for (let i = 0; i < Math.min(menuCount, 3); i++) {
  await menuItems.nth(i).waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  const box = await menuItems.nth(i).boundingBox().catch(() => null);
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    await pause(LONG);
  }
}

// Select first featured project
await safeClick(".project-menu > button:not(.new-project-entry)");
await pause(XXL);

/* ═══════════ SCENE 2: Browse issues (~15s) ═══════════ */
console.log("Scene 2…");
// Hover over issue cards
const issues = page.locator(".issue-card");
const ic = await issues.count();
for (let i = 0; i < Math.min(ic, 3); i++) {
  const ibox = await issues.nth(i).boundingBox().catch(() => null);
  if (ibox) {
    await page.mouse.move(ibox.x + ibox.width / 2, ibox.y + ibox.height / 2, { steps: 10 });
    await pause(MED);
  }
}

// Click first issue
await safeClick(".issue-card");
await pause(XXL);

/* ═══════════ SCENE 3: Activity records — Agent proof (~25s) ═══════════ */
console.log("Scene 3…");
// Open activity drawer — KEY MOMENT
await safeClick(".activity-summary");
await pause(XXL);

// Read tool events slowly
if (await safeMove(".event-row")) {
  await pause(LONG);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 100);
    await pause(SHORT);
    await page.mouse.wheel(0, 100);
    await pause(MED);
  }
  await page.mouse.wheel(0, -400);
  await pause(LONG);
}

// Close drawer
await safeClick(".activity-drawer .icon-button");
await pause(LONG);

/* ═══════════ SCENE 4: Prototype canvas (~20s) ═══════════ */
console.log("Scene 4…");
// Select another issue
const i2 = page.locator(".issue-card");
const ic2 = await i2.count();
if (ic2 >= 2) {
  const b2 = await i2.nth(1).boundingBox().catch(() => null);
  if (b2) {
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 12 });
    await pause(MED);
    await page.mouse.down(); await pause(100); await page.mouse.up();
    await pause(XXL);
  }
}

// Show prototype highlight
if (await safeMove(".element-highlight")) await pause(XXL);
if (await safeMove(".location-callout")) await pause(LONG);

/* ═══════════ SCENE 5: Scroll & evidence (~15s) ═══════════ */
console.log("Scene 5…");
await page.mouse.wheel(0, 140); await pause(MED);
await page.mouse.wheel(0, 140); await pause(MED);
await safeMove(".evidence-column"); await pause(LONG);

/* ═══════════ SCENE 6: Agent panel & verification (~20s) ═══════════ */
console.log("Scene 6…");
if (await safeMove(".agent-scroll")) {
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 160);
    await pause(SHORT);
  }
  await pause(LONG);
}
await safeMove(".verification-box"); await pause(XXL);
await safeMove(".decision-list"); await pause(LONG);

// Version switcher
await safeMove(".version-select"); await pause(MED);
await safeClick(".version-select select"); await pause(MED);

/* ═══════════ SCENE 7: Final overview (~10s) ═══════════ */
console.log("Scene 7…");
await safeMove(".chat-bar input"); await pause(LONG);
await page.mouse.move(1440, 450, { steps: 30 });
await pause(MED);
await page.mouse.move(1440, 100, { steps: 20 });
await pause(MED);
await page.mouse.move(720, 450, { steps: 30 });
await pause(XXL);

/* ── Save & speed up ── */
console.log("保存视频…");
await context.close();
await browser.close();

const videoFiles = fs.readdirSync(artifactsDir).filter(f => f.endsWith(".webm") && !f.includes("demo") && !f.includes("speed"));
if (!videoFiles.length) throw new Error("未找到录制视频");
const rawVideo = path.join(artifactsDir, videoFiles[videoFiles.length - 1]);

// Delete old demo video(s)
for (const f of fs.readdirSync(artifactsDir)) {
  if (f.startsWith("page@demo") || f.startsWith("page@a692")) {
    fs.unlinkSync(path.join(artifactsDir, f));
  }
}

const output = path.join(artifactsDir, "page@demo-raw.webm");
fs.renameSync(rawVideo, output);

// Auto-calculate speed to hit ~30 seconds
const rawDur = parseFloat(spawnSync("ffprobe", ["-v","quiet","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1", output], { encoding: "utf8" }).stdout.trim()) || 60;
const factor = rawDur / TARGET_SECONDS;
const setpts = (1 / factor).toFixed(4);
console.log(`原始 ${rawDur.toFixed(1)}s → 加速 ${factor.toFixed(2)}x → 目标 ${TARGET_SECONDS}s`);
const final = path.join(artifactsDir, "page@demo.webm");
const r = spawnSync("ffmpeg", [
  "-y", "-i", output,
  "-vf", `setpts=${setpts}*PTS`,
  "-an", "-c:v", "libvpx-vp9", "-crf", "26", "-b:v", "1M", "-threads", "4", final,
], { stdio: "inherit", timeout: 120_000 });

if (r.status !== 0) {
  console.warn("加速失败，保留原始视频");
  fs.renameSync(output, final);
} else {
  fs.unlinkSync(output);
}

// Duration
let dur = "?";
try {
  const p = spawnSync("ffprobe", ["-v","quiet","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1", final], { encoding: "utf8" });
  dur = parseFloat(p.stdout.trim()).toFixed(1);
} catch {}

console.log(`✅ 完成：${final}（${dur}s）`);
