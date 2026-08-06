import { NextResponse } from "next/server";
import { z } from "zod";
import { executeAgentRun } from "@/lib/server/agent";
import { errorResponse } from "@/lib/server/http";
import { countAgentRunsStartedSince } from "@/lib/server/repository";
import { AgentRunLimitError, assertAgentRunLimit, parseDailyAgentLimit, startOfTodayInShanghai } from "@/lib/core/demo-security";

export const runtime = "nodejs";
export const maxDuration = 120;

const Input = z.object({
  mode: z.enum(["review", "verify"]),
  versionId: z.string().min(1),
  issueId: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const dailyLimit = parseDailyAgentLimit(process.env.PROTOALIGN_DAILY_AGENT_LIMIT);
    if (dailyLimit !== null) {
      assertAgentRunLimit(countAgentRunsStartedSince(startOfTodayInShanghai()), dailyLimit);
    }
    const { projectId } = await params;
    const input = Input.parse(await request.json());
    const runId = await executeAgentRun({ projectId, ...input });
    return NextResponse.json({ runId });
  } catch (error) {
    return errorResponse(error, error instanceof AgentRunLimitError ? 429 : 502);
  }
}
