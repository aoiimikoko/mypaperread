"use client";
import { useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export default function FormulaBlock({ latex, error, method, active, onSelect }: {
  latex?: string; error?: string; method?: "text" | "vision"; active: boolean; onSelect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const rendered = useMemo(() => {
    if (!latex) return null;
    try { return katex.renderToString(latex, { displayMode: true, throwOnError: true, trust: false, maxExpand: 1000, strict: "ignore" }); }
    catch { return null; }
  }, [latex]);
  return <div className={`linked-formula formula-block${active ? " linked-sentence-active" : ""}`} onClick={onSelect}>
    <div className="formula-block-head"><span>公式 · LaTeX{method === "text" ? " · 文本重建，请核对" : ""}</span>{rendered && <button type="button" onClick={async event => { event.stopPropagation(); try { await navigator.clipboard.writeText(latex!); setCopied(true); } catch { setCopied(false); } }}>{copied ? "已复制" : "复制 LaTeX"}</button>}</div>
    {rendered ? <><div className="formula-math" dangerouslySetInnerHTML={{ __html: rendered }}/><details onClick={event => event.stopPropagation()}><summary>LaTeX 源码</summary><pre>{latex}</pre></details></> : <div className="formula-status">{error || (latex ? "公式格式无效，请重新识别" : "请重新翻译此页以生成 LaTeX")}</div>}
  </div>;
}
