import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { ingestSource } from "@/lib/server/ingestion";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const source = await ingestSource(projectId, await request.formData());
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
