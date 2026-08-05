import { errorResponse } from "@/lib/server/http";
import { getPrototypeFileInfo } from "@/lib/server/repository";
import { readStaticAsset, STATIC_PROTOTYPE_CSP } from "@/lib/server/static-assets";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string; assetPath: string[] }> }) {
  try {
    const { versionId, assetPath } = await params;
    const { storagePath } = getPrototypeFileInfo(versionId);
    if (!storagePath) throw new Error("该原型没有本地静态文件");
    const asset = readStaticAsset(storagePath, assetPath);
    const headers = new Headers({
      "content-type": asset.contentType,
      "cache-control": "private, max-age=60",
      "content-security-policy": STATIC_PROTOTYPE_CSP,
      "x-content-type-options": "nosniff",
    });
    return new Response(asset.body, { headers });
  } catch (error) {
    return errorResponse(error, 404);
  }
}
