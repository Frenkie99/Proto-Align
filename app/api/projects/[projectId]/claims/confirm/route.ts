import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { confirmClaims } from "@/lib/server/repository";

const Input = z.object({ claimIds: z.array(z.string()).min(1).max(100) });

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { claimIds } = Input.parse(await request.json());
    confirmClaims(projectId, claimIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
