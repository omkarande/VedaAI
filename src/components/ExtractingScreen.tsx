"use client";

import type { JobStatus } from "../types";

const STAGE_LABEL: Record<JobStatus, string> = {
  rendering: "Reading your files",
  uploading: "Uploading pages",
  questions: "Extracting questions",
  answers: "Reading handwritten answers",
  mapping: "Mapping answers to questions",
  grading: "Grading and writing feedback",
  done: "Finishing up",
};

const ORDER: JobStatus[] = [
  "rendering",
  "uploading",
  "questions",
  "answers",
  "mapping",
  "grading",
];

type ExtractingScreenProps = {
  stage: JobStatus;
  progress: number;
  error: string | null;
  onRetry: () => void;
};

export default function ExtractingScreen({
  stage,
  progress,
  error,
  onRetry,
}: ExtractingScreenProps) {
  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-white">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-[#e24b4b]">
            Extraction failed
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#6b6b6b]">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 h-11 rounded-full bg-[#1c1c1c] px-6 text-sm font-semibold text-white"
          >
            Back to upload
          </button>
        </div>
      </div>
    );
  }

  const activeIndex = ORDER.indexOf(stage);

  return (
    <div className="flex h-full items-center justify-center rounded-2xl bg-white">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="sparkle-pulse relative h-16 w-24">
          <span className="absolute left-8 top-0 text-4xl text-[#f36b1c]">✦</span>
          <span className="absolute left-0 top-7 text-2xl text-[#f36b1c]">✦</span>
          <span className="absolute right-1 top-8 text-xl text-[#f36b1c]">✦</span>
          <span className="absolute bottom-0 left-12 size-1.5 rounded-full bg-[#f36b1c]" />
        </div>

        <h2 className="mt-6 text-2xl font-bold">Extracting...</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">This may take a while</p>
        <p className="mt-1 text-xs font-medium text-[#8a8a8a]">
          {STAGE_LABEL[stage]}
        </p>

        <div className="mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#f0f0f0]">
          <div
            className="h-full rounded-full bg-[#f36b1c] transition-[width] duration-500"
            style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-[#8a8a8a]">
          {Math.round(progress)}%
        </p>

        <ul className="mt-5 flex flex-col gap-2">
          {ORDER.map((item, index) => {
            const done = activeIndex > index;
            const active = activeIndex === index;
            return (
              <li
                key={item}
                className={`flex items-center gap-2 text-xs ${
                  active
                    ? "font-semibold text-[#1c1c1c]"
                    : done
                      ? "text-[#1f9d55]"
                      : "text-[#b5b5b5]"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    done
                      ? "bg-[#1f9d55]"
                      : active
                        ? "bg-[#f36b1c]"
                        : "bg-[#d9d9d9]"
                  }`}
                />
                {STAGE_LABEL[item]}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
