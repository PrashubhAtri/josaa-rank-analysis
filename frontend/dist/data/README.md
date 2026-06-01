# JoSAA Static Data

Place production cutoff data in this folder as `cutoffs.json`.

The app expects an array of objects with these fields:

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
python3 frontend/scripts/build_static_data.py
```

The script reads `data/raw/*.csv` and writes `frontend/public/data/cutoffs.json`.
