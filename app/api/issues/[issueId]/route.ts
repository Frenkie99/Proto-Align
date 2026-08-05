import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { updateIssueStatus } from "@/lib/server/repository";

const allowedStatuses = ["待澄清", "待处理", "处理中", "待验证", "已解决", "已延后", "已接受风险", "重新打开"] as const;
const Input = z.object({ status: z.enum(allowedStatuses), reason: z.string().trim().min(2, "请填写操作依据").max(2_000) });

export async function PATCH(request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    const { issueId } = await params;
    const input = Input.parse(await request.json());
    updateIssueStatus(issueId, input.status, input.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
