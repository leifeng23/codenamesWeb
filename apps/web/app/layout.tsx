import type { Metadata, Viewport } from "next";
import { ToastProvider } from "../components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codenames同人在线版",
  description: "一个支持自定义题库与实时房间的 Codenames 同人在线版。"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
