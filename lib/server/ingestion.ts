import "server-only";

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { unzipSync } from "fflate";
import { htmlToText, normalizeZipPath } from "@/lib/core/text";
import { classifyPrototypeQuality } from "@/lib/core/prototype-quality";
import { db, screenshotsRoot, uploadsRoot } from "./db";
import { addSource, getPrototype, insertPrototype, updatePrototypeCapture } from "./repository";
import { readStaticAsset, STATIC_PROTOTYPE_CSP } from "./static-assets";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_PROTOTYPE_BYTES = 25 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
const MAX_ZIP_FILES = 1_000;

export async function ingestSource(projectId: string, formData: FormData) {
  const kind = requiredString(formData, "kind", 60);
  const role = requiredString(formData, "role", 100);
  const title = requiredString(formData, "title", 160);
  const originalLocation = optionalString(formData, "originalLocation", 400);
  const file = fileValue(formData.get("file"));
  let content = optionalString(formData, "content", MAX_SOURCE_BYTES);

  if (file) {
    if (file.size > MAX_SOURCE_BYTES) throw new Error("文本文件不能超过 2 MB");
    if (!/\.(txt|md|html?)$/i.test(file.name)) throw new Error("当前只支持 TXT、Markdown 和 HTML 文本文件");
    content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    if (/\.html?$/i.test(file.name)) content = htmlToText(content);
  }
  if (!content.trim()) throw new Error("请填写原文或上传非空文本文件");

  return addSource({ projectId, kind, role, title, originalLocation: originalLocation || file?.name || "手工录入", content: content.trim() });
}

export async function ingestPrototype(projectId: string, formData: FormData) {
  const label = requiredString(formData, "label", 30).toUpperCase();
  const sourceType = requiredString(formData, "sourceType", 10) as "url" | "html" | "zip";
  const notes = optionalString(formData, "notes", 2_000);
  const url = optionalString(formData, "url", 2_000);
  const file = fileValue(formData.get("file"));
  if (!/^[A-Z][A-Z0-9._-]{0,29}$/.test(label)) throw new Error("版本标识只能包含字母、数字、点、短横线或下划线");
  if (!(["url", "html", "zip"] as const).includes(sourceType)) throw new Error("不支持的原型导入方式");

  let sourceUrl: string | undefined;
  if (sourceType === "url") {
    if (!url) throw new Error("请输入可访问的原型 URL");
    const parsed = new URL(url);
    if (!(["http:", "https:"] as string[]).includes(parsed.protocol)) throw new Error("原型 URL 只支持 HTTP 或 HTTPS");
    sourceUrl = parsed.toString();
  } else {
    if (!file) throw new Error("请选择 HTML 或 ZIP 文件");
    if (file.size > MAX_PROTOTYPE_BYTES) throw new Error("原型文件不能超过 25 MB");
    if (sourceType === "html" && !/\.html?$/i.test(file.name)) throw new Error("请选择单文件 HTML");
    if (sourceType === "zip" && !/\.zip$/i.test(file.name)) throw new Error("请选择静态构建 ZIP");
  }

  const versionId = insertPrototype({ projectId, label, sourceType, sourceUrl, notes });
  try {
    let storagePath: string | undefined;
    let entryPath: string | undefined;
    if (file) {
      storagePath = path.join(uploadsRoot, projectId, versionId);
      fs.mkdirSync(storagePath, { recursive: true });
      if (sourceType === "html") {
        entryPath = "index.html";
        fs.writeFileSync(path.join(/* turbopackIgnore: true */ storagePath, entryPath), Buffer.from(await file.arrayBuffer()));
      } else {
        entryPath = extractStaticZip(new Uint8Array(await file.arrayBuffer()), storagePath);
      }
      setPrototypeStorage(versionId, storagePath, entryPath);
    }
    await capturePrototype(versionId);
    return getPrototype(versionId);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "原型采集失败";
    updatePrototypeCapture(versionId, { status: "failed", error: message, reviewability: "failed", reviewabilityReason: message });
    throw new Error(`原型已记录，但 DOM 采集失败：${message}`);
  }
}

