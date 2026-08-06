const BASIC_USERNAME = "protoalign";

export function isDemoAccessAuthorized(authorization: string | null, configuredPassword: string | undefined) {
  const password = configuredPassword?.trim();
  if (!password) return true;
  if (!authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const username = decoded.slice(0, separator);
    const candidate = decoded.slice(separator + 1);
    return constantTimeEqual(username, BASIC_USERNAME) && constantTimeEqual(candidate, password);
  } catch {
    return false;
  }
}

export function parseDailyAgentLimit(raw: string | undefined) {
  if (!raw?.trim()) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("PROTOALIGN_DAILY_AGENT_LIMIT 必须是正整数");
  }
  return value;
}

export class AgentRunLimitError extends Error {}

export function assertAgentRunLimit(usedToday: number, limit: number) {
  if (usedToday >= limit) {
    throw new AgentRunLimitError(`今日 Agent 运行额度已用完（${usedToday}/${limit}），请明日再试或由项目所有者调整额度`);
  }
}

export function startOfTodayInShanghai(reference = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
  return new Date(`${date}T00:00:00+08:00`).toISOString();
}

export function isUnsafePublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!normalized) return true;
  if (isPrivateNetworkAddress(normalized)) return true;
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized.endsWith(".local")
    || normalized.endsWith(".internal");
}

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  if (normalized.includes(":")) {
    return normalized === "::"
      || normalized === "::1"
      || /^f[cd][0-9a-f]{2}:/.test(normalized)
      || /^fe[89ab][0-9a-f]:/.test(normalized)
      || /^ff[0-9a-f]{2}:/.test(normalized);
  }
  return isPrivateIpv4(normalized);
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function constantTimeEqual(left: string, right: string) {
  const size = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
