import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import type {
  MappingResult,
  PageImage,
  QuestionStatus,
  Region,
} from "../types";

type Selection = { kind: "question" | "unmatched"; id: string };

type MappingScreenProps = {
  result: MappingResult;
  answerPages: PageImage[];
  selected: Selection;
  expandedIds: Set<string>;
  page: number;
  zoom: number;
  onSelect: (selection: Selection) => void;
  onToggle: (id: string) => void;
  onExpandAll: () => void;
  onPage: (page: number) => void;
  onZoom: (zoom: number) => void;
  onReset: () => void;
};

const SHEET_BASE_WIDTH = 620;

function scoreClass(status: QuestionStatus) {
  if (status === "correct") return "bg-[#e6f7ed] text-[#1f9d55]";
  if (status === "partial") return "bg-[#fff3e2] text-[#e0891a]";
  if (status === "incorrect") return "bg-[#fdeaea] text-[#e24b4b]";
  return "bg-[#f1f1f1] text-[#8a8a8a]";
}

/** "11 (b)" renders as a "11" badge beside a "b." sub-label, as in the design. */
function splitNumber(number: string) {
  const match = number
    .trim()
    .match(/^(\d+)\s*[.)]?\s*[([{]?\s*([a-z]|[ivx]+)\s*[)\]}]?\.?$/i);
  if (match) return { main: match[1], sub: `${match[2].toLowerCase()}.` };
  return { main: number, sub: null };
}

