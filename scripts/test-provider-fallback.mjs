/**
 * Checks the provider routing rules without calling any real API, so it costs
 * nothing to run. fetch is stubbed and every request is recorded.
 *
 *   node scripts/test-provider-fallback.mjs
 */
import { copyFile, unlink } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src", "lib", "gemini.js");

// package.json is commonjs, so the ESM source needs an .mjs extension to be
// importable directly by node. It has no relative imports, so a copy is safe.
const copy = join(root, "src", "lib", "gemini.test-copy.mjs");

const PAGES = [{ page: 1, dataUrl: "data:image/jpeg;base64,AAAA" }];
const ARGS = { prompt: "hi", pages: PAGES, schema: { type: "object" } };

let calls = [];

function stubFetch(responder) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    const provider = String(url).includes("openrouter") ? "openrouter" : "gemini";
    calls.push(provider);
    return responder(provider, init);
  };
}

function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const GEMINI_OK = {
  candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
};
const OPENROUTER_OK = {
  choices: [{ message: { content: '{"ok":"openrouter"}' } }],
};

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

async function main() {
  await copyFile(source, copy);
  const gemini = await import(pathToFileURL(copy).href);

  // 1. Gemini succeeds: OpenRouter must never be touched.
  process.env.GEMINI_API_KEY = "gem-key";
  process.env.OPENROUTER_API_KEY = "or-key";
  stubFetch(() => reply(200, GEMINI_OK));
  let result = await gemini.generateJson(ARGS);
  check("success stays on Gemini", calls.join(",") === "gemini", calls.join(","));
  check("success returns parsed JSON", result.ok === true);

  // 2. 401 is a bad key, not a spent quota. It must surface, not fall back.
  stubFetch((provider) =>
    provider === "gemini"
      ? reply(401, { error: "invalid credentials" })
      : reply(200, OPENROUTER_OK),
  );
  let thrown = null;
  try {
    await gemini.generateJson(ARGS);
  } catch (error) {
    thrown = error;
  }
  check("401 throws", thrown !== null);
  check("401 carries the status", thrown?.status === 401, String(thrown?.status));
  check("401 does NOT reach OpenRouter", calls.join(",") === "gemini", calls.join(","));

  // 3. 429 is the spent free tier, which is exactly what the fallback is for.
  stubFetch((provider) =>
    provider === "gemini"
      ? reply(429, { error: "quota exceeded" })
      : reply(200, OPENROUTER_OK),
  );
  result = await gemini.generateJson(ARGS);
  check("429 falls back", calls.join(",") === "gemini,openrouter", calls.join(","));
  check("fallback returns OpenRouter JSON", result.ok === "openrouter");

  // 4. 429 with no OpenRouter key must still throw rather than hang.
  delete process.env.OPENROUTER_API_KEY;
  stubFetch(() => reply(429, { error: "quota exceeded" }));
  thrown = null;
  try {
    await gemini.generateJson(ARGS);
  } catch (error) {
    thrown = error;
  }
  check("429 without OpenRouter key throws", thrown?.status === 429);
  check("no OpenRouter call without a key", calls.join(",") === "gemini");

  // 5. No Gemini key at all: go straight to OpenRouter.
  delete process.env.GEMINI_API_KEY;
  process.env.OPENROUTER_API_KEY = "or-key";
  stubFetch(() => reply(200, OPENROUTER_OK));
  result = await gemini.generateJson(ARGS);
  check("OpenRouter-only skips Gemini", calls.join(",") === "openrouter", calls.join(","));
  check("OpenRouter-only returns JSON", result.ok === "openrouter");
  check("hasApiKey true with only OpenRouter", gemini.hasApiKey() === true);

  // 6. No keys at all.
  delete process.env.OPENROUTER_API_KEY;
  stubFetch(() => reply(200, GEMINI_OK));
  thrown = null;
  try {
    await gemini.generateJson(ARGS);
  } catch (error) {
    thrown = error;
  }
  check("no keys throws", thrown !== null);
  check("no keys makes no request", calls.length === 0);
  check("hasApiKey false with no keys", gemini.hasApiKey() === false);
}

try {
  await main();
} finally {
  await unlink(copy).catch(() => {});
}

console.log(failures === 0 ? "\nAll provider routing checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
