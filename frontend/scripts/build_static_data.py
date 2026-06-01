import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_PATH = ROOT / "frontend" / "public" / "data" / "cutoffs.json"


FIELDS = [
    "year",
    "round_no",
    "institute",
    "academic_program",
    "quota",
    "seat_type",
    "gender_pool",
    "opening_rank",
    "closing_rank",
    "opening_rank_is_preparatory",
    "closing_rank_is_preparatory",
    "rank_type",
]


def clean_rank(value):
    text = str(value or "").strip().replace(",", "")
    digits = re.sub(r"[^0-9]", "", text)
    return int(digits) if digits else None


def clean_bool(value):
    return str(value or "").strip().lower() in {"true", "1", "yes", "y"}


def rank_type_for(seat_type):
    value = str(seat_type or "").strip().upper()
    if "PWD" in value:
        return "PWD_CATEGORY_RANK"
    if value == "OPEN":
        return "CRL"
    return "CATEGORY_RANK"


def metadata_from_name(path):
    match = re.search(r"josaa_(\d{4})_round_(\d+)", path.name)
    if not match:
        raise ValueError(f"Cannot parse year/round from {path.name}")
    return int(match.group(1)), int(match.group(2))


def normalize_row(row, fallback_year, fallback_round):
    year = row.get("year") or fallback_year
    round_no = row.get("round_no") or fallback_round
    opening_rank_raw = row.get("opening_rank")
    closing_rank_raw = row.get("closing_rank")
    seat_type = str(row.get("seat_type") or "").strip()

    normalized = {
        "year": int(float(year)),
        "round_no": int(float(round_no)),
        "institute": str(row.get("institute") or "").strip(),
        "academic_program": str(row.get("academic_program") or "").strip(),
        "quota": str(row.get("quota") or "").strip(),
        "seat_type": seat_type,
        "gender_pool": str(row.get("gender_pool") or "").strip(),
        "opening_rank": clean_rank(opening_rank_raw),
        "closing_rank": clean_rank(closing_rank_raw),
        "opening_rank_is_preparatory": clean_bool(row.get("opening_rank_is_preparatory")),
        "closing_rank_is_preparatory": clean_bool(row.get("closing_rank_is_preparatory")),
        "rank_type": str(row.get("rank_type") or rank_type_for(seat_type)).strip(),
    }

    required_text = [
        "institute",
        "academic_program",
        "quota",
        "seat_type",
        "gender_pool",
        "rank_type",
    ]
    if any(not normalized[field] for field in required_text):
        return None
    return normalized


def main():
    rows = []
    seen = set()

    for path in sorted(RAW_DIR.glob("*.csv")):
        year, round_no = metadata_from_name(path)
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                normalized = normalize_row(row, year, round_no)
                if not normalized:
                    continue
                key = tuple(normalized[field] for field in FIELDS)
                if key in seen:
                    continue
                seen.add(key)
                rows.append(normalized)

    rows.sort(
        key=lambda item: (
            item["year"],
            item["round_no"],
            item["institute"],
            item["academic_program"],
            item["quota"],
            item["seat_type"],
            item["gender_pool"],
            item["rank_type"],
        )
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
