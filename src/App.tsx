"use client";

import { useCallback, useRef, useState } from "react";
import AppShell from "./components/AppShell";
import ExtractingScreen from "./components/ExtractingScreen";
import MappingScreen from "./components/MappingScreen";
import UploadScreen from "./components/UploadScreen";
import { runJob } from "./lib/api";
import { MAX_FILES_PER_SLOT, toUploadedFile } from "./lib/uploads";
import type {
  AppView,
  JobStatus,
  MappingResult,
  PageImage,
  UploadedFile,
} from "./types";

type Slot = "question" | "answer";
type Selection = { kind: "question" | "unmatched"; id: string };
type SlotFile = { id: string; file: File };

export default function App() {
  const [view, setView] = useState<AppView>("upload");
  const [question, setQuestion] = useState<UploadedFile[]>([]);
  const [answer, setAnswer] = useState<UploadedFile[]>([]);

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

  const files = useRef<{ question: SlotFile[]; answer: SlotFile[] }>({
    question: [],
    answer: [],
  });

  const handleAdd = useCallback(async (slot: Slot, incoming: File[]) => {
    const apply = slot === "question" ? setQuestion : setAnswer;
    const remaining = MAX_FILES_PER_SLOT - files.current[slot].length;
    const accepted = incoming.slice(0, Math.max(0, remaining));
    if (!accepted.length) return;

    const additions: SlotFile[] = [];
    const uploaded: UploadedFile[] = [];
    for (const file of accepted) {
      const meta = toUploadedFile(file);
      additions.push({ id: meta.id, file });
      uploaded.push(meta);
    }

    files.current[slot] = [...files.current[slot], ...additions];
    apply((current) => [...current, ...uploaded]);

    try {
      const { countPages } = await import("./lib/renderPages");
      for (const item of additions) {
        try {
          const pages = await countPages(item.file);
          if (!files.current[slot].some((entry) => entry.id === item.id)) {
            continue;
          }
          apply((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, pages } : entry,
            ),
          );
        } catch {
          // Page count is cosmetic; rendering will surface any real problem.
        }
      }
    } catch {
      // Same as above — a failed count does not block mapping.
    }
  }, []);

  const handleRemove = useCallback((slot: Slot, id: string) => {
    files.current[slot] = files.current[slot].filter((entry) => entry.id !== id);
    if (slot === "question") {
      setQuestion((current) => current.filter((entry) => entry.id !== id));
    } else {
      setAnswer((current) => current.filter((entry) => entry.id !== id));
    }
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
    const questionFiles = files.current.question.map((entry) => entry.file);
    const answerFiles = files.current.answer.map((entry) => entry.file);
    if (!questionFiles.length || !answerFiles.length) return;

    setView("extracting");
    setError(null);
    setStage("rendering");
    setProgress(2);

    try {
      const { renderFilesToPages } = await import("./lib/renderPages");
      const questionImages = await renderFilesToPages(
        questionFiles,
        (done, total) => setProgress(2 + (done / total) * 5),
      );
      const answerImages = await renderFilesToPages(
        answerFiles,
        (done, total) => setProgress(7 + (done / total) * 5),
      );

      setAnswerPages(answerImages);

      setStage("uploading");
      setProgress(12);

      const mapping = await runJob(questionImages, answerImages, (update) => {
        setStage(update.stage);
        setProgress(Math.max(12, update.progress));
      });

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
          onAdd={handleAdd}
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