export default function MappingScreen({
  result,
  answerPages,
  selected,
  expandedIds,
  page,
  zoom,
  onSelect,
  onToggle,
  onExpandAll,
  onPage,
  onZoom,
  onReset,
}: MappingScreenProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const { questions, unmatched, summary } = result;
  const pageCount = Math.max(answerPages.length, 1);

  const activeRegions = useMemo(() => {
    if (selected.kind === "question") {
      return questions.find((item) => item.id === selected.id)?.regions ?? [];
    }
    return unmatched.find((item) => item.id === selected.id)?.regions ?? [];
  }, [questions, selected, unmatched]);

  const activeLabel = useMemo(() => {
    if (selected.kind === "unmatched") return "Unmatched";
    const question = questions.find((item) => item.id === selected.id);
    return question ? `Q${question.number}` : "";
  }, [questions, selected]);

  const scrollToPage = useCallback((target: number, smooth = true) => {
    const viewer = viewerRef.current;
    const element = pageRefs.current.get(target);
    if (!viewer || !element) return;
    const offset =
      viewer.scrollTop +
      element.getBoundingClientRect().top -
      viewer.getBoundingClientRect().top;
    viewer.scrollTo({ top: offset - 12, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Page heights are only known once the images have decoded, so scrolling is
  // held back until then; otherwise every offset would be measured against
  // zero-height pages.
  const [pagesReady, setPagesReady] = useState(false);
  const loadedPages = useRef(0);
  const handlePageLoad = useCallback(() => {
    loadedPages.current += 1;
    if (loadedPages.current >= answerPages.length) setPagesReady(true);
  }, [answerPages.length]);

  // Bring the selected answer into view. Keyed on the selection id so that
  // scrolling through a multi-page answer is never yanked back to its start.
  const lastSelectionId = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!pagesReady || lastSelectionId.current === selected.id) return;

    const region = activeRegions[0];
    const viewer = viewerRef.current;
    const element = region ? pageRefs.current.get(region.page) : null;
    if (!region || !viewer || !element) return;

    lastSelectionId.current = selected.id;
    const rect = element.getBoundingClientRect();
    const top =
      viewer.scrollTop +
      (rect.top - viewer.getBoundingClientRect().top) +
      (region.top / 100) * rect.height;
    viewer.scrollTo({
      top: Math.max(0, top - viewer.clientHeight * 0.25),
      behavior: "smooth",
    });
  }, [activeRegions, pagesReady, selected.id]);

  // Report whichever page is nearest the middle of the viewport.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let frame = 0;
    const handle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const middle =
          viewer.getBoundingClientRect().top + viewer.clientHeight / 2;
        let best = 1;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const [number, element] of pageRefs.current) {
          const rect = element.getBoundingClientRect();
          const distance = Math.abs(rect.top + rect.height / 2 - middle);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = number;
          }
        }
        onPage(best);
      });
    };

    viewer.addEventListener("scroll", handle, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      viewer.removeEventListener("scroll", handle);
    };
  }, [onPage]);

  const allExpanded = expandedIds.size >= questions.length + unmatched.length;

  return (
    <div className="grid h-full grid-cols-1 overflow-hidden rounded-2xl bg-white lg:grid-cols-[minmax(340px,44%)_1fr]">
      <section className="flex min-h-0 flex-col border-b border-[#ececec] bg-[#fbfbfb] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1c1c1c]">
            Extracted Questions{" "}
            <span className="font-normal text-[#8a8a8a]">
              (from question paper)
            </span>
          </h2>
          <button
            type="button"
            onClick={onExpandAll}
            className="shrink-0 rounded-full border border-[#e2e2e2] bg-white px-4 py-1.5 text-xs font-semibold text-[#3a3a3a] hover:bg-[#f6f6f6]"
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-6 max-lg:max-h-[46vh]">
          {questions.map((question) => {
            const isSelected =
              selected.kind === "question" && selected.id === question.id;
            const expanded = expandedIds.has(question.id);
            const unanswered = question.status === "unanswered";
            const { main, sub } = splitNumber(question.number);
            const pages = [
              ...new Set(question.regions.map((region) => region.page)),
            ];

            return (
              <article
                key={question.id}
                className={`rounded-2xl bg-white transition ${
                  isSelected
                    ? "border-2 border-[#f36b1c]"
                    : "border border-[#ededed]"
                }`}
              >
                <div className="flex items-start gap-3 p-3.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    onClick={() =>
                      onSelect({ kind: "question", id: question.id })
                    }
                  >
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                        isSelected ? "bg-[#f36b1c]" : "bg-[#2f2f2f]"
                      }`}
                    >
                      {main}
                    </span>
                    {sub && (
                      <span className="w-4 shrink-0 pt-1 text-xs font-bold text-[#2f2f2f]">
                        {sub}
                      </span>
                    )}
                    <p className="min-w-0 flex-1 pt-0.5 text-[13px] leading-[1.45] text-[#2a2a2a]">
                      {question.text}
                    </p>
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${scoreClass(question.status)}`}
                    >
                      {unanswered
                        ? `0 / ${question.max || 0}`
                        : `${question.awarded} / ${question.max}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mt-1 shrink-0 text-[#9a9a9a] hover:text-[#3a3a3a]"
                    aria-label={expanded ? "Collapse" : "Expand"}
                    onClick={() => onToggle(question.id)}
                  >
                    {expanded ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                </div>

                {expanded && (
                  <div className="px-3.5 pb-3.5">
                    <div className="rounded-xl bg-[#f6f6f6] p-3.5">
                      {unanswered ? (
                        <>
                          <p className="text-xs font-bold text-[#1c1c1c]">
                            Not answered
                          </p>
                          <p className="mt-1.5 text-xs leading-[1.6] text-[#6b6b6b]">
                            No matching answer was found anywhere on the answer
                            sheet.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-[#1c1c1c]">
                            AI Feedback
                          </p>
                          <p className="mt-1.5 text-xs leading-[1.6] text-[#6b6b6b]">
                            {question.feedback ??
                              "This answer was matched but no feedback was returned."}
                          </p>
                          {pages.length > 1 && (
                            <p className="mt-2.5 text-[11px] font-semibold text-[#f36b1c]">
                              Answer continues across pages {pages.join(" and ")}
                            </p>
                          )}
                          {question.answerText && (
                            <p className="mt-2.5 border-t border-[#e6e6e6] pt-2.5 text-[11px] leading-[1.6] text-[#8a8a8a]">
                              <span className="font-semibold text-[#6b6b6b]">
                                Student wrote:{" "}
                              </span>
                              {question.answerText}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {unmatched.length > 0 && (
            <div className="pt-3">
              <h3 className="pb-2 text-sm font-semibold text-[#1c1c1c]">
                Unmatched Answers{" "}
                <span className="font-normal text-[#8a8a8a]">
                  (no question found)
                </span>
              </h3>
              <div className="space-y-2.5">
                {unmatched.map((answer) => {
                  const isSelected =
                    selected.kind === "unmatched" && selected.id === answer.id;
                  return (
                    <button
                      key={answer.id}
                      type="button"
                      onClick={() =>
                        onSelect({ kind: "unmatched", id: answer.id })
                      }
                      className={`w-full rounded-2xl bg-white p-3.5 text-left transition ${
                        isSelected
                          ? "border-2 border-[#f36b1c]"
                          : "border border-[#ededed]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#fff1e8] text-xs font-bold text-[#f36b1c]">
                          ?
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-[1.45] text-[#2a2a2a]">
                            {answer.text}
                          </p>
                          <p className="mt-1 text-[11px] text-[#8a8a8a]">
                            {answer.label
                              ? `Student labelled this "${answer.label}", which is not on the paper`
                              : "No question number was written beside this answer"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-[#ededed] bg-white p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-[#1c1c1c]">Total score</p>
              <p className="text-lg font-extrabold text-[#1c1c1c]">
                {summary.awarded}
                <span className="text-sm font-medium text-[#8a8a8a]">
                  {" / "}
                  {summary.max}
                </span>
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-[#e6f7ed] px-2.5 py-1 font-semibold text-[#1f9d55]">
                {summary.answered} answered
              </span>
              <span className="rounded-full bg-[#fdeaea] px-2.5 py-1 font-semibold text-[#e24b4b]">
                {summary.unanswered} unanswered
              </span>
              <span className="rounded-full bg-[#fff1e8] px-2.5 py-1 font-semibold text-[#f36b1c]">
                {summary.unmatched} unmatched
              </span>
            </div>
            {summary.overall && (
              <p className="mt-3 text-xs leading-[1.6] text-[#6b6b6b]">
                {summary.overall}
              </p>
            )}
            <button
              type="button"
              onClick={onReset}
              className="mt-3 text-xs font-semibold text-[#f36b1c] hover:underline"
            >
              Start a new upload
            </button>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#ececec] px-5 py-3">
          <p className="text-sm font-semibold text-[#1c1c1c]">Answer Sheet</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-[#f4f4f4] p-1">
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded-full text-[#3a3a3a] hover:bg-white"
                onClick={() => onZoom(Math.max(60, zoom - 10))}
                aria-label="Zoom out"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-10 text-center text-xs font-semibold text-[#3a3a3a]">
                {zoom}%
              </span>
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded-full text-[#3a3a3a] hover:bg-white"
                onClick={() => onZoom(Math.min(200, zoom + 10))}
                aria-label="Zoom in"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#f4f4f4] p-1">
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded-full text-[#3a3a3a] hover:bg-white disabled:opacity-40"
                onClick={() => scrollToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className="px-1 text-xs font-semibold text-[#3a3a3a]">
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded-full text-[#3a3a3a] hover:bg-white disabled:opacity-40"
                onClick={() => scrollToPage(Math.min(pageCount, page + 1))}
                disabled={page >= pageCount}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        <div
          ref={viewerRef}
          className="min-h-0 flex-1 overflow-auto bg-[#f4f4f4] px-6 py-4"
        >
          <div
            className="mx-auto flex flex-col gap-4"
            style={{ width: `min(100%, ${(SHEET_BASE_WIDTH * zoom) / 100}px)` }}
          >
            {answerPages.map((item) => {
              // Every region of the current selection that falls on this page.
              const marks = activeRegions.filter(
                (region) => region.page === item.page,
              );
              const continues =
                activeRegions.length > 0 &&
                item.page !== activeRegions[0].page;

              return (
                <div
                  key={item.page}
                  ref={(node) => {
                    if (node) pageRefs.current.set(item.page, node);
                    else pageRefs.current.delete(item.page);
                  }}
                  className="relative overflow-hidden rounded-lg bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
                >
                  <img
                    src={item.dataUrl}
                    alt={`Answer sheet page ${item.page}`}
                    className="block w-full"
                    onLoad={handlePageLoad}
                    onError={handlePageLoad}
                  />
                  {marks.map((region, index) => (
                    <Highlight
                      key={`${selected.id}-${item.page}-${index}`}
                      region={region}
                      label={
                        continues ? `${activeLabel} (cont.)` : activeLabel
                      }
                      showLabel={index === 0}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Highlight({
  region,
  label,
  showLabel,
}: {
  region: Region;
  label: string;
  showLabel: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute rounded-lg border-2 border-[#22c55e] bg-[#22c55e]/10"
      style={{
        top: `${region.top}%`,
        left: `${region.left}%`,
        width: `${region.width}%`,
        height: `${region.height}%`,
      }}
    >
      {showLabel && (
        <span className="absolute -top-[18px] left-0 rounded-t-md bg-[#22c55e] px-2 py-[2px] text-[10px] font-bold leading-[14px] text-white">
          {label}
        </span>
      )}
    </div>
  );
}
