import type { ApiErrorPayload, ProjectSummary, PrototypeVersion, WorkspaceData } from "@/lib/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      if (payload.error) message = payload.error;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const api = {
  listProjects: () => request<{ projects: ProjectSummary[] }>("/api/projects"),
  createProject: (input: { name: string; goal: string; scope: string }) =>
    request<{ project: ProjectSummary }>("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  getWorkspace: (projectId: string) =>
    request<WorkspaceData>(`/api/projects/${projectId}`),
  addSource: (projectId: string, formData: FormData) =>
    request(`/api/projects/${projectId}/sources`, { method: "POST", body: formData }),
  addPrototype: (projectId: string, formData: FormData) =>
    request<{ prototype: PrototypeVersion }>(`/api/projects/${projectId}/prototypes`, { method: "POST", body: formData }),
  confirmClaims: (projectId: string, claimIds: string[]) =>
    request(`/api/projects/${projectId}/claims/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claimIds }),
    }),
  runAgent: (projectId: string, input: { mode: "review" | "verify"; versionId?: string; issueId?: string }) =>
    request<{ runId: string }>(`/api/projects/${projectId}/agent-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateIssue: (issueId: string, input: { status: string; reason: string }) =>
    request(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  addEvidence: (issueId: string, input: { sourceId?: string; prototypeVersionId?: string; quoteText: string; sourceLocation: string; selector?: string; sourceRole?: "customer" | "development" }) =>
    request(`/api/issues/${issueId}/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  chatWithAgent: (projectId: string, input: { issueId: string; message: string }) =>
    request<{ answer: string }>(`/api/projects/${projectId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
};
