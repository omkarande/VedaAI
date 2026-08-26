import {
  hasApiKey,
  hasGeminiKey,
  hasOpenRouterKey,
  MODEL,
  OPENROUTER_MODEL,
} from "@/lib/gemini";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type PagePayload = { page: number; dataUrl: string };

/**
 * The whole pipeline runs inside this one request and reports progress as
 * newline-delimited JSON. Keeping the work in the request is what makes this
 * safe on serverless: there is no background task that can be frozen once a
 * response is sent, and no shared job state that a second instance would miss.
 */
export async function POST(request: Request) {
  let body: {
    questionPages?: PagePayload[];
    answerPages?: PagePayload[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body?.questionPages?.length || !body?.answerPages?.length) {
    return Response.json(
      { error: "Both a question paper and an answer sheet are required." },
      { status: 400 },
    );
  }

  if (!hasApiKey()) {
    return Response.json(
      {
        error:
          "No model provider is configured on the server. Set GEMINI_API_KEY or OPENROUTER_API_KEY and redeploy.",
      },
      { status: 500 },
    );
  }

  const questionPages = body.questionPages;
  const answerPages = body.answerPages;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (payload: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          open = false;
        }
      };

      // Flushes headers immediately so the client can start reading.
      send({ stage: "uploading", progress: 8 });

      try {
        const result = await runPipeline({
          questionPages,
          answerPages,
          onProgress: ({
            stage,
            progress,
          }: {
            stage: string;
            progress: number;
          }) => send({ stage, progress }),
        });
        send({ stage: "done", progress: 100, result });
      } catch (error) {
        send({
          error:
            error instanceof Error
              ? error.message
              : "Extraction failed unexpectedly.",
        });
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Stops intermediate proxies from buffering the progress lines.
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    model: MODEL,
    hasApiKey: hasApiKey(),
    providers: {
      gemini: hasGeminiKey(),
      openrouter: hasOpenRouterKey(),
      openrouterModel: hasOpenRouterKey() ? OPENROUTER_MODEL : null,
    },
  });
}
