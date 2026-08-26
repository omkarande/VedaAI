import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";

function page(n, file) {
  const data = readFileSync(new URL(`../test-samples/${file}`, import.meta.url));
  return { page: n, dataUrl: `data:image/png;base64,${data.toString("base64")}` };
}

const questionPages = [page(1, "question-multipage.png")];
const answerPages = [page(1, "answer-p1.png"), page(2, "answer-p2.png")];

const created = await fetch(`${BASE}/api/jobs`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ questionPages, answerPages }),
});
const { id, error } = await created.json();
if (!id) throw new Error(error ?? "job not created");
console.log("job:", id);

let snapshot;
for (let attempt = 0; attempt < 120; attempt += 1) {
  snapshot = await (await fetch(`${BASE}/api/jobs/${id}`)).json();
  if (snapshot.status !== "running") break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

if (snapshot.status === "error") {
  console.error("ERROR:", snapshot.error);
  process.exit(1);
}

console.log("\n--- MULTI-PAGE CHECK ---");
let spanning = 0;
for (const question of snapshot.result.questions) {
  const pages = [...new Set(question.regions.map((region) => region.page))];
  if (pages.length > 1) spanning += 1;
  console.log(
    `${question.number.padEnd(5)} ${question.status.padEnd(11)} regions=${question.regions.length} pages=[${pages}]`,
  );
}
console.log(`\nanswers spanning >1 page: ${spanning}`);
console.log("answerPageCount:", snapshot.result.answerPageCount);
console.log("summary:", snapshot.result.summary);
