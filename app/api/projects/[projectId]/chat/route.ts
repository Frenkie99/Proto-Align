import { NextResponse } from "next/server";
import { z } from "zod";
import { executeChat } from "@/lib/server/chat";
import { errorResponse } from "@/lib/server/http";
import { AgentRunLimitError, assertAgentRunLimit, parseDailyAgentLimit, startOfTodayInShanghai } from "@/lib/core/demo-security";
import { countAgentRunsStartedSince } from "@/lib/server/repository";

export const runtime = "nodejs";
export const maxDuration = 90;

const Input = z.object({
  issueId: z.string().min(1),
  message: z.string().trim().min(2, "请输入问题").max(800),
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const dailyLimit = parseDailyAgentLimit(process.env.PROTOALIGN_DAILY_AGENT_LIMIT);
    if (dailyLimit !== null) {
      assertAgentRunLimit(countAgentRunsStartedSince(startOfTodayInShanghai()), dailyLimit);
    }
    const { projectId } = await params;
    const input = Input.parse(await request.json());
    const { answer } = await executeChat({ projectId, ...input });
    return NextResponse.json({ answer });
  } catch (error) {
    return errorResponse(error, error instanceof AgentRunLimitError ? 429 : 502);
  }
}
