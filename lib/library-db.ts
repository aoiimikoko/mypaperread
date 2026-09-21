import type { SentencePair } from "./sentences";

export type SavedPage = { heading: string; text: string; translation: string; sentencePairs?: SentencePair[] };
export type SavedMark = { startItem: number; startOffset: number; endItem: number; endOffset: number; color: "yellow" | "green" | "pink" };
export type SavedPaper = {
  id: string;
  title: string;
  type: "pdf" | "web";
  pages: SavedPage[];
  marks: Record<number, SavedMark[]>;
  page: number;
  createdAt: number;
  updatedAt: number;
  sourceUrl?: string;
};
export type PaperSummary = Pick<SavedPaper, "id" | "title" | "type" | "createdAt" | "updatedAt" | "sourceUrl"> & { pageCount: number };

const databaseName = "mypaperread-library";
const databaseVersion = 1;
let pendingWrite: Promise<void> = Promise.resolve();

function inWriteOrder(action: () => Promise<void>): Promise<void> {
  const result = pendingWrite.then(action);
  pendingWrite = result.catch(() => {});
  return result;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("papers")) database.createObjectStore("papers", { keyPath: "id" });
      if (!database.objectStoreNames.contains("files")) database.createObjectStore("files", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地文献库"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("本地文献库操作失败"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("保存文献失败"));
    transaction.onabort = () => reject(transaction.error || new Error("保存文献已取消"));
  });
}

export async function listPapers(): Promise<PaperSummary[]> {
  await pendingWrite;
  const database = await openDatabase();
  try {
    const papers = await requestResult(database.transaction("papers", "readonly").objectStore("papers").getAll()) as SavedPaper[];
    return papers.sort((a, b) => b.updatedAt - a.updatedAt).map(paper => ({
      id: paper.id, title: paper.title, type: paper.type, createdAt: paper.createdAt,
      updatedAt: paper.updatedAt, sourceUrl: paper.sourceUrl, pageCount: paper.pages.length,
    }));
  } finally { database.close(); }
}

export async function loadPaper(id: string): Promise<{ paper: SavedPaper; pdf?: Uint8Array } | null> {
  await pendingWrite;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["papers", "files"], "readonly");
    const paperRequest = requestResult(transaction.objectStore("papers").get(id)) as Promise<SavedPaper | undefined>;
    const fileRequest = requestResult(transaction.objectStore("files").get(id)) as Promise<{ id: string; bytes: ArrayBuffer } | undefined>;
    const [paper, file] = await Promise.all([paperRequest, fileRequest]);
    if (!paper) return null;
    if (paper.type === "pdf" && !file) throw new Error("这篇文献的 PDF 文件丢失，请重新导入");
    return { paper, pdf: file ? new Uint8Array(file.bytes) : undefined };
  } finally { database.close(); }
}

export function savePaper(paper: SavedPaper, pdf?: Uint8Array): Promise<void> {
  return inWriteOrder(() => writePaper(paper, pdf));
}

async function writePaper(paper: SavedPaper, pdf?: Uint8Array): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["papers", "files"], "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore("papers").put(paper);
    if (pdf) transaction.objectStore("files").put({ id: paper.id, bytes: pdf.slice().buffer });
    await done;
  } finally { database.close(); }
}

export function deletePaper(id: string): Promise<void> {
  return inWriteOrder(() => removePaper(id));
}

async function removePaper(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["papers", "files"], "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore("papers").delete(id);
    transaction.objectStore("files").delete(id);
    await done;
  } finally { database.close(); }
}
