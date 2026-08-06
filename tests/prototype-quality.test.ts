import { describe, expect, it } from "vitest";
import { classifyPrototypeQuality } from "@/lib/core/prototype-quality";

describe("classifyPrototypeQuality", () => {
  it("recognizes a reviewable product page from visible content and controls", () => {
    expect(classifyPrototypeQuality({
      pageUrl: "https://example.com/workbench",
      title: "AI 客服工作台",
      visibleText: "AI 客服工作台\n选择会话\n生成候选回复\n发送前由客服确认",
      controlCount: 4,
      elementCount: 24,
      hasPasswordField: false,
      readyState: "complete",
    })).toMatchObject({ status: "reviewable" });
  });

  it("recognizes a login gate without treating it as a product issue", () => {
    expect(classifyPrototypeQuality({
      pageUrl: "https://example.com/auth/sign-in",
      title: "Sign in",
      visibleText: "Sign in to continue Email Password Forgot password",
      controlCount: 4,
      elementCount: 18,
      hasPasswordField: true,
      readyState: "complete",
    })).toMatchObject({ status: "login_required", reason: expect.stringContaining("登录") });
  });

  it("recognizes a compact OAuth sign-in gate without a password field", () => {
    expect(classifyPrototypeQuality({
      pageUrl: "https://example.com/chat",
      title: "AI Chat",
      visibleText: "Sign in with Google to continue",
      controlCount: 2,
      elementCount: 10,
      hasPasswordField: false,
      readyState: "complete",
    })).toMatchObject({ status: "login_required" });
  });

  it.each([
    ["持续加载", "Loading…", 0, 4],
    ["空白根节点", "", 0, 2],
  ])("recognizes a loading or empty shell: %s", (_name, visibleText, controlCount, elementCount) => {
    expect(classifyPrototypeQuality({
      pageUrl: "https://example.com/app",
      title: "App",
      visibleText,
      controlCount,
      elementCount,
      hasPasswordField: false,
      readyState: "complete",
    })).toMatchObject({ status: "loading_shell", reason: expect.any(String) });
  });
});
