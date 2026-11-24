# Beast Academy To-Do

A kid-friendly checklist built from Beast Academy's planning sequence PDFs (Levels 4 and 5). Each lesson box
becomes tasks in the order **Guide → Online → Practice**; ticking the last task of a box celebrates and (optionally)
emails a parent.

- **Stack:** Vite + React + TypeScript, Netlify Functions, MongoDB Atlas.
- **Importer:** `npm run import:plan` converts the PDFs in `source-pdfs/` (not committed) into `src/data/level{4,5}.json`.
  Download the PDFs first:
  - https://beastacademy.com/u/pdfs/planning/sequence/BA4Sequence.pdf
  - https://beastacademy.com/u/pdfs/planning/sequence/BA5Sequence.pdf

  Problem numbers the official sequence skips are added as "Extra practice" boxes (see `scripts/gaps.mjs`).
- **Tests:** `npm test` (parser and gap logic).
- **Local dev:** copy `.env.example` to `.env`, then `netlify dev`.
- **Env vars:** `MONGODB_URI`, `MONGODB_DB`, `APP_PIN` (optional family PIN), `RESEND_API_KEY` / `NOTIFY_TO` /
  `NOTIFY_FROM` (optional completion email; without them completions are only logged).
