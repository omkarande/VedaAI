import type { UploadedFile } from "../types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_SLOT = 20;

export function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function isSupported(file: File) {
  return isPdf(file) || file.type.startsWith("image/");
}

export function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${mb.toFixed(1).replace(/\.0$/, "")}MB`;
}

export function toUploadedFile(file: File): UploadedFile {
  const pdf = isPdf(file);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    sizeLabel: formatSize(file.size),
    kind: pdf ? "PDF" : "IMG",
    pages: pdf ? 0 : 1,
  };
}
