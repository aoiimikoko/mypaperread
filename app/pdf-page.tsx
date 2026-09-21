"use client";

import { memo, useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { sentenceItemRanges, type ItemRange, type SentencePair } from "@/lib/sentences";

export type PdfMark = {
  startItem: number;
  startOffset: number;
  endItem: number;
  endOffset: number;
  color: "yellow" | "green" | "pink";
};

type Selection = { text: string; top: number; left: number };
const documentCache = new WeakMap<Uint8Array, Promise<PDFDocumentProxy>>();

function getPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  const cached = documentCache.get(data);
  if (cached) return cached;
  const loading = import("pdfjs-dist").then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    return pdfjs.getDocument({ data: data.slice() }).promise;
  }).catch(cause => { documentCache.delete(data); throw cause; });
  documentCache.set(data, loading);
  return loading;
}

type PdfPageProps = {
  data: Uint8Array;
  index: number;
  zoom: number;
  marks: PdfMark[];
  sentencePairs: SentencePair[];
  activeSentenceIndex: number | null;
  onSentenceSelect: (index: number) => void;
  onMark: (mark: PdfMark) => void;
  onTranslateSelection: (text: string) => Promise<string>;
};

function PdfPage({ data, index, zoom, marks, sentencePairs, activeSentenceIndex, onSentenceSelect, onMark, onTranslateSelection }: PdfPageProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);
  const selectedRange = useRef<Range | null>(null);
  const sentenceRanges = useRef<(ItemRange | null)[]>([]);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [rendered, setRendered] = useState(0);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [translation, setTranslation] = useState("");
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const resize = new ResizeObserver(entries => setWidth(Math.floor(entries[0]?.contentRect.width || 0)));
    resize.observe(element);
    const intersection = new IntersectionObserver(entries => {
      const nextVisible = !!entries[0]?.isIntersecting;
      setVisible(nextVisible);
      if (!nextVisible) {
        if (canvas.current) { canvas.current.width = 1; canvas.current.height = 1; }
        textLayer.current?.replaceChildren();
        sentenceRanges.current = [];
        selectedRange.current = null;
        setSelection(null);
        setRendered(0);
      }
    }, { rootMargin: "650px 0px" });
    intersection.observe(element);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, []);
  useEffect(() => {
    const clearCollapsed = () => {
      if (window.getSelection()?.isCollapsed) { setSelection(null); selectedRange.current = null; }
    };
    document.addEventListener("selectionchange", clearCollapsed);
    return () => document.removeEventListener("selectionchange", clearCollapsed);
  }, []);

  useEffect(() => {
    if (!visible || !width || !canvas.current || !textLayer.current) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;
    let layer: { cancel: () => void } | undefined;
    const layerElement = textLayer.current;
    layerElement.replaceChildren();
    setError("");
    (async () => {
      try {
        const [pdfjs, pdf] = await Promise.all([import("pdfjs-dist"), getPdf(data)]);
        const page = await pdf.getPage(index + 1);
        if (cancelled || !canvas.current) return;
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / original.width * zoom });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const element = canvas.current;
        element.width = Math.ceil(viewport.width * pixelRatio);
        element.height = Math.ceil(viewport.height * pixelRatio);
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        layerElement.style.width = `${viewport.width}px`;
        layerElement.style.height = `${viewport.height}px`;
        layerElement.style.setProperty("--total-scale-factor", String(viewport.scale));
        setSize({ width: viewport.width, height: viewport.height });
        renderTask = page.render({ canvas: element, canvasContext: element.getContext("2d")!, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        await renderTask.promise;
        if (cancelled) return;
        const textRender = new pdfjs.TextLayer({ textContentSource: await page.getTextContent(), container: layerElement, viewport });
        layer = textRender;
        await textRender.render();
        if (!cancelled) { page.cleanup(); setRendered(value => value + 1); }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? `PDF 页面渲染失败：${cause.message}` : "PDF 页面渲染失败");
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); layer?.cancel(); };
  }, [data, index, width, zoom, visible]);

  useEffect(() => {
    if (!rendered || !textLayer.current || selection) return;
    const items = Array.from(textLayer.current.querySelectorAll<HTMLElement>("span[role='presentation']"));
    sentenceRanges.current = sentenceItemRanges(items.map(item => item.textContent || ""), sentencePairs.map(pair => pair.source));
    items.forEach((item, itemIndex) => {
      const value = item.textContent || "";
      const colors: (PdfMark["color"] | null)[] = Array(value.length).fill(null);
      const active = activeSentenceIndex === null ? null : sentenceRanges.current[activeSentenceIndex];
      const linkedAt = (position: number) => !!active && itemIndex >= active.startItem && itemIndex <= active.endItem && position >= (itemIndex === active.startItem ? active.startOffset : 0) && position < (itemIndex === active.endItem ? active.endOffset : value.length);
      for (const mark of marks) {
        if (itemIndex < mark.startItem || itemIndex > mark.endItem) continue;
        const start = itemIndex === mark.startItem ? mark.startOffset : 0;
        const end = itemIndex === mark.endItem ? mark.endOffset : value.length;
        for (let position = Math.max(0, start); position < Math.min(value.length, end); position++) colors[position] = mark.color;
      }
      const fragment = document.createDocumentFragment();
      for (let start = 0; start < value.length;) {
        const color = colors[start];
        const linked = linkedAt(start);
        let end = start + 1;
        while (end < value.length && colors[end] === color && linkedAt(end) === linked) end++;
        if (color || linked) {
          const highlighted = document.createElement("span");
          highlighted.className = `${color ? `pdf-inline-mark pdf-inline-mark-${color}` : ""}${linked ? " pdf-linked-sentence" : ""}`.trim();
          highlighted.textContent = value.slice(start, end);
          fragment.append(highlighted);
        } else fragment.append(document.createTextNode(value.slice(start, end)));
        start = end;
      }
      item.replaceChildren(fragment);
    });
  }, [marks, rendered, sentencePairs, activeSentenceIndex, selection]);

  function inspectSelection(event?: { clientX: number; clientY: number }) {
    const layer = textLayer.current;
    const current = window.getSelection();
    if (!layer) return;
    const items = Array.from(layer.querySelectorAll<HTMLElement>("span[role='presentation']"));
    const point = (node: Node, offset: number) => {
      const item = items.findIndex(candidate => candidate === node || candidate.contains(node));
      if (item < 0) return null;
      const before = document.createRange();
      before.selectNodeContents(items[item]);
      before.setEnd(node, offset);
      return { item, offset: before.toString().length };
    };
    const range = current?.rangeCount ? current.getRangeAt(0) : null;
    const selected = !!range && !current?.isCollapsed && layer.contains(range.startContainer) && layer.contains(range.endContainer);
    const caret = selected ? range : event ? document.caretRangeFromPoint(event.clientX, event.clientY) : null;
    const at = caret && layer.contains(caret.startContainer) ? point(caret.startContainer, caret.startOffset) : null;
    if (at) {
      const sentence = sentenceRanges.current.findIndex(candidate => candidate && (at.item > candidate.startItem || at.item === candidate.startItem && at.offset >= candidate.startOffset) && (at.item < candidate.endItem || at.item === candidate.endItem && at.offset <= candidate.endOffset));
      if (sentence >= 0) onSentenceSelect(sentence);
    }
    if (!selected || !range) { setSelection(null); selectedRange.current = null; return; }
    const text = current?.toString().trim() || "";
    if (!text) { setSelection(null); return; }
    const rect = range.getBoundingClientRect();
    selectedRange.current = range.cloneRange();
    setTranslation("");
    setSelection({ text, top: Math.max(12, rect.top - 48), left: Math.max(12, Math.min(window.innerWidth - 330, rect.left + rect.width / 2 - 150)) });
  }

  function markSelection(color: PdfMark["color"]) {
    const range = selectedRange.current;
    const layer = textLayer.current;
    if (!range || !layer) return;
    const items = Array.from(layer.querySelectorAll<HTMLElement>("span[role='presentation']"));
    const itemFor = (node: Node) => items.findIndex(item => item === node || item.contains(node));
    const startItem = itemFor(range.startContainer);
    const endItem = itemFor(range.endContainer);
    if (startItem >= 0 && endItem >= 0) {
      const offsetWithin = (item: HTMLElement, node: Node, offset: number) => {
        const before = document.createRange();
        before.selectNodeContents(item);
        before.setEnd(node, offset);
        return before.toString().length;
      };
      onMark({
        startItem,
        startOffset: offsetWithin(items[startItem], range.startContainer, range.startOffset),
        endItem,
        endOffset: offsetWithin(items[endItem], range.endContainer, range.endOffset),
        color,
      });
    }
    window.getSelection()?.removeAllRanges();
    selectedRange.current = null;
    setSelection(null);
  }

  async function translateSelection() {
    if (!selection || translating) return;
    if (selection.text.length > 8000) { setTranslation("选中内容超过 8000 字，请缩小选择范围。"); return; }
    setTranslating(true);
    try { setTranslation(await onTranslateSelection(selection.text)); }
    catch (cause) { setTranslation(cause instanceof Error ? cause.message : "选中内容翻译失败"); }
    finally { setTranslating(false); }
  }

  return <div ref={host} className="pdf-surface" onMouseUp={inspectSelection} onKeyUp={() => inspectSelection()}>
    {error ? <p className="state-message">{error}</p> : <div className="pdf-page" style={{ width: size.width || "100%", height: size.height || 360 }}>
      <canvas ref={canvas} aria-label={`PDF 第 ${index + 1} 页`} />
      <div ref={textLayer} className="pdf-text-layer" aria-label={`PDF 第 ${index + 1} 页可选文字`} />
    </div>}
    {selection && <div className="pdf-selection-tools" style={{ top: selection.top, left: selection.left }} onMouseDown={event => event.preventDefault()}>
      <div className="pdf-selection-actions"><button disabled={translating} onClick={translateSelection}>{translating ? "翻译中…" : "翻译选中"}</button><span>标色</span>
        {(["yellow", "green", "pink"] as const).map(color => <button key={color} className={`pdf-color pdf-color-${color}`} aria-label={`标记${color === "yellow" ? "黄色" : color === "green" ? "绿色" : "粉色"}`} onClick={() => markSelection(color)} />)}
        <button aria-label="关闭选中工具" onClick={() => { setSelection(null); setTranslation(""); }}>×</button>
      </div>
      {translation && <p className="pdf-selection-translation">{translation}</p>}
    </div>}
  </div>;
}

export default memo(PdfPage, (previous, next) => previous.data === next.data
  && previous.index === next.index
  && previous.zoom === next.zoom
  && previous.marks === next.marks
  && previous.sentencePairs === next.sentencePairs
  && previous.activeSentenceIndex === next.activeSentenceIndex
  && previous.onTranslateSelection === next.onTranslateSelection);
