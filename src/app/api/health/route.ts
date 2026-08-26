export const dynamic = "force-dynamic";

import {
  hasApiKey,
  hasGeminiKey,
  hasOpenRouterKey,
  MODEL,
  OPENROUTER_MODEL,
} from "@/lib/gemini";

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
