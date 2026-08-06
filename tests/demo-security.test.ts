import { describe, expect, it } from "vitest";
import {
  assertAgentRunLimit,
  isDemoAccessAuthorized,
  isPrivateNetworkAddress,
  isUnsafePublicHostname,
  parseDailyAgentLimit,
} from "@/lib/core/demo-security";
import { parseFeaturedProjectIds, selectDemoProjects } from "@/lib/core/demo-projects";
import type { ProjectSummary } from "@/lib/types";

describe("demo access protection", () => {
  it("stays disabled for normal local development when no password is configured", () => {
    expect(isDemoAccessAuthorized(null, undefined)).toBe(true);
  });

  it("accepts only the configured Basic Auth password", () => {
    const valid = `Basic ${Buffer.from("protoalign:correct horse").toString("base64")}`;
    const invalid = `Basic ${Buffer.from("protoalign:wrong").toString("base64")}`;

    expect(isDemoAccessAuthorized(valid, "correct horse")).toBe(true);
    expect(isDemoAccessAuthorized(invalid, "correct horse")).toBe(false);
    expect(isDemoAccessAuthorized("Bearer token", "correct horse")).toBe(false);
    expect(isDemoAccessAuthorized(null, "correct horse")).toBe(false);
  });
});

describe("daily Agent run limit", () => {
  it("is optional locally and validates configured limits", () => {
    expect(parseDailyAgentLimit(undefined)).toBeNull();
    expect(parseDailyAgentLimit("12")).toBe(12);
    expect(() => parseDailyAgentLimit("0")).toThrow("正整数");
    expect(() => parseDailyAgentLimit("many")).toThrow("正整数");
  });

  it("rejects a run once the persisted daily count reaches the limit", () => {
    expect(() => assertAgentRunLimit(4, 5)).not.toThrow();
    expect(() => assertAgentRunLimit(5, 5)).toThrow("今日 Agent 运行额度已用完");
  });
});

describe("public prototype URL boundary", () => {
  it.each(["localhost", "demo.localhost", "metadata.google.internal", "service.local"])("blocks private hostname %s", (hostname) => {
    expect(isUnsafePublicHostname(hostname)).toBe(true);
  });

  it.each(["127.0.0.1", "10.0.0.8", "172.16.0.1", "192.168.1.2", "169.254.169.254", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"])("blocks private address %s", (address) => {
    expect(isPrivateNetworkAddress(address)).toBe(true);
  });

  it.each(["example.com", "1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("allows public address or hostname %s", (value) => {
    expect(isUnsafePublicHostname(value)).toBe(false);
    if (/[:\d]/.test(value) && !/[a-z]/i.test(value)) expect(isPrivateNetworkAddress(value)).toBe(false);
  });
});

describe("public demo project curation", () => {
  const project = (id: string, updatedAt: string): ProjectSummary => ({
    id, name: id, goal: "goal", scope: "scope", readinessSuggestion: "暂不可交付",
    sourceCount: 1, issueCount: 1, versionCount: 1, updatedAt,
  });

  it("keeps the configured order, then appends projects created in this demo session", () => {
    const projects = [project("recent-test", "3"), project("huggingchat", "2"), project("customer", "1"), project("trial", "4")];
    expect(parseFeaturedProjectIds(" customer, huggingchat, customer ")).toEqual(["customer", "huggingchat"]);
    const selected = selectDemoProjects(projects, ["customer", "huggingchat"], ["trial"]);
    expect(selected.map(({ id }) => id))
      .toEqual(["customer", "huggingchat", "trial"]);
    expect(selected.map(({ name }) => name)).toEqual(["customer｜完整闭环", "huggingchat｜工具与隔离", "trial"]);
  });
});
