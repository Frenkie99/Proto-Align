import { describe, expect, it } from "vitest";
import { compareReviewRuns } from "@/lib/core/run-comparison";

const evidence = (location: string, quote: string) => [{ sourceLocation: location, selector: "#confirm", quoteText: quote }];

describe("compareReviewRuns", () => {
  it("matches paraphrased themes and exposes severity and evidence changes", () => {
    const result = compareReviewRuns(
      { id: "run-a", startedAt: "2026-08-06T01:00:00.000Z" },
      { id: "run-b", startedAt: "2026-08-06T02:00:00.000Z" },
      [
        { id: "a1", runId: "run-a", title: "发送确认入口缺失", issueType: "人工确认", severity: "阻塞", evidence: evidence("V1 / 回复区", "只有自动发送") },
        { id: "a2", runId: "run-a", title: "失败状态没有恢复入口", issueType: "异常处理", severity: "高", evidence: evidence("V1 / 错误态", "请重试") },
        { id: "b1", runId: "run-b", title: "缺少发送前人工确认", issueType: "人工确认", severity: "高", evidence: evidence("V1 / 操作区", "确认并发送") },
        { id: "b2", runId: "run-b", title: "知识来源没有说明", issueType: "可追溯性", severity: "中", evidence: evidence("V1 / 答案", "AI 生成") },
      ],
    );

    expect(result.shared).toHaveLength(1);
    expect(result.shared[0]).toMatchObject({ severityChanged: true, evidenceChanged: true });
    expect(result.onlyA.map((issue) => issue.id)).toEqual(["a2"]);
    expect(result.onlyB.map((issue) => issue.id)).toEqual(["b2"]);
    expect(result.stability).toMatchObject({ label: "有波动", needsHumanConfirmation: true });
  });

  it("reports stable repeated evidence without changing issue state", () => {
    const result = compareReviewRuns(
      { id: "run-a", startedAt: "2026-08-06T01:00:00.000Z" },
      { id: "run-b", startedAt: "2026-08-06T02:00:00.000Z" },
      [
        { id: "a1", runId: "run-a", title: "缺少失败恢复入口", issueType: "异常处理", severity: "高", evidence: evidence("V1 / 错误态", "重新尝试") },
        { id: "b1", runId: "run-b", title: "失败后没有恢复入口", issueType: "异常处理", severity: "高", evidence: evidence("V1 / 错误态", "重新尝试") },
      ],
    );

    expect(result.stability).toMatchObject({ label: "较稳定", matchRatio: 1, needsHumanConfirmation: true });
  });

  it("keeps unrelated issues separate even when their type and generic selector match", () => {
    const result = compareReviewRuns(
      { id: "run-a", startedAt: "2026-08-06T01:00:00.000Z" },
      { id: "run-b", startedAt: "2026-08-06T02:00:00.000Z" },
      [
        { id: "a1", runId: "run-a", title: "模型选择逻辑不透明", issueType: "体验缺陷", severity: "高", evidence: [{ sourceLocation: "V1", selector: "body", quoteText: "Omni" }] },
        { id: "b1", runId: "run-b", title: "数据共享开关不可见", issueType: "体验缺陷", severity: "高", evidence: [{ sourceLocation: "V1", selector: "body", quoteText: "Data sharing" }] },
      ],
    );

    expect(result.shared).toHaveLength(0);
    expect(result.onlyA).toHaveLength(1);
    expect(result.onlyB).toHaveLength(1);
  });
});
