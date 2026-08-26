import { createJobRecord, jobs, snapshot } from "@/lib/jobs";
import { hasApiKey, MODEL } from "@/lib/gemini";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type PagePayload = { page: number; dataUrl: string };

async function startJob(
  id: string,
  body: { questionPages: PagePayload[]; answerPages: PagePayload[] },
) {
  const job = jobs.get(id);
  if (!job) return;
  try {
    const result = await runPipeline({
      questionPages: body.questionPages,
      answerPages: body.answerPages,
      onProgress: ({ stage, progress }: { stage: string; progress: number }) => {
        job.stage = stage as typeof job.stage;
        job.progress = progress;
      },
    });
    job.status = "done";
    job.stage = "done";
    job.progress = 100;
    job.result = result;
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : String(error);
  }
}

export async function GET() {
  return Response.json({ ok: true, model: MODEL, hasApiKey: hasApiKey() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      questionPages?: PagePayload[];
      answerPages?: PagePayload[];
    };
    if (!body?.questionPages?.length || !body?.answerPages?.length) {
      return Response.json(
        { error: "Both a question paper and an answer sheet are required." },
        { status: 400 },
      );
    }
    const job = createJobRecord();
    void startJob(job.id, {
      questionPages: body.questionPages,
      answerPages: body.answerPages,
    });
    return Response.json(snapshot(job), { status: 202 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}
