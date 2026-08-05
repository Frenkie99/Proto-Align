import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { ingestPrototype } from "@/lib/server/ingestion";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const prototype = await ingestPrototype(projectId, await request.formData());
    return NextResponse.json({ prototype }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
