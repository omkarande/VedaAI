# Features

Product behaviour for the VedaAI exam mapper. New work should be recorded here.

> **Beyond the brief.** Multi-file upload, length-vs-marks grading, streaming jobs, OpenRouter 429 fallback, number normalisation, and the rest of the candidate-added work are listed up front in [README.md — Beyond the brief](README.md#beyond-the-brief). That section is the extras list for a human or AI reviewer. This file is the behaviour spec.

## Upload

- Teachers upload a **question paper** and a **student answer sheet** before mapping starts.
- Each side accepts a **PDF** or **images** (JPG, PNG, and other `image/*` types).
- **Multi-file upload:** either drop zone can take more than one file. If the question paper or answer sheet was photographed as separate images (page 1, page 2, …), add every photo. Files are read in the order they were added and treated as consecutive pages of one document.
- Mix PDFs and images on the same side if needed; pages are concatenated in upload order.
- Add more files after the first with **Add another image or PDF**, or drag more onto the same zone. Remove a file with its × without clearing the rest.
- Limits: **10MB per file**, up to **20 files** per side.
- Start Mapping stays disabled until both sides have at least one file.

## Extraction and mapping

- Browser rasterises PDFs and images to page JPEGs, then the API runs Gemini: questions → answers with bounding boxes → two-pass mapping → grading.
- Questions keep printed order and numbering, including sub-parts such as `11 (a)` / `11 (b)`.
- Answers may be out of order, unlabelled, unanswered, or unmatched; unmatched writing is still shown.
- The mapping screen highlights the exact region on the sheet, including answers that span multiple pages.

## Grading and feedback

- Each mapped question gets a score out of the printed marks and short AI feedback for the student.
- **Short answers vs marks:** if the transcribed answer is too short for the marks allocated, marks are reduced and the feedback **must** say so.
  - 1-mark questions may be a word or short phrase; length is not penalised.
  - 2-mark answers with fewer than 3 words are treated as too short.
  - 3+ mark questions expect roughly **4 words per mark** as a floor (for example a 5-mark answer under 20 words).
  - The model is instructed not to give full marks for a one-line answer on a high-mark question even when that line is correct, and to mention missing explanation or working.
  - A second pass caps the score if the model still awarded too much, and appends a length note when feedback omitted it (for example: *This answer is too short for a 5-mark question (8 words); more explanation or working was needed for full marks.*).
- Correct content still receives partial credit; length only prevents an underdeveloped answer from scoring as complete.

## Review UI

- Split view: question list with scores and feedback on one side, answer-sheet pages with highlight overlays on the other.
- Click a question to jump to its region. Multi-page answers note that they continue across pages.
