"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Columns2, Download, FilePlus2, FileText, Languages, Link2, Search, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { providerById, providers, type ProviderId } from "@/lib/model-providers";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import PdfPage, { type PdfMark } from "./pdf-page";
import { deletePaper, listPapers, loadPaper, savePaper, type PaperSummary, type SavedPaper } from "@/lib/library-db";
import { bodySegments } from "@/lib/paper-body";
import { splitSentences, type SentencePair } from "@/lib/sentences";

type Page = { heading: string; text: string; translation: string; sentencePairs?: SentencePair[] };
type DocumentData = { id?: string; title: string; type: "sample" | "pdf" | "web"; pages: Page[]; pdf?: Uint8Array; createdAt?: number; sourceUrl?: string };
const sample: DocumentData = { title: "Parallel Reading for Research", type: "sample", pages: [
  { heading: "Abstract", text: "Reading scientific literature across languages remains a demanding task. Readers must move between source documents and translated text while preserving the structure, terminology, and context of the original work. A parallel reading environment can reduce this friction by aligning each translated passage with its source.", translation: "跨语言阅读科学文献仍是一项艰巨的任务。读者需要在原始文档与译文之间切换，同时保留原作的结构、术语和上下文。对照阅读环境将每段译文与原文对应，可减少这种阅读阻力。" },
  { heading: "1. Introduction", text: "Research is increasingly collaborative and international. Yet language continues to shape which findings are discovered, discussed, and reused. Existing translation workflows often separate the translated output from the document itself, making it difficult to inspect figures, citations, and nuanced claims in context.", translation: "研究日益依赖跨国协作，但语言仍影响哪些成果能够被发现、讨论和复用。现有翻译流程常将译文与文档本身分离，使读者难以结合图表、引文及上下文核查细微论断。" },
  { heading: "2. A parallel reading workflow", text: "The reading surface should retain a stable relationship between the source and its translation. Page navigation, text search, and synchronized scrolling help readers locate a passage quickly. Translation remains an aid to interpretation; the original document stays visible for verification.", translation: "阅读界面应维持原文与译文之间稳定的对应关系。页码导航、文本搜索和同步滚动帮助读者快速定位段落。译文用于辅助理解，原始文档始终可见，便于核对。" },
] };
const settingsStorageKey = "mypaperread-reader-settings-v1";

type ReaderSettings = {
  apiKey?: string;
  provider?: ProviderId;
  baseUrl?: string;
  model?: string;
  target?: string;
  zoom?: number;
  mode?: "parallel" | "triple" | "original" | "translation";
  direction?: "paged" | "continuous";
  rememberApiKey?: boolean;
};

function readStoredSettings(): ReaderSettings {
  if (typeof window === "undefined") return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(settingsStorageKey) || "{}") as unknown;
    return saved && typeof saved === "object" ? saved as ReaderSettings : {};
  } catch {
    window.localStorage.removeItem(settingsStorageKey);
    return {};
  }
}

function TranslatedContent({ item, pageIndex, activeSentence, onSentenceSelect, zoom, showHint }: {
  item: Page; pageIndex: number; activeSentence: { page: number; index: number } | null;
  onSentenceSelect: (page: number, index: number) => void; zoom: number; showHint: boolean;
}) {
  return <><p style={{ fontSize: `${16 * zoom}px` }}>{item.sentencePairs?.length
    ? item.sentencePairs.map((pair, index) => <span key={index} className={`linked-sentence${activeSentence?.page === pageIndex && activeSentence.index === index ? " linked-sentence-active" : ""}`} onClick={() => onSentenceSelect(pageIndex, index)}>{pair.translation}{" "}</span>)
    : item.translation}</p>{showHint && item.translation && !item.sentencePairs?.length && <small className="alignment-hint">重新翻译此页可启用逐句对照。</small>}</>;
}

