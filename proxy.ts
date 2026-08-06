import { NextResponse, type NextRequest } from "next/server";
import { isDemoAccessAuthorized } from "@/lib/core/demo-security";

export function proxy(request: NextRequest) {
  if (isDemoAccessAuthorized(request.headers.get("authorization"), process.env.PROTOALIGN_ACCESS_PASSWORD)) {
    return NextResponse.next();
  }

  const headers = {
    "cache-control": "no-store",
    "www-authenticate": 'Basic realm="ProtoAlign Demo", charset="UTF-8"',
  };
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "需要输入 ProtoAlign 演示访问密码" }, { status: 401, headers });
  }
  return new NextResponse("需要输入 ProtoAlign 演示访问密码", { status: 401, headers });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
