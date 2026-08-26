import { boxToRegion, generateJson, hasApiKey, MODEL } from "./gemini.js";

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "string" },
          text: { type: "string" },
          maxMarks: { type: "number" },
          page: { type: "integer" },
        },
        required: ["number", "text", "page"],
      },
    },
  },
  required: ["questions"],
};

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description:
              "Question number the student wrote next to this answer, e.g. '3' or '11 (b)'. Empty string when no label was written.",
          },
          text: { type: "string" },
          regions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                page: { type: "integer" },
                box: {
                  type: "array",
                  items: { type: "integer" },
                  description: "[yMin, xMin, yMax, xMax] normalised to 0-1000",
                },
              },
              required: ["page", "box"],
            },
          },
        },
        required: ["text", "regions"],
      },
    },
  },
  required: ["answers"],
};

const MAPPING_SCHEMA = {
  type: "object",
  properties: {
    pairs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionNumber: { type: "string" },
          answerIndex: { type: "integer" },
          confidence: { type: "number" },
        },
        required: ["questionNumber", "answerIndex"],
      },
    },
  },
  required: ["pairs"],
};

const GRADING_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionNumber: { type: "string" },
          awarded: { type: "number" },
          status: {
            type: "string",
            enum: ["correct", "partial", "incorrect"],
          },
          feedback: { type: "string" },
        },
        required: ["questionNumber", "awarded", "status", "feedback"],
      },
    },
    overall: { type: "string" },
  },
  required: ["results", "overall"],
};

/**
 * "Q2.", "q 2", "2)" and "2" must all compare equal, and
 * "11 (b)" must equal "Q11(b)".
 */
function normaliseLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^(?:q|ques|question|ans|answer)(?=\d)/, "");
}

async function extractQuestions(pages) {
  const data = await generateJson({
    pages,
    schema: QUESTION_SCHEMA,
    prompt: `You are reading a printed exam question paper. Extract EVERY question in the exact printed order.

Rules:
- Preserve the original numbering exactly as printed (for example "1", "5", "11 (a)").
- Treat each labelled sub-part as its own separate question. "11 (a)" and "11 (b)" are two entries, never one.
- Do not invent, merge, renumber or reorder questions.
- Include the full question text.
- maxMarks is the marks printed for that question. Use 0 when no marks are printed.
- page is the 1-based page of the question paper the question appears on.`,
  });

  return (data.questions ?? []).map((question, index) => ({
    id: `q${index + 1}`,
    number: String(question.number ?? index + 1).trim(),
    text: String(question.text ?? "").trim(),
    maxMarks: Number(question.maxMarks ?? 0) || 0,
    sourcePage: Number(question.page ?? 1) || 1,
    order: index,
  }));
}

async function extractAnswers(pages) {
  const data = await generateJson({
    pages,
    schema: ANSWER_SCHEMA,
    prompt: `You are reading a student's HANDWRITTEN answer sheet. Find every distinct answer the student wrote.

Rules:
- The student may answer in any order, and may skip questions entirely.
- "label" is the question number the student wrote beside the answer, with no "Q" prefix and no trailing punctuation (write "3", not "Q3."; write "11 (b)", not "Q11(b).") . Use an empty string if the student wrote no number.
- "text" is a transcription of the handwritten answer, including any equations or descriptions of diagrams.
- "regions" is the exact area of the sheet covered by this answer, as a tight bounding box.
- If a single answer continues onto the next page, return MULTIPLE regions: one region per page it covers, in reading order.
- Each box is [yMin, xMin, yMax, xMax] normalised to a 0-1000 grid on that page.
- Include answers even when they do not seem to match any question.`,
  });

  return (data.answers ?? []).map((answer, index) => {
    const regions = (answer.regions ?? [])
      .map((region) => boxToRegion(Number(region.page) || 1, region.box))
      .filter(Boolean);
    return {
      index,
      label: String(answer.label ?? "").trim(),
      text: String(answer.text ?? "").trim(),
      regions,
    };
  });
}

async function mapUnlabelledAnswers(questions, answers) {
  const pending = answers.filter((answer) => !answer.label);
  if (!pending.length) return [];

  const data = await generateJson({
    pages: [],
    schema: MAPPING_SCHEMA,
    prompt: `Match handwritten answers to exam questions by meaning. The student did not write a question number for these answers.

QUESTIONS:
${questions.map((question) => `- ${question.number}: ${question.text}`).join("\n")}

UNLABELLED ANSWERS:
${pending.map((answer) => `- index ${answer.index}: ${answer.text}`).join("\n")}

Rules:
- Only pair an answer with a question when the content clearly matches that question.
- Leave an answer out entirely if it does not belong to any listed question.
- Never use the same answerIndex twice, and never use the same questionNumber twice.
- confidence is 0 to 1.`,
  });

  return (data.pairs ?? []).filter((pair) => Number(pair.confidence ?? 1) >= 0.5);
}

