/**
 * End-to-end check against the running API using the generated sample papers.
 * The sample content is fixed, so the expectations below are exact.
 */
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function page(n, file) {
  const data = readFileSync(new URL(`../test-samples/${file}`, import.meta.url));
  return { page: n, dataUrl: `data:image/png;base64,${data.toString("base64")}` };
}

const questionPages = [page(1, "real-question-paper.png")];
const answerPages = [
  page(1, "real-answer-p1.png"),
  page(2, "real-answer-p2.png"),
];

const response = await fetch(`${BASE}/api/jobs`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ questionPages, answerPages }),
});

if (!response.ok) {
  const payload = await response.json().catch(() => ({}));
  console.error(`ERROR ${response.status}:`, payload.error ?? "request failed");
  process.exit(1);
}

let result = null;
let buffer = "";
const decoder = new TextDecoder();

for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const update = JSON.parse(line);
    if (update.error) {
      console.error("ERROR:", update.error);
      process.exit(1);
    }
    if (update.result) result = update.result;
    if (update.stage) console.log(`  ${update.stage} ${update.progress}%`);
  }
}

if (!result) {
  console.error("ERROR: stream ended without a result");
  process.exit(1);
}

const { questions, unmatched, summary } = result;

console.log("\n--- QUESTIONS (printed order) ---");
for (const question of questions) {
  const pages = [...new Set(question.regions.map((region) => region.page))];
  console.log(
    `${question.number.padEnd(6)} ${question.status.padEnd(11)} ` +
      `${question.awarded}/${question.max}  pages=[${pages}]  ${question.text.slice(0, 52)}`,
  );
}

console.log("\n--- UNMATCHED ---");
for (const answer of unmatched) {
  console.log(`  label=${answer.label ?? "none"}  ${answer.text.slice(0, 60)}`);
}

console.log("\n--- SUMMARY ---");
console.log(summary);

const numbers = questions.map((q) => q.number);
const byNumber = new Map(questions.map((q) => [q.number, q]));
const spanning = questions.filter(
  (q) => new Set(q.regions.map((r) => r.page)).size > 1,
);

/**
 * A missing question must fail, not pass by accident: `undefined?.status !==
 * "unanswered"` is true, which once hid a real numbering bug.
 */
function matched(number) {
  const question = byNumber.get(number);
  return Boolean(question) && question.status !== "unanswered";
}

const answeredQuestions = questions.filter((q) => q.status !== "unanswered");

const checks = [
  ["7 questions extracted", questions.length === 7],
  ["printed order preserved", numbers.join("|").startsWith("1|2|3|4|5")],
  [
    "sub-parts kept separate",
    numbers.some((n) => /5.*a/i.test(n)) && numbers.some((n) => /5.*b/i.test(n)),
  ],
  [
    // "1." and "2)" are stray punctuation; the bracket in "5 (a)" is not.
    "numbers carry no trailing punctuation",
    numbers.every(
      (n) => !/[.:,;]$/.test(n) && !(n.endsWith(")") && !n.includes("(")),
    ),
  ],
  ["out-of-order answer matched (Q4 written first)", matched("4")],
  ["Q1 matched", matched("1")],
  ["Q2 matched", matched("2")],
  ["Q6 diagram answer matched", matched("6")],
  ["Q3 flagged unanswered", byNumber.get("3")?.status === "unanswered"],
  [
    "Q5(b) flagged unanswered",
    [...byNumber.entries()].find(([n]) => /5.*b/i.test(n))?.[1].status ===
      "unanswered",
  ],
  ["stray answer left unmatched", unmatched.length === 1],
  ["an answer spans two pages", spanning.length >= 1],
  [
    "every matched answer has a region",
    answeredQuestions.every((q) => q.regions.length > 0),
  ],
  // Grades are looked up by question number across two model calls. When that
  // lookup misses, every answer silently scores zero, so assert marks landed.
  ["grades reached the answers", summary.awarded > 0],
  [
    "every matched answer has feedback",
    answeredQuestions.every((q) => Boolean(q.feedback)),
  ],
];

console.log("\n--- CHECKS ---");
let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
