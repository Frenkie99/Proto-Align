import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { getWorkspace } from "@/lib/server/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    return NextResponse.json(getWorkspace(projectId));
  } catch (error) {
    return errorResponse(error, 404);
  }
}
