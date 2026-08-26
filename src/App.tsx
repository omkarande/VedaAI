"use client";

import { useCallback, useRef, useState } from "react";
import AppShell from "./components/AppShell";
import ExtractingScreen from "./components/ExtractingScreen";
import MappingScreen from "./components/MappingScreen";
import UploadScreen from "./components/UploadScreen";
import { createJob, waitForJob } from "./lib/api";
import { toUploadedFile } from "./lib/uploads";
import type {
  AppView,
  JobStatus,
  MappingResult,
  PageImage,
  UploadedFile,
} from "./types";

type Slot = "question" | "answer";
type Selection = { kind: "question" | "unmatched"; id: string };

export default function App() {
  const [view, setView] = useState<AppView>("upload");
  const [question, setQuestion] = useState<UploadedFile | null>(null);
  const [answer, setAnswer] = useState<UploadedFile | null>(null);

  const [stage, setStage] = useState<JobStatus>("rendering");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<MappingResult | null>(null);
  const [answerPages, setAnswerPages] = useState<PageImage[]>([]);
  const [selected, setSelected] = useState<Selection>({
    kind: "question",
    id: "q1",
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  const files = useRef<{ question: File | null; answer: File | null }>({
    question: null,
    answer: null,
  });

  const handleFile = useCallback(async (slot: Slot, file: File) => {
    files.current[slot] = file;
    const uploaded = toUploadedFile(file);
    const apply = slot === "question" ? setQuestion : setAnswer;
    apply(uploaded);

    try {
      const { countPages } = await import("./lib/renderPages");
      const pages = await countPages(file);
      // Ignore the result if the user swapped the file while we were reading it.
      if (files.current[slot] !== file) return;
      apply({ ...uploaded, pages });
    } catch {
      // Page count is cosmetic; rendering will surface any real problem.
    }
  }, []);

  const handleRemove = useCallback((slot: Slot) => {
    files.current[slot] = null;
    if (slot === "question") setQuestion(null);
    else setAnswer(null);
  }, []);

  const reset = useCallback(() => {
    setView("upload");
    setError(null);
    setProgress(0);
    setStage("rendering");
    setResult(null);
    setAnswerPages([]);
  }, []);

  const startMapping = useCallback(async () => {
    const questionFile = files.current.question;
    const answerFile = files.current.answer;
    if (!questionFile || !answerFile) return;

    setView("extracting");
    setError(null);
    setStage("rendering");
    setProgress(2);

    try {
      const { renderFileToPages } = await import("./lib/renderPages");
      const questionImages = await renderFileToPages(
        questionFile,
        (done, total) => setProgress(2 + (done / total) * 5),
      );
      const answerImages = await renderFileToPages(
        answerFile,
        (done, total) => setProgress(7 + (done / total) * 5),
      );

      setAnswerPages(answerImages);
      setQuestion((current) =>
        current ? { ...current, pages: questionImages.length } : current,
      );
      setAnswer((current) =>
        current ? { ...current, pages: answerImages.length } : current,
      );

      setStage("uploading");
      setProgress(12);

      const id = await createJob(questionImages, answerImages);
      const snapshot = await waitForJob(id, (update) => {
        setStage(update.stage);
        setProgress(Math.max(12, update.progress));
      });

      if (snapshot.status === "error" || !snapshot.result) {
        setError(snapshot.error ?? "Extraction failed");
        return;
      }

      const mapping = snapshot.result;
      setResult(mapping);
      setPage(1);

      const firstAnswered =
        mapping.questions.find((item) => item.regions.length > 0) ??
        mapping.questions[0];
      if (firstAnswered) {
        setSelected({ kind: "question", id: firstAnswered.id });
        setExpandedIds(new Set([firstAnswered.id]));
      }
      setView("mapping");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong while extracting",
      );
    }
  }, []);

  const selectItem = useCallback((selection: Selection) => {
    setSelected(selection);
    setExpandedIds((current) => new Set(current).add(selection.id));
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!result) return;
    const all = [
      ...result.questions.map((item) => item.id),
      ...result.unmatched.map((item) => item.id),
    ];
    setExpandedIds((current) =>
      current.size >= all.length ? new Set() : new Set(all),
    );
  }, [result]);

  return (
    <AppShell view={view}>
      {view === "upload" && (
        <UploadScreen
          question={question}
          answer={answer}
          onFile={handleFile}
          onRemove={handleRemove}
          onStart={startMapping}
        />
      )}

      {view === "extracting" && (
        <ExtractingScreen
          stage={stage}
          progress={progress}
          error={error}
          onRetry={reset}
        />
      )}

      {view === "mapping" && result && (
        <MappingScreen
          result={result}
          answerPages={answerPages}
          selected={selected}
          expandedIds={expandedIds}
          page={page}
          zoom={zoom}
          onSelect={selectItem}
          onToggle={toggleExpanded}
          onExpandAll={expandAll}
          onPage={setPage}
          onZoom={setZoom}
          onReset={reset}
        />
      )}
    </AppShell>
  );
}
