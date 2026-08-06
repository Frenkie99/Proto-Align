import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { getWorkspace } from "@/lib/server/repository";
import { parseFeaturedProjectIds, presentFeaturedProject } from "@/lib/core/demo-projects";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const workspace = getWorkspace(projectId);
    if (process.env.PROTOALIGN_PUBLIC_MODE === "1") {
      const featuredIndex = parseFeaturedProjectIds(process.env.PROTOALIGN_FEATURED_PROJECT_IDS).indexOf(projectId);
      if (featuredIndex >= 0) workspace.project = presentFeaturedProject(workspace.project, featuredIndex);
    }
    return NextResponse.json(workspace);
  } catch (error) {
    return errorResponse(error, 404);
  }
}
