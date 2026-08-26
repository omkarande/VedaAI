import type { PageImage } from "../types";

const MAX_EDGE = 1600;

type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsLoader: Promise<Pdfjs> | null = null;

async function loadPdfjs() {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering only runs in the browser");
  }
  if (!pdfjsLoader) {
    pdfjsLoader = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsLoader;
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function renderImageFile(file: File): Promise<PageImage[]> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return [
    {
      page: 1,
      dataUrl: canvasToJpeg(canvas),
      width: canvas.width,
      height: canvas.height,
    },
  ];
}

async function renderPdfFile(
  file: File,
  onPage?: (done: number, total: number) => void,
): Promise<PageImage[]> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: PageImage[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_EDGE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available in this browser");

    await page.render({ canvas, canvasContext: context, viewport }).promise;

    pages.push({
      page: pageNumber,
      dataUrl: canvasToJpeg(canvas),
      width: canvas.width,
      height: canvas.height,
    });
    onPage?.(pageNumber, doc.numPages);
  }

  await doc.destroy();
  return pages;
}

/** Reads how many pages a file has without rasterising it. */
export async function countPages(file: File): Promise<number> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() })
      .promise;
    const total = doc.numPages;
    await doc.destroy();
    return total;
  }
  return 1;
}

/** Turns an uploaded PDF or image into page images the model can read. */
export async function renderFileToPages(
  file: File,
  onPage?: (done: number, total: number) => void,
): Promise<PageImage[]> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return renderPdfFile(file, onPage);
  }
  return renderImageFile(file);
}
