import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, listProjects } from "@/lib/server/repository";
import { errorResponse } from "@/lib/server/http";
import { parseFeaturedProjectIds, selectDemoProjects } from "@/lib/core/demo-projects";

const ProjectInput = z.object({
  name: z.string().trim().min(1, "请填写项目名称").max(80),
  goal: z.string().trim().min(1, "请填写产品目标").max(2_000),
  scope: z.string().trim().min(1, "请填写评审范围").max(2_000),
});

export async function GET() {
  const projects = listProjects();
  if (process.env.PROTOALIGN_PUBLIC_MODE !== "1") return NextResponse.json({ projects });
  return NextResponse.json({
    projects: selectDemoProjects(projects, parseFeaturedProjectIds(process.env.PROTOALIGN_FEATURED_PROJECT_IDS), getSessionProjectIds()),
  });
}

export async function POST(request: Request) {
  try {
    const input = ProjectInput.parse(await request.json());
    const project = createProject(input);
    if (process.env.PROTOALIGN_PUBLIC_MODE === "1") getSessionProjectIds().add(project.id);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(new Error(error.issues[0]?.message || "项目参数无效"));
    return errorResponse(error);
  }
}

function getSessionProjectIds() {
  const state = globalThis as typeof globalThis & { protoalignDemoSessionProjects?: Set<string> };
  state.protoalignDemoSessionProjects ??= new Set<string>();
  return state.protoalignDemoSessionProjects;
}
