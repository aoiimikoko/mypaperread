import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
const MAX_BYTES = 12 * 1024 * 1024;

function allowed(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("仅支持 http 或 https 链接");
  if (url.username || url.password) throw new Error("链接中不能包含账号密码");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("仅支持公开链接");
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|\[::1\]$)/.test(host)) throw new Error("仅支持公开链接");
  const m = host.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) throw new Error("仅支持公开链接");
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const { url: value } = await request.json() as { url?: string };
    if (!value || value.length > 2000) return NextResponse.json({ error: "请输入有效链接" }, { status: 400 });
    let url = allowed(value);
    let response: Response | undefined;
    for (let i = 0; i < 4; i++) {
      response = await fetch(url, { headers: { Accept: "application/pdf,text/html,text/plain;q=0.8" }, redirect: "manual" });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("链接跳转失败");
      url = allowed(new URL(location, url).toString());
    }
    if (!response?.ok) throw new Error(`无法读取此链接（HTTP ${response?.status || "未知"}）`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) throw new Error("链接文件过大，建议下载后从本地导入");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new Error("链接文件过大，建议下载后从本地导入");
    const type = response.headers.get("content-type") || "";
    const bytes = new Uint8Array(buffer);
    const pdf = type.includes("application/pdf") || url.pathname.toLowerCase().endsWith(".pdf") || (bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70);
    if (pdf) {
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return NextResponse.json({ kind: "pdf", title: decodeURIComponent(url.pathname.split("/").pop() || "远程 PDF"), data: btoa(binary) });
    }
    if (!type.includes("text/html") && !type.includes("text/plain")) throw new Error("此链接不是 PDF 或可阅读网页");
    const html = new TextDecoder().decode(bytes);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || url.hostname;
    const text = html.replace(/<(script|style|nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|section|article|h[1-6]|li)>/gi, "\n\n").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim().slice(0, 300000);
    if (text.length < 80) throw new Error("未找到可阅读的正文");
    return NextResponse.json({ kind: "web", title, text });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "链接导入失败" }, { status: 400 });
  }
}
