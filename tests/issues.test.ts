import { describe, expect, it } from "vitest";
import { canResolveIssue } from "@/lib/core/issues";

describe("issue resolution boundary", () => {
  it("allows human closure only after a suspiciously-resolved verification", () => {
    expect(canResolveIssue("疑似已解决")).toBe(true);
    expect(canResolveIssue("未解决")).toBe(false);
    expect(canResolveIssue("无法判断")).toBe(false);
    expect(canResolveIssue(null)).toBe(false);
  });
});
