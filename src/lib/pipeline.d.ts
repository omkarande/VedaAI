import type { MappingResult } from "@/types";

export function runPipeline(args: {
  questionPages: { page: number; dataUrl: string }[];
  answerPages: { page: number; dataUrl: string }[];
  onProgress: (update: { stage: string; progress: number }) => void;
}): Promise<MappingResult>;
