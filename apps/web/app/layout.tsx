import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cosmere CodeNames",
  description: "A modern web edition of Cosmere CodeNames."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
