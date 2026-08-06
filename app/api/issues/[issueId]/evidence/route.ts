import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { addIssueEvidence } from "@/lib/server/repository";

const Input = z.object({
  sourceId: z.string().optional(),
  prototypeVersionId: z.string().optional(),
  quoteText: z.string().min(1, "请填写证据原文").max(2_000),
  sourceLocation: z.string().max(500),
  selector: z.string().max(800).optional(),
  sourceRole: z.enum(["customer", "development"]).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    const { issueId } = await params;
    const input = Input.parse(await request.json());
    if (!input.sourceId && !input.prototypeVersionId) {
      return errorResponse(new Error("必须关联至少一个资料或原型版本"));
    }
    const evidenceId = addIssueEvidence({ issueId, ...input });
    return NextResponse.json({ evidenceId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
