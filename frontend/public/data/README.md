# JoSAA Static Data

Place production cutoff data in this folder as yearly JSON files plus a manifest.
The app also uses `search-index.json` for preprocessed searchable aliases and option matching.

The app can run without Python as long as these generated JSON files are present.
Python is only needed to rebuild this folder from CSV source data.

Each yearly cutoff file is a compact JSON object with:

- `columns`: field names
- `rows`: arrays whose values follow the column order

The fields are:

- `year`
- `round_no`
- `institute`
- `academic_program`
- `quota`
- `seat_type`
- `gender_pool`
- `opening_rank`
- `closing_rank`
- `opening_rank_is_preparatory`
- `closing_rank_is_preparatory`
- `rank_type`

To rebuild from CSV files in this repository, run this from the repository root:

```bash
python3 data/build_static_data.py
```

The script reads `data/raw/*.csv` and writes:

- `frontend/public/data/manifest.json`
- `frontend/public/data/cutoffs-YYYY.json`
- `frontend/public/data/search-index.json`
