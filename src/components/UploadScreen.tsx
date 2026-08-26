"use client";

import { useRef, useState } from "react";
import { Plus, Upload, X } from "lucide-react";
import {
  formatSize,
  isSupported,
  MAX_FILES_PER_SLOT,
  MAX_UPLOAD_BYTES,
} from "../lib/uploads";
import type { UploadedFile } from "../types";

type Slot = "question" | "answer";

type UploadScreenProps = {
  question: UploadedFile[];
  answer: UploadedFile[];
  onAdd: (slot: Slot, files: File[]) => void;
  onRemove: (slot: Slot, id: string) => void;
  onStart: () => void;
};

function DropZone({
  slot,
  titleAccent,
  files,
  onAdd,
  onRemove,
}: {
  slot: Slot;
  titleAccent: string;
  files: UploadedFile[];
  onAdd: (slot: Slot, files: File[]) => void;
  onRemove: (slot: Slot, id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function take(list: FileList | null) {
    if (!list?.length) return;

    const incoming = Array.from(list);
    const room = MAX_FILES_PER_SLOT - files.length;
    if (room <= 0) {
      setProblem(`You can add up to ${MAX_FILES_PER_SLOT} files on this side.`);
      return;
    }

    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of incoming.slice(0, room)) {
      if (!isSupported(file)) {
        rejected.push(`${file.name}: upload a PDF or an image.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push(
          `${file.name} is ${formatSize(file.size)}. The limit is 10MB per file.`,
        );
        continue;
      }
      accepted.push(file);
    }

    if (incoming.length > room) {
      rejected.unshift(
        `Only ${room} more file${room === 1 ? "" : "s"} can be added here.`,
      );
    }

    setProblem(rejected[0] ?? null);
    if (accepted.length) onAdd(slot, accepted);
  }

  const totalPages = files.reduce((sum, file) => sum + (file.pages || 0), 0);
  const canAddMore = files.length < MAX_FILES_PER_SLOT;

  return (
    <div
      className={`relative flex min-h-[168px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 transition ${
        over ? "border-[#f36b1c] bg-[#fff7f1]" : "border-[#d0d0d0] bg-white"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          take(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      {files.length ? (
        <div className="flex w-full flex-col items-center gap-3">
          <p className="text-[15px] font-semibold">
            Upload <span className="text-[#f36b1c]">{titleAccent}</span>
          </p>
          <ul className="flex max-h-[220px] w-full max-w-[320px] flex-col gap-2 overflow-auto">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex w-full items-center gap-3 rounded-xl bg-[#fff5f5] px-3 py-3"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e24b4b] text-[11px] font-extrabold text-white">
                  {file.kind}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-[#6b6b6b]">
                    {file.sizeLabel}
                    {file.pages
                      ? ` · ${file.pages} ${file.pages === 1 ? "Page" : "Pages"}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#6b6b6b] hover:bg-[#f0f0f0]"
                  onClick={() => onRemove(slot, file.id)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {canAddMore && (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#f36b1c] hover:underline"
              onClick={() => inputRef.current?.click()}
            >
              <Plus className="size-3.5" />
              Add another image or PDF
            </button>
          )}
          <p className="text-xs text-[#8a8a8a]">
            {files.length} {files.length === 1 ? "file" : "files"}
            {totalPages
              ? ` · ${totalPages} ${totalPages === 1 ? "page" : "pages"} total`
              : ""}
            {" · "}
            Max 10MB each
          </p>
          {problem && (
            <p className="text-center text-xs font-medium text-[#e24b4b]">
              {problem}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="flex flex-col items-center gap-3"
          onClick={() => inputRef.current?.click()}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-[#f4f4f4] text-[#4a4a4a]">
            <Upload className="size-5" />
          </span>
          <span className="text-[15px] font-semibold">
            Upload <span className="text-[#f36b1c]">{titleAccent}</span>
          </span>
          <span className="text-xs text-[#8a8a8a]">
            PDF or images · Max 10MB each · Multiple photos OK
          </span>
          {problem && (
            <span className="text-xs font-medium text-[#e24b4b]">{problem}</span>
          )}
        </button>
      )}
    </div>
  );
}

export default function UploadScreen({
  question,
  answer,
  onAdd,
  onRemove,
  onStart,
}: UploadScreenProps) {
  const ready = question.length > 0 && answer.length > 0;

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-auto px-2 pb-6 md:gap-9">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-center text-[22px] font-extrabold leading-tight tracking-tight sm:text-[28px] md:text-[34px]">
          Upload{" "}
          <span className="inline-block rounded-lg bg-[#f36b1c] px-2 py-0.5 text-white">
            Question Paper & Answer Sheets
          </span>
        </h1>
        <p className="max-w-md text-center text-sm text-[#6b6b6b]">
          Upload a PDF or one or more page photos for each side
        </p>
      </div>

      <div className="relative flex size-[168px] items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#fff1e8]" />
        <div className="absolute left-2 top-6 size-8 rounded-full bg-[#f36b1c]/90" />
        <div className="absolute right-3 top-10 size-7 rounded-full bg-[#ffb347]" />
        <div className="absolute bottom-5 left-8 size-6 rounded-full bg-[#f36b1c]" />
        <div className="relative flex size-[108px] items-center justify-center overflow-hidden rounded-full bg-[#f36b1c]">
          <img
            src="/brand/teacher.png"
            alt=""
            className="size-full object-cover"
            width={108}
            height={108}
            onError={(event) => {
              event.currentTarget.src =
                "https://ui-avatars.com/api/?name=Teacher&background=f36b1c&color=fff&size=160";
            }}
          />
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 md:flex-row md:gap-5">
        <DropZone
          slot="question"
          titleAccent="Question Paper"
          files={question}
          onAdd={onAdd}
          onRemove={onRemove}
        />
        <DropZone
          slot="answer"
          titleAccent="Answer Sheet"
          files={answer}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={onStart}
          className={`h-12 min-w-[220px] rounded-full px-8 text-sm font-semibold transition ${
            ready
              ? "bg-[#1c1c1c] text-white hover:bg-black"
              : "cursor-not-allowed bg-[#d9d9d9] text-white"
          }`}
        >
          Start Mapping →
        </button>
        <p className="text-center text-xs text-[#8a8a8a]">
          Once both sides have at least one file, you can map answers to
          questions
        </p>
      </div>
    </div>
  );
}
