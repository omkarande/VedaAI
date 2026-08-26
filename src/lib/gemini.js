const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
}

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/**
 * Routed through OpenRouter only as a fallback. Deliberately the same model as
 * MODEL above, so a fallback run behaves identically to a direct one: the
 * prompts ask for boxes on a 0-1000 grid, and other model families are far
 * less reliable at that, which would blunt the highlights.
 */
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemini-3.6-flash";

/**
 * OpenRouter otherwise reserves the model's full 65,536-token output and
 * rejects the call with 402 if the key cannot cover that reserve. Exam JSON
 * is far smaller; 8k is enough for questions, boxes and feedback.
 */
const OPENROUTER_MAX_TOKENS = Math.max(
  1024,
  Number(process.env.OPENROUTER_MAX_TOKENS) || 8192,
);

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function hasOpenRouterKey() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function hasApiKey() {
  return hasGeminiKey() || hasOpenRouterKey();
}

function requestFailed(provider, status, detail) {
  const error = new Error(
    `${provider} request failed (${status}): ${String(detail).slice(0, 400)}`,
  );
  error.status = status;
  return error;
}

function parseJson(provider, text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${provider} returned invalid JSON: ${text.slice(0, 300)}`);
  }
}

function dataUrlToInlinePart(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Page image must be a base64 data URL");
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

async function callGemini({ prompt, pages, schema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const parts = [{ text: prompt }];
  for (const page of pages) {
    parts.push({ text: `--- Page ${page.page} ---` });
    parts.push(dataUrlToInlinePart(page.dataUrl));
  }

  const response = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });

  if (!response.ok) {
    throw requestFailed("Gemini", response.status, await response.text());
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    const reason = payload?.candidates?.[0]?.finishReason ?? "unknown";
    throw new Error(`Gemini returned no content (finishReason: ${reason})`);
  }

  return parseJson("Gemini", text);
}

/** OpenRouter replies with a plain string, but can use content parts. */
function readOpenRouterContent(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("")
      .trim();
  }
  return "";
}

async function callOpenRouter({ prompt, pages, schema }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const content = [{ type: "text", text: prompt }];
  for (const page of pages) {
    content.push({ type: "text", text: `--- Page ${page.page} ---` });
    content.push({ type: "image_url", image_url: { url: page.dataUrl } });
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "VedaAI Exam Mapper",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: OPENROUTER_MAX_TOKENS,
      // Not strict: the schemas leave fields like maxMarks and label optional,
      // which strict mode forbids. The pipeline defaults every field anyway.
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: false, schema },
      },
      provider: { require_parameters: true },
    }),
  });

  if (!response.ok) {
    throw requestFailed("OpenRouter", response.status, await response.text());
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new Error(`OpenRouter error: ${payload.error.message ?? "unknown"}`);
  }

  const text = readOpenRouterContent(payload?.choices?.[0]?.message?.content);
  if (!text) {
    const reason = payload?.choices?.[0]?.finish_reason ?? "unknown";
    throw new Error(`OpenRouter returned no content (finishReason: ${reason})`);
  }

  return parseJson("OpenRouter", text);
}

/**
 * Calls the model with a text prompt plus page images and forces a JSON
 * response matching the supplied schema.
 *
 * Gemini is tried first so the free tier is spent before any paid credit.
 * Only a 429 falls through to OpenRouter: a 401 means the key itself is
 * wrong, and quietly switching provider would hide that.
 */
export async function generateJson(args) {
  if (!hasGeminiKey()) {
    if (!hasOpenRouterKey()) {
      throw new Error(
        "No model provider is configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY.",
      );
    }
    return callOpenRouter(args);
  }

  try {
    return await callGemini(args);
  } catch (error) {
    if (error?.status === 429 && hasOpenRouterKey()) {
      return callOpenRouter(args);
    }
    throw error;
  }
}

/**
 * Gemini returns boxes as [yMin, xMin, yMax, xMax] on a 0-1000 scale.
 * The UI positions overlays with CSS percentages.
 */
export function boxToRegion(page, box) {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const [yMin, xMin, yMax, xMax] = box.map(Number);
  if ([yMin, xMin, yMax, xMax].some((value) => Number.isNaN(value))) return null;

  const top = Math.max(0, Math.min(100, yMin / 10));
  const left = Math.max(0, Math.min(100, xMin / 10));
  const bottom = Math.max(0, Math.min(100, yMax / 10));
  const right = Math.max(0, Math.min(100, xMax / 10));

  const height = Math.max(1.2, bottom - top);
  const width = Math.max(2, right - left);

  return {
    page,
    top: Number(top.toFixed(2)),
    left: Number(left.toFixed(2)),
    width: Number(Math.min(width, 100 - left).toFixed(2)),
    height: Number(Math.min(height, 100 - top).toFixed(2)),
  };
}
