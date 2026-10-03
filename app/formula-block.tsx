"use client";

import { useEffect, useRef, useState } from "react";
import { getPdf } from "./pdf-page";
import { sentenceItemRanges } from "@/lib/sentences";

/** Render the original PDF region so matrix geometry and missing font mappings survive. */
export default function FormulaBlock({ data, pageIndex, source, active, onSelect }: {
  data?: Uint8Array; pageIndex: number; source: string; active: boolean; onSelect: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      const show = !!entries[0]?.isIntersecting;
      setVisible(show);
      if (!show && canvas.current) { canvas.current.width = 1; canvas.current.height = 1; setReady(false); }
    }, { rootMargin: "250px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!data || !visible || !canvas.current) return;
    let cancelled = false;
    let task: { promise: Promise<void>; cancel: () => void } | undefined;
    setFailed(false);
    setReady(false);
    (async () => {
      try {
        const pdf = await getPdf(data);
        const page = await pdf.getPage(pageIndex + 1);
        const content = await page.getTextContent();
        const items = content.items.filter(item => "str" in item);
        const range = sentenceItemRanges(items.map(item => item.str), [source])[0];
        if (!range) throw new Error("Formula position not found");
        const viewport = page.getViewport({ scale: 1.8 });
        const boxes = items.slice(range.startItem, range.endItem + 1).filter(item => item.str.trim()).map(item => {
          const x = item.transform[4], y = item.transform[5];
          const height = Math.max(item.height, Math.hypot(item.transform[2], item.transform[3]), 5);
          const box = viewport.convertToViewportRectangle([x, y - height * .3, x + item.width, y + height]);
          return [Math.min(box[0], box[2]), Math.min(box[1], box[3]), Math.max(box[0], box[2]), Math.max(box[1], box[3])];
        });
        if (!boxes.length || cancelled || !canvas.current) return;
        const left = Math.max(0, Math.min(...boxes.map(box => box[0])) - 14);
        const top = Math.max(0, Math.min(...boxes.map(box => box[1])) - 14);
        const right = Math.min(viewport.width, Math.max(...boxes.map(box => box[2])) + 14);
        const bottom = Math.min(viewport.height, Math.max(...boxes.map(box => box[3])) + 14);
        const element = canvas.current;
        element.width = Math.ceil(right - left);
        element.height = Math.ceil(bottom - top);
        task = page.render({ canvas: element, canvasContext: element.getContext("2d")!, viewport, transform: [1, 0, 0, 1, -left, -top] });
        await task.promise;
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [data, pageIndex, source, visible]);
  return <div ref={host} className={`linked-formula formula-block${active ? " linked-sentence-active" : ""}`} onClick={onSelect}>
    <div className="formula-block-label">公式 · 原文</div>
    <canvas ref={canvas} className={ready ? "formula-canvas" : "formula-canvas formula-canvas-pending"} role="img" aria-label="原文公式或矩阵"/>
    {!ready && <div className="formula-fallback">{failed || !data ? source : "正在加载原文公式…"}</div>}
  </div>;
}