function ContinuousReader({ doc, mode, zoom, target, marks, activeSentence, onSentenceSelect, onPageVisible, onTranslate, onMark, onTranslateSelection }: {
  doc: DocumentData; mode: "parallel" | "triple" | "original" | "translation"; zoom: number; target: string;
  marks: Record<number, PdfMark[]>;
  activeSentence: { page: number; index: number } | null;
  onSentenceSelect: (page: number, index: number) => void;
  onPageVisible: (index: number) => void; onTranslate: (index: number) => void;
  onMark: (index: number, mark: PdfMark) => void;
  onTranslateSelection: (text: string) => Promise<string>;
}) {
  useEffect(() => {
    const rows = Array.from(window.document.querySelectorAll<HTMLElement>("[data-reading-page]"));
    const observer = new IntersectionObserver(entries => {
      const first = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (first) onPageVisible(Number((first.target as HTMLElement).dataset.readingPage));
    }, { rootMargin: "-10% 0px -60% 0px", threshold: [0, .25, .5] });
    rows.forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [doc.pages.length, onPageVisible]);
  return <div className="continuous-reader">{doc.pages.map((item, index) => <section className="continuous-row" data-reading-page={index} key={index}>
    <div className="continuous-row-title"><span>{doc.type === "pdf" ? "第" : "段落"} {index + 1} {doc.type === "pdf" ? "页" : ""}</span><span>{index + 1} / {doc.pages.length}</span></div>
    <div className={`reader-grid mode-${mode}${doc.pdf ? " pdf-grid" : ""}`}>
      {mode !== "translation" && <section className="reading-pane"><div className="pane-head"><div><span className="pane-badge original-badge">ORIGINAL</span><strong>原文</strong></div><span>{doc.type === "pdf" ? "PDF 页面" : "源文本"}</span></div><div className={`paper${doc.pdf ? " pdf-paper" : ""}`}>{doc.pdf ? <PdfPage data={doc.pdf} index={index} zoom={zoom} marks={marks[index] || []} sentencePairs={item.sentencePairs || []} activeSentenceIndex={activeSentence?.page === index ? activeSentence.index : null} onSentenceSelect={sentence => onSentenceSelect(index, sentence)} onMark={mark => onMark(index, mark)} onTranslateSelection={onTranslateSelection}/> : <><div className="paper-top"><span>SOURCE DOCUMENT</span><span>{index + 1} / {doc.pages.length}</span></div><h3>{item.heading}</h3><p style={{fontSize: `${16 * zoom}px`}}>{item.text}</p></>}</div></section>}
      {mode === "triple" && <section className="reading-pane"><div className="pane-head"><div><span className="pane-badge text-badge">EXTRACTED TEXT</span><strong>提取文字</strong></div></div><div className="paper extracted-paper"><h3>{item.heading}</h3><p style={{fontSize: `${16 * zoom}px`}}>{item.text}</p></div></section>}
      {mode !== "original" && <section className="reading-pane"><div className="pane-head"><div><span className="pane-badge translation-badge">TRANSLATION</span><strong>译文</strong></div><span>{target}</span></div><div className="paper translated-paper"><div className="paper-top"><span>对照译文</span><span>{index + 1} / {doc.pages.length}</span></div><h3>{item.heading}</h3>{item.translation ? <TranslatedContent item={item} pageIndex={index} activeSentence={activeSentence} onSentenceSelect={onSentenceSelect} zoom={zoom} showHint={doc.type === "pdf"}/> : <div className="empty-translation"><Sparkles size={23}/><strong>这一页尚未翻译</strong><button className="quiet-button" onClick={() => onTranslate(index)}>翻译这一页</button></div>}</div></section>}
    </div>
  </section>)}</div>;
}

export default function Home() {
  const [doc, setDoc] = useState<DocumentData>(sample);
  const [marks, setMarks] = useState<Record<number, PdfMark[]>>({});
  const [library, setLibrary] = useState<PaperSummary[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const deletingPaperIds = useRef(new Set<string>());
  const pendingSave = useRef<SavedPaper | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translationCache = useRef(new Map<string, string | string[]>());
  const [savedSettings] = useState<ReaderSettings>(readStoredSettings);
  const [page, setPage] = useState(0);
  const [activeSentence, setActiveSentence] = useState<{ page: number; index: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState(savedSettings.rememberApiKey !== false ? savedSettings.apiKey || "" : "");
  const [provider, setProvider] = useState<ProviderId>(savedSettings.provider && providerById(savedSettings.provider) ? savedSettings.provider : "openai");
  const [baseUrl, setBaseUrl] = useState(savedSettings.baseUrl || "https://api.openai.com/v1");
  const [model, setModel] = useState(savedSettings.model || "gpt-4o-mini");
  const [target, setTarget] = useState(savedSettings.target || "简体中文");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState("");
  const [zoom, setZoom] = useState(typeof savedSettings.zoom === "number" && savedSettings.zoom >= .6 && savedSettings.zoom <= 1.8 ? savedSettings.zoom : 1);
  const [mode, setMode] = useState<"parallel" | "triple" | "original" | "translation">(savedSettings.mode || "parallel");
  const [direction, setDirection] = useState<"paged" | "continuous">(savedSettings.direction || "paged");
  const fileInput = useRef<HTMLInputElement>(null);
  const [rememberApiKey, setRememberApiKey] = useState(savedSettings.rememberApiKey !== false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const papers = await listPapers();
        if (cancelled) return;
        setLibrary(papers);
        const preferred = window.localStorage.getItem("mypaperread-active-paper");
        const id = papers.find(item => item.id === preferred)?.id || papers[0]?.id;
        if (id) {
          const saved = await loadPaper(id);
          if (saved && !cancelled) {
            setDoc({ ...saved.paper, pdf: saved.pdf });
            setMarks(saved.paper.marks || {});
            setPage(Math.min(saved.paper.page || 0, saved.paper.pages.length - 1));
            window.localStorage.setItem("mypaperread-active-paper", id);
          }
        }
      } catch (cause) {
        if (!cancelled) setNotice(cause instanceof Error ? cause.message : "本地文献库无法读取");
      } finally { if (!cancelled) setLibraryReady(true); }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!libraryReady || !doc.id || doc.type === "sample" || deletingPaperIds.current.has(doc.id)) return;
    const now = Date.now();
    const next: SavedPaper = { id: doc.id, title: doc.title, type: doc.type, pages: doc.pages, marks, page, createdAt: doc.createdAt || now, updatedAt: now, sourceUrl: doc.sourceUrl };
    if (pendingSave.current && pendingSave.current.id !== next.id) void savePaper(pendingSave.current).catch(() => {});
    pendingSave.current = next;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const paper = pendingSave.current;
      pendingSave.current = null;
      if (paper) void savePaper(paper).catch(cause => setNotice(cause instanceof Error ? cause.message : "阅读记录保存失败"));
    }, 700);
  }, [doc, marks, page, libraryReady]);
  useEffect(() => () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    if (pendingSave.current) void savePaper(pendingSave.current);
  }, []);
  useEffect(() => {
    const saved: ReaderSettings = { provider, baseUrl, model, target, zoom, mode, direction, rememberApiKey };
    if (rememberApiKey) saved.apiKey = apiKey;
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(saved));
  }, [apiKey, baseUrl, direction, mode, model, provider, rememberApiKey, target, zoom]);
  useEffect(() => {
    type Tool = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (window.document as Document & { modelContext?: Tool }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "navigate_document_page", title: "跳转到文献页面",
        description: "在当前文献中跳转至指定页或段落，并同步更新对照阅读区域。",
        inputSchema: { type: "object", properties: { page: { type: "integer", minimum: 1, maximum: doc.pages.length } }, required: ["page"], additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute(input) {
          const value = (input as { page?: number })?.page;
          if (!Number.isInteger(value) || !value || value < 1 || value > doc.pages.length) throw new Error("页码超出范围");
          setPage(value - 1);
          if (direction === "continuous") window.document.querySelector(`[data-reading-page="${value - 1}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          return { title: doc.title, page: value, total: doc.pages.length };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [doc.title, doc.pages.length, direction]);
  useEffect(() => {
    if (direction !== "continuous") return;
    const id = requestAnimationFrame(() => window.document.querySelector(`[data-reading-page="${page}"]`)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(id);
  }, [direction]);
  useEffect(() => {
    const clear = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && (target.classList.contains("pdf-text-layer") || !target.closest(".pdf-text-layer, .linked-sentence, .pdf-selection-tools"))) setActiveSentence(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveSentence(null); };
    document.addEventListener("pointerdown", clear);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", clear); document.removeEventListener("keydown", escape); };
  }, []);

  async function readPdf(bytes: Uint8Array, name: string, sourceUrl?: string) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const pages: Page[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      setProgress(`正在读取 PDF：${i} / ${pdf.numPages} 页`);
      const sourcePage = await pdf.getPage(i);
      const height = sourcePage.getViewport({ scale: 1 }).height;
      const content = await sourcePage.getTextContent();
      const text = content.items.map(item => {
        if (!("str" in item)) return "";
        const y = item.transform[5];
        if (y >= 0 && y <= height && (y < height * .04 || y > height * .965)) return "";
        return `${item.str}${item.hasEOL ? "\n" : " "}`;
      }).join("").replace(/[^\S\n]+/g, " ").trim();
      pages.push({ heading: `第 ${i} 页`, text, translation: "" });
    }
    if (!pages.some(p => p.text)) throw new Error("PDF 未提取到文字。扫描版 PDF 暂不支持文字翻译。");
    const now = Date.now();
    const record: SavedPaper = { id: crypto.randomUUID(), title: name.replace(/\.pdf$/i, ""), type: "pdf", pages, marks: {}, page: 0, createdAt: now, updatedAt: now, sourceUrl };
    await savePaper(record, bytes);
    setDoc({ ...record, pdf: bytes });
    setActiveSentence(null);
    setMarks({});
    setLibrary(await listPapers());
    window.localStorage.setItem("mypaperread-active-paper", record.id);
    setPage(0); setImportOpen(false); setNotice(`已导入 ${pdf.numPages} 页 PDF`);
  }
  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { setNotice("请选择 PDF 文件"); return; }
    if (file.size > 30 * 1024 * 1024) { setNotice("PDF 请小于 30 MB"); return; }
    setBusy(true);
    try { await readPdf(new Uint8Array(await file.arrayBuffer()), file.name); }
    catch (error) { setNotice(error instanceof Error ? error.message : "PDF 导入失败"); }
    finally { setBusy(false); setProgress(""); e.target.value = ""; }
  }
  async function importUrl() {
    setBusy(true); setProgress("正在读取链接…");
    try {
      const res = await fetch("/api/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const result = await res.json() as { kind?: string; title?: string; text?: string; data?: string; error?: string };
      if (!res.ok) throw new Error(result.error || "链接导入失败");
      if (result.kind === "pdf" && result.data) {
        const bytes = Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
        await readPdf(bytes, result.title || "远程 PDF", url);
      } else if (result.text) {
        const chunks = result.text.match(/[\s\S]{1,3500}/g) || [];
        const now = Date.now();
        const record: SavedPaper = { id: crypto.randomUUID(), title: result.title || new URL(url).hostname, type: "web", pages: chunks.map((text, i) => ({ heading: `第 ${i + 1} 部分`, text, translation: "" })), marks: {}, page: 0, createdAt: now, updatedAt: now, sourceUrl: url };
        await savePaper(record);
        setDoc(record);
        setActiveSentence(null);
        setMarks({});
        setLibrary(await listPapers());
        window.localStorage.setItem("mypaperread-active-paper", record.id);
        setPage(0); setImportOpen(false); setNotice("链接导入成功");
      } else throw new Error("未找到可阅读的正文");
    } catch (error) { setNotice(error instanceof Error ? error.message : "链接导入失败"); }
    finally { setBusy(false); setProgress(""); }
  }
  function goTo(index: number) {
    setActiveSentence(null);
    setPage(index);
    if (direction === "continuous") window.document.querySelector(`[data-reading-page="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function openSavedPaper(id: string) {
    try {
      const saved = await loadPaper(id);
      if (!saved) throw new Error("未找到这篇文献");
      setDoc({ ...saved.paper, pdf: saved.pdf });
      setActiveSentence(null);
      setMarks(saved.paper.marks || {});
      setPage(Math.min(saved.paper.page || 0, saved.paper.pages.length - 1));
      setLibraryOpen(false);
      window.localStorage.setItem("mypaperread-active-paper", id);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "打开文献失败"); }
  }
  async function removeSavedPaper(id: string) {
    const paper = library.find(item => item.id === id);
    if (!paper || !window.confirm(`删除“${paper.title}”？本机保存的 PDF、译文和标注都会被删除。`)) return;
    deletingPaperIds.current.add(id);
    try {
      if (pendingSave.current?.id === id) pendingSave.current = null;
      await deletePaper(id);
      const remaining = await listPapers();
      setLibrary(remaining);
      if (doc.id === id) {
        window.localStorage.removeItem("mypaperread-active-paper");
        if (remaining.length) await openSavedPaper(remaining[0].id);
        else { setDoc(sample); setMarks({}); setPage(0); }
      }
      setNotice("文献已从本机删除");
    } catch (cause) { deletingPaperIds.current.delete(id); setNotice(cause instanceof Error ? cause.message : "删除文献失败"); }
  }
  function markPdf(index: number, mark: PdfMark) {
    setMarks(current => ({ ...current, [index]: [...(current[index] || []), mark] }));
    setNotice("已标记选中内容");
  }
  const translateSelection = useCallback(async (text: string): Promise<string> => {
    if (!apiKey.trim() || !model.trim()) {
      setSettingsOpen(true);
      throw new Error("请先在设置中填写模型 API Key 和模型 ID");
    }
    const cacheKey = `single\u0000${provider}\u0000${model}\u0000${target}\u0000${text}`;
    const cached = translationCache.current.get(cacheKey);
    if (typeof cached === "string") return cached;
    const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, key: apiKey, model, target, provider, baseUrl }) });
    const result = await response.json() as { translation?: string; error?: string };
    if (!response.ok || !result.translation) throw new Error(result.error || "选中内容翻译失败");
    translationCache.current.set(cacheKey, result.translation);
    return result.translation;
  }, [apiKey, baseUrl, model, provider, target]);
  async function translateAligned(sentences: string[]): Promise<string[]> {
    const cacheKey = `aligned\u0000${provider}\u0000${model}\u0000${target}\u0000${sentences.join("\u0001")}`;
    const cached = translationCache.current.get(cacheKey);
    if (Array.isArray(cached)) return cached;
    const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sentences, key: apiKey, model, target, provider, baseUrl }) });
    const result = await response.json() as { translations?: string[]; error?: string };
    if (!response.ok || result.translations?.length !== sentences.length) throw new Error(result.error || "逐句翻译失败");
    translationCache.current.set(cacheKey, result.translations);
    return result.translations;
  }
  async function translate(all: boolean, atIndex = page) {
    if (!apiKey.trim() || !model.trim()) { setSettingsOpen(true); setNotice("请先填写模型 API Key 和模型 ID"); return; }
    const sources = doc.type === "pdf" ? bodySegments(doc.pages) : doc.pages.map(item => item.text);
    const indexes = all ? sources.flatMap((text, i) => text.trim() ? [i] : []) : sources[atIndex]?.trim() ? [atIndex] : [];
    if (!indexes.length) { setNotice("未识别到摘要至结论的正文。可在 PDF 上选中文字单独翻译。"); return; }
    setBusy(true);
    try {
      if (doc.type === "pdf") {
        let next = 0;
        let completed = 0;
        let stopped = false;
        const translatePage = async (index: number) => {
          const sentences = splitSentences(sources[index]);
          const pairs: SentencePair[] = [];
          for (let offset = 0; offset < sentences.length;) {
            const batch: string[] = [];
            let length = 0;
            while (offset < sentences.length && batch.length < 20 && (length + sentences[offset].length <= 6500 || !batch.length)) {
              batch.push(sentences[offset++]);
              length += batch[batch.length - 1].length;
            }
            const translated = await translateAligned(batch);
            batch.forEach((source, position) => pairs.push({ source, translation: translated[position] }));
          }
          setDoc(current => current.id === doc.id ? ({ ...current, pages: current.pages.map((item, i) => i === index ? { ...item, translation: pairs.map(pair => pair.translation).join(" "), sentencePairs: pairs } : item) }) : current);
          completed++;
          setProgress(`已翻译 ${completed} / ${indexes.length} 页`);
        };
        const worker = async () => {
          while (!stopped && next < indexes.length) {
            const index = indexes[next++];
            try { await translatePage(index); }
            catch (cause) { stopped = true; throw cause; }
          }
        };
        const results = await Promise.allSettled(Array.from({ length: Math.min(2, indexes.length) }, () => worker()));
        const failed = results.find(result => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
        setNotice(all ? "正文翻译完成" : "当前页翻译完成");
        return;
      }
      for (let step = 0; step < indexes.length; step++) {
        const index = indexes[step];
        setProgress(`正在翻译 ${step + 1} / ${indexes.length}`);
        const chunks = sources[index].match(/[\s\S]{1,8000}/g) || [];
        const translated: string[] = [];
        for (const chunk of chunks) {
          const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: chunk, key: apiKey, model, target, provider, baseUrl }) });
          const result = await response.json() as { translation?: string; error?: string };
          if (!response.ok || !result.translation) throw new Error(result.error || "翻译失败");
          translated.push(result.translation);
        }
        setDoc(current => ({ ...current, pages: current.pages.map((p, i) => i === index ? { ...p, translation: translated.join("\n\n") } : p) }));
      }
      setNotice(all ? "全文翻译完成" : "当前页翻译完成");
    } catch (error) { setNotice(error instanceof Error ? error.message : "翻译失败"); }
    finally { setBusy(false); setProgress(""); }
  }
  async function testConnection() {
    if (!apiKey.trim() || !model.trim() || (["openai", "azure"].includes(providerById(provider)?.protocol || "") && !baseUrl.trim())) {
      setNotice("请先填写接口地址、API Key 和模型 ID"); return;
    }
    setTesting(true);
    try {
      const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Research improves understanding.", key: apiKey, model, target, provider, baseUrl }) });
      const result = await response.json() as { translation?: string; error?: string };
      if (!response.ok || !result.translation) throw new Error(result.error || "连接测试失败");
      setNotice("连接成功，模型已返回译文");
    } catch (error) { setNotice(error instanceof Error ? error.message : "连接测试失败"); }
    finally { setTesting(false); }
  }
  function download() {
    const content = `# ${doc.title}\n\n` + doc.pages.map((p, i) => `## ${p.heading || `第 ${i + 1} 页`}\n\n### 原文\n${p.text}\n\n### 译文\n${p.translation || "（尚未翻译）"}`).join("\n\n");
    const a = window.document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" })); a.download = `${doc.title}.md`; a.click(); URL.revokeObjectURL(a.href);
  }
  const current = doc.pages[page];
  const matches = query.trim() ? doc.pages.flatMap((p, i) => (p.text + p.translation).toLowerCase().includes(query.toLowerCase()) ? [i] : []) : [];

  return <div className="app-shell">
    <aside className="rail"><div className="brand-mark"><BookOpen size={21}/></div><button className="rail-button active" aria-label="阅读台"><Columns2 size={21}/></button><button className="rail-button" aria-label="导入文献" onClick={() => setImportOpen(true)}><FilePlus2 size={21}/></button><button className="rail-button" aria-label="翻译设置" onClick={() => setSettingsOpen(true)}><Settings2 size={21}/></button><div className="rail-bottom">M</div></aside>
    <aside className="library"><div className="library-title"><span className="eyebrow">mypaperread</span><h1>我的文献</h1></div><button className="import-button" onClick={() => setImportOpen(true)}><FilePlus2 size={18}/> 导入文献 <span>+</span></button><div className="library-section">已保存文献 <span>{library.length}</span></div><div className="library-list">{library.length ? library.map(item => <div className="library-entry" key={item.id}><button className={`library-item${doc.id === item.id ? " current" : ""}`} onClick={() => openSavedPaper(item.id)}><span className="document-icon"><FileText size={19}/></span><span><strong>{item.title}</strong><small>{item.type === "pdf" ? "PDF 文献" : "网页文献"} · {item.pageCount} {item.type === "pdf" ? "页" : "段"}</small></span></button><button className="library-delete" aria-label={`删除 ${item.title}`} title="删除文献" onClick={() => removeSavedPaper(item.id)}><Trash2 size={15}/></button></div>) : <p className="library-empty">导入的文献会保存在此浏览器中。</p>}</div><div className="library-hint"><Sparkles size={17}/><p>导入 PDF 或网页链接，开始原文与译文对照阅读。</p></div><div className="library-footer"><span className="footer-dot"/> mypaperread 阅读工作台</div></aside>
    <main className={`main-area direction-${direction}`}><header className="topbar"><div className="breadcrumbs">mypaperread <ChevronRight size={15}/> <strong>{doc.title}</strong></div><div className="top-actions"><button className="soft-button library-toggle" onClick={() => setLibraryOpen(true)}><BookOpen size={16}/> 文献库</button><button className="soft-button" onClick={() => setImportOpen(true)}><FilePlus2 size={16}/> 导入</button><button className="icon-button" aria-label="设置" onClick={() => setSettingsOpen(true)}><Settings2 size={18}/></button></div></header>
      <section className="document-header"><div className="doc-kicker"><span className="file-chip">{doc.type === "sample" ? "示例文献" : doc.type === "pdf" ? "PDF" : "网页"}</span><span>双语对照阅读</span></div><div className="title-row"><div><h2>{doc.title}</h2><p>{doc.pages.length} {doc.type === "pdf" ? "页" : "段"} · 原文与译文对照</p></div><div className="title-actions"><button className="quiet-button" disabled={busy || doc.type === "sample"} onClick={() => translate(false)}><Languages size={17}/> 翻译当前页</button><button className="primary-button" disabled={busy || doc.type === "sample"} onClick={() => translate(true)}><Sparkles size={17}/> {doc.type === "pdf" ? "翻译正文" : "翻译全文"}</button></div></div></section>
      <div className="toolbar"><div className="toolbar-group"><button className="tool-icon" aria-label="上一页" disabled={page === 0} onClick={() => goTo(page - 1)}><ChevronLeft size={18}/></button><span className="page-count">{doc.type === "pdf" ? "页码" : "段落"} <strong>{page + 1}</strong> / {doc.pages.length}</span><button className="tool-icon" aria-label="下一页" disabled={page === doc.pages.length - 1} onClick={() => goTo(page + 1)}><ChevronRight size={18}/></button></div><div className="toolbar-spacer"/><label className="search-field"><Search size={17}/><input aria-label="搜索文献" placeholder="搜索当前文献" value={query} onChange={e => setQuery(e.target.value)}/></label>{query && <span className="match-count" onClick={() => matches.length && goTo(matches[0])}>{matches.length} 处匹配</span>}<select className="tool-select" aria-label="阅读方向" value={direction} onChange={e => setDirection(e.target.value as "paged" | "continuous")}><option value="paged">按页切换</option><option value="continuous">上下滚动</option></select><div className="toolbar-divider"/><select className="tool-select" aria-label="阅读布局" value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="parallel">双栏对照</option><option value="triple">三栏阅读</option><option value="original">仅原文</option><option value="translation">仅译文</option></select><button className="tool-icon" aria-label="缩小" onClick={() => setZoom(Math.max(.6, zoom - .15))}>−</button><span className="zoom-label">{Math.round(zoom * 100)}%</span><button className="tool-icon" aria-label="放大" onClick={() => setZoom(Math.min(1.8, zoom + .15))}>+</button><button className="tool-icon" aria-label="导出 Markdown" onClick={download}><Download size={18}/></button></div>
      <div className="reader-wrap"><div className={`reader-grid mode-${mode}${doc.pdf ? " pdf-grid" : ""}`}>{mode !== "translation" && <section className="reading-pane"><div className="pane-head"><div><span className="pane-badge original-badge">ORIGINAL</span><strong>原文</strong></div><span>{doc.type === "pdf" ? "PDF 页面" : "源文本"}</span></div><div className={`paper${doc.pdf ? " pdf-paper" : ""}`}>{doc.pdf ? <PdfPage data={doc.pdf} index={page} zoom={zoom} marks={marks[page] || []} sentencePairs={current.sentencePairs || []} activeSentenceIndex={activeSentence?.page === page ? activeSentence.index : null} onSentenceSelect={index => setActiveSentence({ page, index })} onMark={mark => markPdf(page, mark)} onTranslateSelection={translateSelection}/> : <><div className="paper-top"><span>{doc.type === "sample" ? "RESEARCH NOTE · SAMPLE" : "SOURCE DOCUMENT"}</span><span>{page + 1} / {doc.pages.length}</span></div><h3>{current.heading}</h3><p style={{fontSize: `${16 * zoom}px`}}>{current.text}</p><div className="paper-footer">MYPAPERREAD <span>— {page + 1} —</span></div></>}</div></section>}{mode === "triple" && <section className="reading-pane"><div className="pane-head"><div><span className="pane-badge text-badge">EXTRACTED TEXT</span><strong>提取文字</strong></div><span>可复制</span></div><div className="paper extracted-paper"><div className="paper-top"><span>源文本</span><span>{page + 1} / {doc.pages.length}</span></div><h3>{current.heading}</h3><p style={{fontSize: `${16 * zoom}px`}}>{current.text}</p></div></section>}{mode !== "original" && <section className="reading-pane"><div className="pane-head"><div><span className="pane-badge translation-badge">TRANSLATION</span><strong>译文</strong></div><span>{target}</span></div><div className="paper translated-paper"><div className="paper-top"><span>对照译文</span><span>{page + 1} / {doc.pages.length}</span></div><h3>{current.heading}</h3>{current.translation ? <TranslatedContent item={current} pageIndex={page} activeSentence={activeSentence} onSentenceSelect={(page, index) => setActiveSentence({ page, index })} zoom={zoom} showHint={doc.type === "pdf"}/> : <div className="empty-translation"><Sparkles size={23}/><strong>这一页尚未翻译</strong><span>{doc.type === "pdf" ? "一键仅翻译摘要至结论；也可选中原文单独翻译。" : "配置模型 API 后，可以翻译当前页或全文。"}</span><button className="quiet-button" onClick={() => translate(false)}>翻译当前页</button></div>}{doc.type === "sample" && <div className="translation-note"><Sparkles size={16}/> 示例译文。导入文献后可通过模型 API 生成全文翻译。</div>}</div></section>}</div><div className="reader-bottom"><span><span className="sync-symbol">↔</span> 原文与译文按页对应</span><div className="progress-track"><div style={{width: `${((page + 1) / doc.pages.length) * 100}%`}}/></div><span>{Math.round(((page + 1) / doc.pages.length) * 100)}% 已浏览</span></div></div>
      {direction === "continuous" && <ContinuousReader doc={doc} mode={mode} zoom={zoom} target={target} marks={marks} activeSentence={activeSentence} onSentenceSelect={(page, index) => setActiveSentence({ page, index })} onPageVisible={setPage} onTranslate={index => translate(false, index)} onMark={markPdf} onTranslateSelection={translateSelection}/>}
    </main>
    {notice && <div role="status" className="toast">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}><X size={15}/></button></div>}
    {progress && <div role="status" className="progress-toast">{progress}</div>}
    <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}><DialogContent className="modal-content library-dialog"><DialogHeader><DialogTitle>本地文献库</DialogTitle><DialogDescription>文献保存在当前浏览器中，刷新后可继续阅读。</DialogDescription></DialogHeader><div className="library-dialog-list">{library.length ? library.map(item => <div className="library-dialog-entry" key={item.id}><button onClick={() => openSavedPaper(item.id)}><FileText size={18}/><span><strong>{item.title}</strong><small>{item.type === "pdf" ? "PDF" : "网页"} · {item.pageCount} {item.type === "pdf" ? "页" : "段"}</small></span></button><button className="library-delete" aria-label={"删除 " + item.title} onClick={() => removeSavedPaper(item.id)}><Trash2 size={16}/></button></div>) : <p className="library-empty">还没有保存的文献。导入 PDF 或网页后会显示在这里。</p>}</div></DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="modal-content"><DialogHeader><DialogTitle>导入文献</DialogTitle><DialogDescription>选择 PDF 文件，或粘贴公开网页 / PDF 链接。</DialogDescription></DialogHeader><input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFile}/><button className="drop-zone" disabled={busy} onClick={() => fileInput.current?.click()}><FilePlus2 size={30}/><strong>点击选择 PDF 文件</strong><span>支持可复制文本的 PDF，建议小于 30 MB</span></button><div className="or-line">或使用链接</div><label className="url-field"><Link2 size={17}/><input aria-label="文献链接" placeholder="https://example.com/paper.pdf" value={url} onChange={e => setUrl(e.target.value)}/></label><button className="primary-button wide" disabled={busy || !url.trim()} onClick={importUrl}>导入链接</button></DialogContent></Dialog>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="modal-content">
        <DialogHeader><DialogTitle>模型 API 设置</DialogTitle><DialogDescription>选择平台，填写对应的密钥、接口地址和模型 ID。</DialogDescription></DialogHeader>
        <label className="field-label">API 平台
          <select value={provider} onChange={e => {
            const next = providerById(e.target.value)!;
            setProvider(next.id); setBaseUrl(next.baseUrl); setApiKey("");
            setModel(next.id === "openai" ? "gpt-4o-mini" : next.id === "deepseek" ? "deepseek-flash" : "");
          }}>{providers.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
        </label>
        {["openai", "azure"].includes(providerById(provider)?.protocol || "") && <label className="field-label">接口地址
          <input type="url" placeholder={provider === "azure" ? "https://资源名.openai.azure.com/openai/v1" : "https://api.example.com/v1"} value={baseUrl} onChange={e => setBaseUrl(e.target.value)}/>
        </label>}
        <label className="field-label">API Key
          <input type="password" autoComplete="off" placeholder="粘贴当前平台的密钥" value={apiKey} onChange={e => setApiKey(e.target.value)}/>
        </label>
        <label className="field-label">模型 ID
          <input value={model} placeholder={providerById(provider)?.modelHint} onChange={e => setModel(e.target.value)}/>
        </label>
        <label className="field-label">目标语言
          <select value={target} onChange={e => { setTarget(e.target.value); if (doc.type !== "sample") setDoc(current => ({ ...current, pages: current.pages.map(p => ({ ...p, translation: "" })) })); }}><option>简体中文</option><option>繁體中文</option><option>English</option><option>日本語</option></select>
        </label>
        <label className="remember-key"><input type="checkbox" checked={rememberApiKey} onChange={e => setRememberApiKey(e.target.checked)}/> 在此浏览器保存 API Key</label>
        <p className="settings-tip">开启后，API Key 会以明文保存在此浏览器的本地存储中，刷新页面后可继续使用。翻译时，原文将发送到所选平台；切换平台会清除当前输入的密钥。</p>
        <div className="settings-actions"><button className="quiet-button" disabled={testing} onClick={testConnection}>{testing ? "正在测试…" : "测试连接"}</button><button className="primary-button" onClick={() => setSettingsOpen(false)}>完成</button></div>
      </DialogContent>
    </Dialog>
  </div>;
}




