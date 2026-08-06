import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const originalPassword = process.env.PROTOALIGN_ACCESS_PASSWORD;

afterEach(() => {
  if (originalPassword === undefined) delete process.env.PROTOALIGN_ACCESS_PASSWORD;
  else process.env.PROTOALIGN_ACCESS_PASSWORD = originalPassword;
});

describe("demo access proxy", () => {
  it("challenges unauthenticated page and API requests when configured", () => {
    process.env.PROTOALIGN_ACCESS_PASSWORD = "a secure demo password";
    const pageResponse = proxy(new NextRequest("https://demo.example.com/"));
    const apiResponse = proxy(new NextRequest("https://demo.example.com/api/projects"));

    expect(pageResponse.status).toBe(401);
    expect(pageResponse.headers.get("www-authenticate")).toContain("Basic");
    expect(apiResponse.status).toBe(401);
    expect(apiResponse.headers.get("cache-control")).toBe("no-store");
  });

  it("allows the configured credential and keeps unconfigured local development open", () => {
    process.env.PROTOALIGN_ACCESS_PASSWORD = "a secure demo password";
    const authorization = `Basic ${Buffer.from("protoalign:a secure demo password").toString("base64")}`;
    const allowed = proxy(new NextRequest("https://demo.example.com/", { headers: { authorization } }));
    expect(allowed.status).toBe(200);

    delete process.env.PROTOALIGN_ACCESS_PASSWORD;
    expect(proxy(new NextRequest("http://127.0.0.1:3000/")).status).toBe(200);
  });
});
