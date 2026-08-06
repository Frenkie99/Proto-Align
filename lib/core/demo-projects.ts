import type { ProjectSummary } from "@/lib/types";

export function parseFeaturedProjectIds(raw: string | undefined) {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
}

export function selectDemoProjects(projects: ProjectSummary[], featuredIds: string[], sessionProjectIds: Iterable<string>) {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const featured = featuredIds.flatMap((projectId, index) => {
    const project = byId.get(projectId);
    return project ? [presentFeaturedProject(project, index)] : [];
  });
  const featuredSet = new Set(featuredIds);
  const sessionSet = new Set(sessionProjectIds);
  const sessionProjects = projects.filter((project) => sessionSet.has(project.id) && !featuredSet.has(project.id));
  return [...featured, ...sessionProjects];
}

export function presentFeaturedProject(project: ProjectSummary, index: number) {
  const baseName = project.name
    .replace(/^(录制案例|真实案例)｜/, "")
    .replace(/｜第\s*\d+\s*次$/, "")
    .replace(/^OpenAI\s+/, "");
  const descriptors = ["完整闭环", "工具与隔离", "稳定性评审"];
  return { ...project, name: descriptors[index] ? `${baseName}｜${descriptors[index]}` : baseName };
}
