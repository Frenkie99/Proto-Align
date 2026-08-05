import fs from "node:fs";
import path from "node:path";

export const STATIC_PROTOTYPE_CSP = "sandbox allow-scripts allow-forms; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' data:; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'";

export function readStaticAsset(storagePath: string, assetPath: string[]) {
  const root = path.resolve(storagePath);
  const filePath = path.resolve(root, ...assetPath);
  const rootWithSeparator = `${root}${path.sep}`;
  if (!filePath.startsWith(rootWithSeparator)) throw new Error("原型资源路径不安全");
  let stats: fs.Stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    throw new Error("原型资源不存在");
  }
  if (!stats.isFile()) throw new Error("原型资源不存在");
  return { body: fs.readFileSync(filePath), contentType: staticContentType(filePath) };
}

function staticContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return ({ ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2" } as Record<string, string>)[extension] || "application/octet-stream";
}
