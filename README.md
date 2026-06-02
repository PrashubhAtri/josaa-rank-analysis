# JoSAA Rank Analysis

**[Open the app →](https://example.com)** <!-- TODO: replace with the hosted link -->

**Check which IIT / NIT / IIIT / GFTI seats your JEE rank could have gotten you — based on real historical JoSAA closing data from 2021 to 2025.**

Enter your rank, pick a year and round, and the app shows every college-and-program option color-coded by whether that seat was historically within reach:

- 🟢 **Possible** — your rank was at or better than the closing rank
- 🔴 **Not possible** — the seat closed above your rank
- ⚪ **No data** — no cutoff was recorded for that combination

> ⚠️ This is a historical reference tool, not a prediction or an official source. Cutoffs shift every year — use it to understand the landscape, not to guarantee an outcome. Always verify against the [official JoSAA portal](https://josaa.nic.in).

## What you can do

- **Filter to what matters** — narrow by institute, program, quota, seat type, gender pool, and rank type. Dropdowns cascade, so later choices only show options that still apply.
- **Compare across years** — see how a seat's cutoff moved over 2021–2025.
- **Sort by reach** — possible options surface first, not-possible next, missing data last.
- **Refine results after searching** — filter and text-search within your results without re-running.
- **Export to CSV** — download exactly the rows you're looking at.
- **Share a search** — every search lives in the URL, so you can bookmark it or send it to someone.
- **Works on your phone** — the table collapses into readable cards on small screens.

## Data

Cutoffs are sourced from the official JoSAA counseling results and cover:

- **Years:** 2021, 2022, 2023, 2024, 2025
- **Rounds:** up to 6 per year
- **Ranks:** opening and closing ranks per category

---

## Running it locally

You only need this if you want to develop the app — most people just use the hosted version.

**Prerequisites:** Node.js 18+

You do **not** need Python to run the app. The frontend is a static React/Vite app that reads already-generated JSON from `frontend/public/data/`. Python is only used when you want to scrape, clean, or rebuild those JSON data files.

```bash
cd frontend
npm install
npm run dev          # start the dev server (Vite)
```

Then open the URL Vite prints (usually http://localhost:5173).

Other commands:

```bash
npm run build        # production build → frontend/dist/
npm run preview      # preview the production build locally
```

## Regenerating the data

The app reads pre-built JSON from `frontend/public/data/`. Those files are generated from the raw CSVs in `data/raw/` — you only need this if the underlying data changes.

**Prerequisites:** Python 3.9+, then:

```bash
pip install -r data/requirements.txt
playwright install        # only needed for scraping (fetch.py)
```

The pipeline runs in three stages from the repo root:

```bash
python3 data/fetch.py                # 1. scrape JoSAA → data/raw/*.csv
python3 data/fix.py                  # 2. clean the raw CSVs
python3 data/build_static_data.py    # 3. CSV → frontend/public/data/*.json
```

Stage 3 (`build_static_data.py`) uses only the Python standard library and is the one to re-run after any change to `data/raw/`.

## Project structure

```
data/                       # data pipeline (Python)
  fetch.py                  #   scrape JoSAA → raw CSV
  fix.py                    #   clean CSVs
  build_static_data.py      #   CSV → static JSON the app serves
  raw/                      #   scraped cutoff CSVs (source data)
frontend/                   # React + Vite app (TypeScript, plain CSS)
  src/                      #   App.tsx, main.tsx, styles.css
  public/data/              #   generated JSON the app fetches at runtime
```

## Tech

React · Vite · TypeScript · plain CSS — no backend, no database. The deployed app is fully static.
