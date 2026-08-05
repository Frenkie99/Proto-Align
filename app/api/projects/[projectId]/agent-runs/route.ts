import { NextResponse } from "next/server";
import { z } from "zod";
import { executeAgentRun } from "@/lib/server/agent";
import { errorResponse } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 120;

const Input = z.object({
  mode: z.enum(["review", "verify"]),
  versionId: z.string().min(1),
  issueId: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const input = Input.parse(await request.json());
    const runId = await executeAgentRun({ projectId, ...input });
    return NextResponse.json({ runId });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
