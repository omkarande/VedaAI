# VedaAI — AI Assessment Extraction & Answer Mapping

A teacher uploads a **question paper** and **one student's handwritten answer sheet**. The app extracts every question, reads the handwritten answers, maps each answer to its question, highlights the exact region on the sheet, and grades with per-question feedback.

Built with **Next.js** (App Router), React, Tailwind CSS, and Google Gemini.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000

Put your key in `.env.local` (or `.env`):

```
GEMINI_API_KEY=your_key_here
```

Get a free key at https://aistudio.google.com/apikey

## Approach

1. **Rendering happens in the browser.** PDFs and images are turned into page images with `pdfjs-dist`, so the server needs no native PDF tooling. The same images drive the review pane, which is why highlight boxes line up with what the model saw.
2. **Questions are extracted in printed order.** Original numbering is kept. Labelled sub-parts (`11 (a)`, `11 (b)`) are separate entries.
3. **Answers are extracted with bounding boxes.** An answer that crosses a page break keeps a region on each page.
4. **Mapping is two passes.** First by the number the student wrote; then, for unlabelled answers, by meaning. Anything still unmatched is shown instead of dropped.
5. **Grading** produces marks, status, per-question feedback, and an overall summary.

Jobs live in memory on the Next.js server (`POST /api/jobs`, poll `GET /api/jobs/:id`). No database.

## Deploy

This is one Next.js app. Vercel is the straightforward host:

1. Set `GEMINI_API_KEY` in the project environment.
2. Deploy. Gemini can take longer than a short serverless timeout — if jobs die mid-run, use a long-running Node host (`next start` on Render/Fly) or raise the function `maxDuration`.

Optional brand files (overrides placeholders): `public/brand/logo.png`, `teacher.png`, `crest.png`, `avatar.png`.

## Assumptions

- One student's answer sheet per run.
- A server restart clears in-memory jobs.
- Bounding boxes come from the model on a 0–1000 grid; they are tight but not pixel-perfect on dense handwriting.
- Files are capped at 10MB and pages are downscaled to 1600px on the long edge for the free-tier model.
