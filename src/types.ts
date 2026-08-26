export type AppView = "upload" | "extracting" | "mapping";

export type NavId =
  | "home"
  | "classroom"
  | "assignments"
  | "exams"
  | "library";

export type QuestionStatus = "correct" | "partial" | "incorrect" | "unanswered";

export type JobStatus =
  | "rendering"
  | "uploading"
  | "questions"
  | "answers"
  | "mapping"
  | "grading"
  | "done";

export type UploadedFile = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: "PDF" | "IMG";
  /** 0 until the real page count is known. */
  pages: number;
};

export type PageImage = {
  page: number;
  dataUrl: string;
  width: number;
  height: number;
};

export type Region = {
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
};

export type MappedQuestion = {
  id: string;
  number: string;
  text: string;
  awarded: number;
  max: number;
  status: QuestionStatus;
  feedback: string | null;
  answerText: string | null;
  regions: Region[];
};

export type UnmatchedAnswer = {
  id: string;
  label: string | null;
  text: string;
  regions: Region[];
};

export type MappingSummary = {
  total: number;
  answered: number;
  unanswered: number;
  unmatched: number;
  awarded: number;
  max: number;
  overall: string | null;
};

export type MappingResult = {
  questions: MappedQuestion[];
  unmatched: UnmatchedAnswer[];
  summary: MappingSummary;
  answerPageCount: number;
  model: string;
};