async function gradePairs(pairs) {
  if (!pairs.length) {
    return { results: [], overall: "No answers were found on the sheet." };
  }

  const data = await generateJson({
    pages: [],
    schema: GRADING_SCHEMA,
    prompt: `Grade each handwritten answer against its question. Be fair to school-level handwriting and phrasing.

${pairs
  .map(
    (pair) =>
      `Question ${pair.question.number} (max ${pair.question.maxMarks || 1} marks): ${pair.question.text}\nStudent answer: ${pair.answer.text}`,
  )
  .join("\n\n")}

Rules:
- awarded must be between 0 and the question's max marks.
- status is "correct" for full marks, "partial" for some marks, "incorrect" for zero.
- feedback is one or two encouraging sentences addressed to the student.
- overall is a short summary of the whole paper for the teacher.`,
  });

  return data;
}

/**
 * Runs the full extraction pipeline and reports progress through onProgress.
 */
export async function runPipeline({ questionPages, answerPages, onProgress }) {
  if (!hasApiKey()) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to a .env file in the project root and restart the server.",
    );
  }

  // Reading the question paper and the answer sheet are independent, so both
  // model calls run at the same time instead of one after the other.
  onProgress({ stage: "questions", progress: 12 });

  const questionsTask = extractQuestions(questionPages).then((value) => {
    onProgress({ stage: "answers", progress: 45 });
    return value;
  });
  const answersTask = extractAnswers(answerPages);

  const [questions, answers] = await Promise.all([questionsTask, answersTask]);

  if (!questions.length) {
    throw new Error("No questions could be read from the question paper.");
  }

  onProgress({ stage: "mapping", progress: 70 });

  const answerByIndex = new Map(answers.map((answer) => [answer.index, answer]));
  const usedAnswers = new Set();
  const matches = new Map();

  // Pass 1: the student wrote the question number next to the answer.
  for (const question of questions) {
    const target = normaliseLabel(question.number);
    const hit = answers.find(
      (answer) =>
        !usedAnswers.has(answer.index) &&
        answer.label &&
        normaliseLabel(answer.label) === target,
    );
    if (hit) {
      matches.set(question.number, hit);
      usedAnswers.add(hit.index);
    }
  }

  // Pass 2: semantic matching for answers with no written number.
  const semantic = await mapUnlabelledAnswers(
    questions.filter((question) => !matches.has(question.number)),
    answers.filter((answer) => !usedAnswers.has(answer.index)),
  );
  for (const pair of semantic) {
    const answer = answerByIndex.get(Number(pair.answerIndex));
    if (!answer || usedAnswers.has(answer.index)) continue;
    if (matches.has(pair.questionNumber)) continue;
    matches.set(pair.questionNumber, answer);
    usedAnswers.add(answer.index);
  }

  onProgress({ stage: "grading", progress: 84 });

  const gradable = questions
    .filter((question) => matches.has(question.number))
    .map((question) => ({ question, answer: matches.get(question.number) }));

  const grading = await gradePairs(gradable);
  const gradeByNumber = new Map(
    (grading.results ?? []).map((result) => [
      String(result.questionNumber),
      result,
    ]),
  );

  const mapped = questions.map((question) => {
    const answer = matches.get(question.number) ?? null;
    const grade = gradeByNumber.get(question.number);
    const max = question.maxMarks || (answer ? 1 : 0);

    if (!answer) {
      return {
        id: question.id,
        number: question.number,
        text: question.text,
        awarded: 0,
        max: question.maxMarks || 0,
        status: "unanswered",
        feedback: null,
        answerText: null,
        regions: [],
      };
    }

    const awarded = Math.max(0, Math.min(max, Number(grade?.awarded ?? 0)));
    return {
      id: question.id,
      number: question.number,
      text: question.text,
      awarded,
      max,
      status: grade?.status ?? "partial",
      feedback: grade?.feedback ?? null,
      answerText: answer.text,
      regions: answer.regions,
    };
  });

  const unmatched = answers
    .filter((answer) => !usedAnswers.has(answer.index))
    .map((answer, index) => ({
      id: `u${index + 1}`,
      label: answer.label || null,
      text: answer.text,
      regions: answer.regions,
    }));

  const answered = mapped.filter((item) => item.status !== "unanswered");
  const summary = {
    total: mapped.length,
    answered: answered.length,
    unanswered: mapped.length - answered.length,
    unmatched: unmatched.length,
    awarded: answered.reduce((sum, item) => sum + item.awarded, 0),
    max: mapped.reduce((sum, item) => sum + item.max, 0),
    overall: grading.overall ?? null,
  };

  onProgress({ stage: "done", progress: 100 });

  return {
    questions: mapped,
    unmatched,
    summary,
    answerPageCount: answerPages.length,
    model: MODEL,
  };
}
