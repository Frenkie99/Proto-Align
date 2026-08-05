import path from "node:path";

export function chunkText(content: string, size = 1_200, overlap = 180) {
  const chunks: Array<{ content: string; start: number; end: number }> = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(content.length, start + size);
    chunks.push({ content: content.slice(start, end), start, end });
    if (end === content.length) break;
    start = end - overlap;
  }
  return chunks;
}

export function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeZipPath(value: string) {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/")).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || path.posix.isAbsolute(normalized)) {
    throw new Error("ZIP 包含不安全的文件路径");
  }
  return normalized;
}
