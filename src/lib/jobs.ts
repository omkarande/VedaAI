import { randomUUID } from "node:crypto";
import type { JobStatus, MappingResult } from "@/types";

export type JobRecord = {
  id: string;
  status: "running" | "done" | "error";
  stage: JobStatus;
  progress: number;
  result: MappingResult | null;
  error: string | null;
  createdAt: number;
};

const globalForJobs = globalThis as typeof globalThis & {
  __vedaJobs?: Map<string, JobRecord>;
};

export const jobs = globalForJobs.__vedaJobs ?? new Map<string, JobRecord>();
globalForJobs.__vedaJobs = jobs;

export function createJobRecord(): JobRecord {
  const job: JobRecord = {
    id: randomUUID(),
    status: "running",
    stage: "uploading",
    progress: 5,
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

export function snapshot(job: JobRecord) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    error: job.error,
    result: job.result,
  };
}
