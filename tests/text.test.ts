import { describe, expect, it } from "vitest";
import { chunkText, htmlToText, normalizeZipPath } from "@/lib/core/text";

describe("text ingestion", () => {
  it("chunks long evidence with stable overlap", () => {
    const chunks = chunkText("a".repeat(2_500));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ start: 0, end: 1_200 });
    expect(chunks[1]).toMatchObject({ start: 1_020, end: 2_220 });
    expect(chunks[2]).toMatchObject({ start: 2_040, end: 2_500 });
  });

  it("extracts visible text without scripts or styles", () => {
    expect(htmlToText("<style>.x{}</style><h1>目标</h1><script>alert(1)</script><p>A&amp;B</p>"))
      .toBe("目标 A&B");
  });

  it("rejects zip traversal paths", () => {
    expect(() => normalizeZipPath("../../secret.txt")).toThrow("不安全");
    expect(normalizeZipPath("dist/index.html")).toBe("dist/index.html");
  });
});
