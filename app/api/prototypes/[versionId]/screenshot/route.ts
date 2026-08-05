import fs from "node:fs";
import { errorResponse } from "@/lib/server/http";
import { getPrototypeFileInfo } from "@/lib/server/repository";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const { screenshotPath } = getPrototypeFileInfo(versionId);
    if (!screenshotPath || !fs.existsSync(screenshotPath)) throw new Error("采集截图不存在");
    return new Response(fs.readFileSync(screenshotPath), { headers: { "content-type": "image/png", "cache-control": "private, max-age=60" } });
  } catch (error) {
    return errorResponse(error, 404);
  }
}
