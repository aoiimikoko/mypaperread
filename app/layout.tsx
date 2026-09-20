import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mypaperread · 文献对照阅读",
  description: "导入 PDF 或网页文献，进行原文与模型译文的对照阅读。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}

