"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { formatSize, isSupported, MAX_UPLOAD_BYTES } from "../lib/uploads";
import type { UploadedFile } from "../types";

type Slot = "question" | "answer";

type UploadScreenProps = {
  question: UploadedFile | null;
  answer: UploadedFile | null;
  onFile: (slot: Slot, file: File) => void;
  onRemove: (slot: Slot) => void;
  onStart: () => void;
};

function DropZone({
  slot,
  titleAccent,
  file,
  onFile,
  onRemove,
}: {
  slot: Slot;
  titleAccent: string;
  file: UploadedFile | null;
  onFile: (slot: Slot, file: File) => void;
  onRemove: (slot: Slot) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function take(list: FileList | null) {
    const next = list?.[0];
    if (!next) return;

    if (!isSupported(next)) {
      setProblem("Upload a PDF or an image file.");
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setProblem(`That file is ${formatSize(next.size)}. The limit is 10MB.`);
      return;
    }

    setProblem(null);
    onFile(slot, next);
  }

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
        className="hidden"
        onChange={(event) => {
          take(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      {file ? (
        <>
          <button
            type="button"
            className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-[#6b6b6b] hover:bg-[#f0f0f0]"
            onClick={() => onRemove(slot)}
            aria-label={`Remove ${file.name}`}
          >
            <X className="size-4" />
          </button>
          <div className="flex w-full max-w-[280px] items-center gap-3 rounded-xl bg-[#fff5f5] px-3 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e24b4b] text-[11px] font-extrabold text-white">
              {file.kind}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-[#6b6b6b]">
                {file.sizeLabel}
                {file.pages
                  ? ` · ${file.pages} ${file.pages === 1 ? "Page" : "Pages"}`
                  : ""}
              </p>
            </div>
          </div>
        </>
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
          <span className="text-xs text-[#8a8a8a]">PDF or image · Max 10MB</span>
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
  onFile,
  onRemove,
  onStart,
}: UploadScreenProps) {
  const ready = Boolean(question && answer);

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-auto px-2 pb-6 md:gap-9">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-center text-[22px] font-extrabold leading-tight tracking-tight sm:text-[28px] md:text-[34px]">
          Upload{" "}
          <span className="inline-block rounded-lg bg-[#f36b1c] px-2 py-0.5 text-white">
            Question Paper & Answer Sheets
          </span>
        </h1>
        <p className="text-sm text-[#6b6b6b]">Upload both files to get started</p>
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
          file={question}
          onFile={onFile}
          onRemove={onRemove}
        />
        <DropZone
          slot="answer"
          titleAccent="Answer Sheet"
          file={answer}
          onFile={onFile}
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
          Once both files are uploaded, you'll be able to map answers with questions
        </p>
      </div>
    </div>
  );
}
