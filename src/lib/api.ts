import type { JobStatus, MappingResult, PageImage } from "../types";

export type JobSnapshot = {
  id: string;
  status: "running" | "done" | "error";
  stage: JobStatus;
  progress: number;
  error: string | null;
  result: MappingResult | null;
};

function stripped(pages: PageImage[]) {
  return pages.map((page) => ({ page: page.page, dataUrl: page.dataUrl }));
}

export async function createJob(
  questionPages: PageImage[],
  answerPages: PageImage[],
): Promise<string> {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionPages: stripped(questionPages),
      answerPages: stripped(answerPages),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not start extraction");
  }
  return payload.id as string;
}

export async function fetchJob(id: string): Promise<JobSnapshot> {
  const response = await fetch(`/api/jobs/${id}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Could not read job");
  return payload as JobSnapshot;
}

/** Polls a job until it finishes or fails. */
export async function waitForJob(
  id: string,
  onUpdate: (snapshot: JobSnapshot) => void,
  signal?: AbortSignal,
): Promise<JobSnapshot> {
  for (;;) {
    if (signal?.aborted) throw new Error("cancelled");
    const snapshot = await fetchJob(id);
    onUpdate(snapshot);
    if (snapshot.status !== "running") return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
}
