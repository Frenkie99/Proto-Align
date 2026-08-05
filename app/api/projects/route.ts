import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, listProjects } from "@/lib/server/repository";
import { errorResponse } from "@/lib/server/http";

const ProjectInput = z.object({
  name: z.string().trim().min(1, "请填写项目名称").max(80),
  goal: z.string().trim().min(1, "请填写产品目标").max(2_000),
  scope: z.string().trim().min(1, "请填写评审范围").max(2_000),
});

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(request: Request) {
  try {
    const input = ProjectInput.parse(await request.json());
    return NextResponse.json({ project: createProject(input) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(new Error(error.issues[0]?.message || "项目参数无效"));
    return errorResponse(error);
  }
}
