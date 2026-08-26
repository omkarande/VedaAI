import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";

function toDataUrl(path) {
  return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
}

const questionPages = [
  { page: 1, dataUrl: toDataUrl(new URL("../test-samples/question-paper.png", import.meta.url)) },
];
const answerPages = [
  { page: 1, dataUrl: toDataUrl(new URL("../test-samples/answer-sheet.png", import.meta.url)) },
];

const created = await fetch(`${BASE}/api/jobs`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ questionPages, answerPages }),
});
const { id, error } = await created.json();
if (!id) throw new Error(error ?? "job not created");
console.log("job:", id);

let snapshot;
for (let attempt = 0; attempt < 90; attempt += 1) {
  const response = await fetch(`${BASE}/api/jobs/${id}`);
  snapshot = await response.json();
  console.log(`  ${snapshot.status} · ${snapshot.stage} · ${snapshot.progress}%`);
  if (snapshot.status !== "running") break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

if (snapshot.status === "error") {
  console.error("\nERROR:", snapshot.error);
  process.exit(1);
}

const { questions, unmatched, summary } = snapshot.result;
console.log("\n--- QUESTIONS (printed order) ---");
for (const question of questions) {
  const pages = [...new Set(question.regions.map((region) => region.page))];
  console.log(
    `${question.number.padEnd(7)} ${question.status.padEnd(11)} ${question.awarded}/${question.max}  regions=${question.regions.length} pages=[${pages}]  ${question.text.slice(0, 52)}`,
  );
}
console.log("\n--- UNMATCHED ---");
for (const answer of unmatched) {
  console.log(`  label=${answer.label ?? "none"}  regions=${answer.regions.length}  ${answer.text.slice(0, 60)}`);
}
console.log("\n--- SUMMARY ---");
console.log(summary);
