import "server-only";

import { lookup } from "node:dns/promises";
import { isPrivateNetworkAddress, isUnsafePublicHostname } from "@/lib/core/demo-security";

export async function assertPublicPrototypeUrl(rawUrl: string, checkedHosts = new Map<string, Promise<void>>()) {
  if (process.env.PROTOALIGN_PUBLIC_MODE !== "1") return;
  const parsed = new URL(rawUrl);
  if (!(["http:", "https:"] as string[]).includes(parsed.protocol)) throw new Error("公网演示只允许采集 HTTP 或 HTTPS 网页");
  const hostname = parsed.hostname.toLowerCase();
  if (isUnsafePublicHostname(hostname)) throw new Error("公网演示禁止采集本机、内网或保留地址");

  let check = checkedHosts.get(hostname);
  if (!check) {
    check = lookup(hostname, { all: true, verbatim: true }).then((addresses) => {
      if (!addresses.length) throw new Error("原型域名没有可用地址");
      if (addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
        throw new Error("公网演示禁止采集解析到本机、内网或保留地址的网页");
      }
    });
    checkedHosts.set(hostname, check);
  }
  await check;
}
