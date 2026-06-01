# JoSAA Rank Analysis Frontend MVP: Full Codex Implementation Spec

## Goal

Build a complete static React frontend for analyzing JoSAA opening and closing rank data.

The app will load preprocessed JoSAA cutoff data from JSON files, let the user enter a rank and filters, and show which options were historically possible or not possible.

This implementation must be frontend-only. Do not build a backend. Do not add a database.

The app must support:

1. Static JSON data loading.
2. Mandatory filters for year, round, rank, and rank basis.
3. Optional filters for institute, academic program, quota, seat type, gender pool, and rank type.
4. Cascading dynamic filters, where later dropdowns update based on earlier selections.
5. Submit-based rank analysis.
6. Possible rows in green.
7. Not possible rows in red.
8. Missing cutoff rows in grey.
9. Possible rows first, not possible rows second, no data rows last.
10. Result-level filtering after submit.
11. Sticky top filter panel.
12. Scrollable results table.
13. Sticky summary panel on the right.
14. Export visible results to CSV.
15. Clear instructions for where to place real data later.

---

## Tech Stack

Use:

- React
- Vite
- JavaScript
- Plain CSS

Do not use:

- TypeScript
- Backend
- Database
- Tailwind
- Heavy component libraries

---

## Setup

If the `frontend` folder does not exist, create a Vite React app:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install