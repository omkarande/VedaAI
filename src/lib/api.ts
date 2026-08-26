import type { JobStatus, MappingResult, PageImage } from "../types";

export type ProgressUpdate = {
  stage: JobStatus;
  progress: number;
};

type StreamLine = {
  stage?: JobStatus;
  progress?: number;
  result?: MappingResult;
  error?: string;
};

function stripped(pages: PageImage[]) {
  return pages.map((page) => ({ page: page.page, dataUrl: page.dataUrl }));
}

/**
 * Sends both documents and reads newline-delimited progress back from the
 * single request that does the work.
 */
export async function runJob(
  questionPages: PageImage[],
  answerPages: PageImage[],
  onProgress: (update: ProgressUpdate) => void,
  signal?: AbortSignal,
): Promise<MappingResult> {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      questionPages: stripped(questionPages),
      answerPages: stripped(answerPages),
    }),
  });

  if (response.status === 413) {
    throw new Error(
      "Those files are too large to send in one request. Try fewer pages or smaller images.",
    );
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Could not start extraction.");
  }

  if (!response.body) {
    throw new Error("This browser cannot read streamed responses.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: MappingResult | null = null;

  const handle = (line: string) => {
    if (!line.trim()) return;

    let update: StreamLine;
    try {
      update = JSON.parse(line) as StreamLine;
    } catch {
      return;
    }

    if (update.error) throw new Error(update.error);
    if (update.result) result = update.result;
    if (update.stage) {
      onProgress({ stage: update.stage, progress: update.progress ?? 0 });
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handle(line);
  }

  buffer += decoder.decode();
  handle(buffer);

  if (!result) {
    throw new Error("The server closed the connection before finishing.");
  }
  return result;
}
