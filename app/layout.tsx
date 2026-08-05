import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProtoAlign · 原型对齐助手",
  description: "以 Issue 生命周期为核心的 AI 产品原型评审工作台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
