import { NextResponse } from "next/server";

export function errorResponse(cause: unknown, status = 400) {
  const raw = cause instanceof Error ? cause.message : "请求处理失败";
  const message = raw
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[已隐藏]")
    .replaceAll(process.cwd(), "[项目目录]")
    .slice(0, 800);
  return NextResponse.json({ error: message }, { status });
}
