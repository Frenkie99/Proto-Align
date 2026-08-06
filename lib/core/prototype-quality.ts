export type PrototypeReviewability = "reviewable" | "login_required" | "loading_shell" | "failed" | "unknown";

export interface PrototypeQualityInput {
  pageUrl: string;
  title: string;
  visibleText: string;
  controlCount: number;
  elementCount: number;
  hasPasswordField: boolean;
  readyState: string;
}

export interface PrototypeQualityResult {
  status: Exclude<PrototypeReviewability, "failed" | "unknown">;
  reason: string;
}

const LOGIN_TEXT = /(?:登录|登陆|验证码|忘记密码|sign\s*in|log\s*in|forgot\s+password|authentication)/i;
const LOGIN_URL = /\/(?:login|log-in|signin|sign-in|auth)(?:[/?#]|$)/i;
const LOADING_ONLY = /^(?:loading|loading[.….]*|加载中|正在加载|请稍候|please\s+wait|spinner)[.….\s]*$/i;

export function classifyPrototypeQuality(input: PrototypeQualityInput): PrototypeQualityResult {
  const visibleText = input.visibleText.trim().replace(/\s+/g, " ");
  const loginSignals = [
    input.hasPasswordField,
    LOGIN_URL.test(input.pageUrl),
    LOGIN_TEXT.test(input.title),
    LOGIN_TEXT.test(visibleText),
  ].filter(Boolean).length;
  const compactLoginGate = LOGIN_TEXT.test(visibleText) && visibleText.length < 240 && input.controlCount <= 6 && input.elementCount < 30;

  if (input.hasPasswordField || loginSignals >= 2 || compactLoginGate) {
    return {
      status: "login_required",
      reason: input.hasPasswordField
        ? "检测到密码输入框，当前采集结果是登录门槛，不是可评审产品页面。"
        : compactLoginGate
          ? "页面内容集中于登录操作，未出现可评审的产品主体。"
          : "页面地址、标题或正文包含多项登录信号，需提供公开可访问入口后重新导入。",
    };
  }

  const loadingMarker = LOADING_ONLY.test(visibleText);
  const sparseShell = visibleText.length < 16 && input.controlCount === 0 && input.elementCount < 8;
  const incompleteShell = input.readyState !== "complete" && visibleText.length < 40 && input.controlCount === 0;
  if (loadingMarker || sparseShell || incompleteShell) {
    const reason = loadingMarker
      ? "页面仅显示加载提示，未获得可评审的产品内容或控件。"
      : incompleteShell
        ? `页面加载状态为 ${input.readyState || "未知"}，且内容与控件不足。`
        : "页面可见内容、控件和 DOM 元素过少，疑似空壳页面。";
    return { status: "loading_shell", reason };
  }

  if (visibleText.length >= 16 || input.controlCount > 0 || input.elementCount >= 8) {
    return {
      status: "reviewable",
      reason: `已采集 ${input.elementCount} 个可见元素、${input.controlCount} 个控件和 ${visibleText.length} 个可见字符。`,
    };
  }

  return { status: "loading_shell", reason: "采集完成，但没有足够的可见产品内容用于评审。" };
}

export function reviewabilityLabel(status: PrototypeReviewability) {
  if (status === "reviewable") return "可评审";
  if (status === "login_required") return "疑似登录页";
  if (status === "loading_shell") return "加载未完成 / 空壳";
  if (status === "failed") return "采集失败";
  return "待诊断";
}
