const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
}

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export function hasApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function dataUrlToInlinePart(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Page image must be a base64 data URL");
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

/**
 * Calls Gemini with a text prompt plus page images and forces a JSON response
 * that matches the supplied response schema.
 */
export async function generateJson({ prompt, pages, schema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const parts = [{ text: prompt }];
  for (const page of pages) {
    parts.push({ text: `--- Page ${page.page} ---` });
    parts.push(dataUrlToInlinePart(page.dataUrl));
  }

  const response = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
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
    const detail = await response.text();
    throw new Error(
      `Gemini request failed (${response.status}): ${detail.slice(0, 400)}`,
    );
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

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 300)}`);
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
