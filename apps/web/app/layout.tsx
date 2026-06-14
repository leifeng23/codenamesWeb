import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codenames同人在线版",
  description: "一个支持自定义题库与实时房间的 Codenames 同人在线版。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
