export type LengthAwareGrade = {
  awarded: number;
  status: "correct" | "partial" | "incorrect";
  feedback: string;
};

const ALREADY_MENTIONS_LENGTH =
  /too short|too brief|insufficient (?:length|detail)|not (?:long|detailed) enough|more (?:explanation|detail|working|points) (?:was|were) needed/i;

export function wordCount(text: string) {
  return String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Minimum transcribed words expected for the marks on offer.
 * 1-mark answers can be a word or phrase. Higher-mark questions need more.
 */
export function minimumWordsForMarks(maxMarks: number) {
  if (maxMarks <= 1) return 0;
  if (maxMarks === 2) return 3;
  return maxMarks * 4;
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function statusFromScore(
  awarded: number,
  maxMarks: number,
): LengthAwareGrade["status"] {
  if (awarded <= 0) return "incorrect";
  if (maxMarks > 0 && awarded >= maxMarks) return "correct";
  return "partial";
}

function lengthNote(maxMarks: number, words: number) {
  if (maxMarks <= 1) {
    return "This answer is too brief for the marks available.";
  }
  const wordLabel = words === 1 ? "word" : "words";
  return `This answer is too short for a ${maxMarks}-mark question (${words} ${wordLabel}); more explanation or working was needed for full marks.`;
}

/**
 * If a transcribed answer is clearly too short for the marks allocated,
 * cap the score and make sure feedback says so. The model still decides
 * content quality; this only stops full marks on an underdeveloped answer.
 */
export function applyLengthPolicy(args: {
  awarded: number;
  status: string;
  feedback: string | null;
  maxMarks: number;
  answerText: string;
}): LengthAwareGrade {
  const maxMarks = Math.max(0, args.maxMarks);
  let awarded = Math.max(0, Math.min(maxMarks, Number(args.awarded) || 0));
  const words = wordCount(args.answerText);
  const minWords = minimumWordsForMarks(maxMarks);
  const tooShort = minWords > 0 && words < minWords;

  if (tooShort) {
    const lengthCap = roundToHalf(maxMarks * (words / minWords));
    awarded = Math.min(awarded, lengthCap);
  }

  let feedback = String(args.feedback ?? "").trim();
  if (tooShort && !ALREADY_MENTIONS_LENGTH.test(feedback)) {
    const note = lengthNote(maxMarks, words);
    feedback = feedback ? `${feedback} ${note}` : note;
  }

  return {
    awarded,
    status: statusFromScore(awarded, maxMarks),
    feedback,
  };
}
