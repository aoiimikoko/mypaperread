"use client";
import { getPdf } from "./pdf-page";
import { sentenceItemRanges } from "@/lib/sentences";

/** The crop is recognition input only; the reading pane always displays LaTeX. */
export async function formulaRecognitionImage(data: Uint8Array, pageIndex: number, source: string): Promise<string> {
  const pdf = await getPdf(data);
  const page = await pdf.getPage(pageIndex + 1);
  const content = await page.getTextContent();
  const items = content.items.filter(item => "str" in item);
  const range = sentenceItemRanges(items.map(item => item.str), [source])[0];
  if (!range) throw new Error("无法定位公式原图，请对照原文核查");
  const viewport = page.getViewport({ scale: 2 });
  const boxes = items.slice(range.startItem, range.endItem + 1).filter(item => item.str.trim()).map(item => {
    const x = item.transform[4], y = item.transform[5];
    const height = Math.max(item.height, Math.hypot(item.transform[2], item.transform[3]), 5);
    const box = viewport.convertToViewportRectangle([x, y - height * .3, x + item.width, y + height]);
    return [Math.min(box[0], box[2]), Math.min(box[1], box[3]), Math.max(box[0], box[2]), Math.max(box[1], box[3])];
  });
  if (!boxes.length) throw new Error("公式没有可定位的文字区域");
  const left = Math.max(0, Math.min(...boxes.map(box => box[0])) - 16);
  const top = Math.max(0, Math.min(...boxes.map(box => box[1])) - 16);
  const right = Math.min(viewport.width, Math.max(...boxes.map(box => box[2])) + 16);
  const bottom = Math.min(viewport.height, Math.max(...boxes.map(box => box[3])) + 16);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(right - left);
  canvas.height = Math.ceil(bottom - top);
  try {
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport, transform: [1, 0, 0, 1, -left, -top] }).promise;
    return canvas.toDataURL("image/png");
  } finally { canvas.width = 1; canvas.height = 1; }
}