export async function capturePrototype(versionId: string) {
  const version = getPrototype(versionId);
  const { getPrototypeFileInfo } = await import("./repository");
  const fileInfo = getPrototypeFileInfo(versionId);
  const target = version.sourceType === "url"
    ? version.sourceUrl
    : fileInfo.storagePath && fileInfo.entryPath
      ? `http://protoalign-upload.local/${fileInfo.entryPath.split("/").map(encodeURIComponent).join("/")}`
      : null;
  if (!target) throw new Error("原型入口不存在");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    if (version.sourceType !== "url") {
      await page.route("**/*", async (route) => {
        try {
          const requestUrl = new URL(route.request().url());
          if (requestUrl.origin !== "http://protoalign-upload.local" || !fileInfo.storagePath) {
            await route.abort("blockedbyclient");
            return;
          }
          const assetPath = decodeURIComponent(requestUrl.pathname).split("/").filter(Boolean);
          const asset = readStaticAsset(fileInfo.storagePath, assetPath);
          await route.fulfill({ status: 200, body: asset.body, contentType: asset.contentType, headers: { "content-security-policy": STATIC_PROTOTYPE_CSP } });
        } catch {
          await route.fulfill({ status: 404, body: "Prototype asset not found" });
        }
      });
    }
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
    const snapshot = await page.evaluate(() => {
      function selectorFor(element: Element) {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const testId = element.getAttribute("data-testid");
        if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
        const parts: string[] = [];
        let current: Element | null = element;
        while (current && current !== document.body && parts.length < 5) {
          let part = current.tagName.toLowerCase();
          const parent: Element | null = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter((item: Element) => item.tagName === current!.tagName);
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
          }
          parts.unshift(part);
          current = parent;
        }
        return `body > ${parts.join(" > ")}`;
      }
      const elements = Array.from(document.querySelectorAll("body *")).filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }).slice(0, 600).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || "",
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 240),
          ariaLabel: element.getAttribute("aria-label") || "",
          selector: selectorFor(element),
          box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        };
      });
      const controlTags = new Set(["button", "input", "select", "textarea", "a"]);
      return {
        title: document.title,
        pageUrl: location.href,
        visibleText: (document.body.innerText || "").trim().replace(/\n{3,}/g, "\n\n").slice(0, 80_000),
        elements,
        controls: elements.filter((element) => controlTags.has(element.tag) || Boolean(element.role)).slice(0, 300),
        hasPasswordField: Boolean(document.querySelector('input[type="password"]')),
        readyState: document.readyState,
      };
    });
    const screenshotPath = path.join(screenshotsRoot, `${versionId}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const safePageUrl = version.sourceType === "url" ? snapshot.pageUrl : `uploaded-static://${version.label}/${fileInfo.entryPath || "index.html"}`;
    const quality = classifyPrototypeQuality({
      pageUrl: safePageUrl,
      title: snapshot.title,
      visibleText: snapshot.visibleText,
      controlCount: snapshot.controls.length,
      elementCount: snapshot.elements.length,
      hasPasswordField: snapshot.hasPasswordField,
      readyState: snapshot.readyState,
    });
    updatePrototypeCapture(versionId, { ...snapshot, pageUrl: safePageUrl, dom: snapshot.elements, screenshotPath, status: "captured", reviewability: quality.status, reviewabilityReason: quality.reason });
    await context.close();
  } finally {
    await browser.close();
  }
}

function extractStaticZip(bytes: Uint8Array, outputRoot: string) {
  const entries = unzipSync(bytes);
  const names = Object.keys(entries);
  if (names.length > MAX_ZIP_FILES) throw new Error("ZIP 文件数量超过 1000 个");
  const total = names.reduce((sum, name) => sum + entries[name].byteLength, 0);
  if (total > MAX_UNPACKED_BYTES) throw new Error("ZIP 解压后不能超过 100 MB");
  for (const name of names) {
    const safeName = normalizeZipPath(name);
    if (!safeName || name.endsWith("/")) continue;
    const destination = path.join(outputRoot, safeName);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, entries[name]);
  }
  const htmlEntries = names.map(normalizeZipPath).filter((name) => /(^|\/)index\.html?$/i.test(name));
  if (!htmlEntries.length) throw new Error("静态 ZIP 中没有 index.html 入口");
  return htmlEntries.sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length)[0];
}

function setPrototypeStorage(versionId: string, storagePath: string, entryPath: string) {
  db.prepare(`UPDATE prototype_versions SET storage_path = ?, entry_path = ? WHERE id = ?`).run(storagePath, entryPath, versionId);
}

function requiredString(formData: FormData, key: string, max: number) {
  const value = optionalString(formData, key, max).trim();
  if (!value) throw new Error(`缺少必填字段：${key}`);
  return value;
}

function optionalString(formData: FormData, key: string, max: number) {
  const raw = formData.get(key);
  const value = typeof raw === "string" ? raw : "";
  if (value.length > max) throw new Error(`${key} 内容过长`);
  return value;
}

function fileValue(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}
