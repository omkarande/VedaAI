export const dynamic = "force-dynamic";

import { hasApiKey, MODEL } from "@/lib/gemini";

export async function GET() {
  return Response.json({ ok: true, model: MODEL, hasApiKey: hasApiKey() });
}
