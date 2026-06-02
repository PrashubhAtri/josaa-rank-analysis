import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_DIR = ROOT / "frontend" / "public" / "data"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
SEARCH_INDEX_PATH = ROOT / "frontend" / "public" / "data" / "search-index.json"


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

SEARCH_FIELDS = [
    "institute",
    "academic_program",
    "quota",
    "seat_type",
    "gender_pool",
    "rank_type",
]

STOPWORDS = {"and", "of", "the", "for", "in", "to", "with", "including"}

FIELD_ALIASES = {
    "institute": {
        "iit": ["indian institute of technology"],
        "nit": ["national institute of technology"],
        "iiit": ["indian institute of information technology"],
        "gfti": ["government funded technical institute", "central university", "institute"],
        "bit": ["birla institute of technology"],
    },
    "academic_program": {
        "cs": [
            "computer science",
            "computer science and engineering",
            "cse",
            "computing",
            "computational",
            "software",
            "information technology",
            "information systems",
            "artificial intelligence",
            "machine learning",
            "data science",
            "mathematics and computing",
        ],
        "cse": ["computer science", "computer science and engineering", "cs"],
        "ai": ["artificial intelligence", "machine learning", "data science"],
        "ml": ["machine learning", "artificial intelligence"],
        "ds": ["data science", "data analytics"],
        "it": ["information technology", "information systems"],
        "ece": ["electronics and communication", "electronics communication"],
        "ee": ["electrical engineering", "electrical"],
        "eee": ["electrical and electronics", "electrical electronics"],
        "mech": ["mechanical engineering", "mechanical"],
        "civil": ["civil engineering"],
        "chem": ["chemical engineering", "chemistry"],
        "aero": ["aerospace engineering", "aeronautical"],
        "bio": ["biotechnology", "bioengineering", "biological"],
        "math": ["mathematics", "mathematics and computing"],
        "mnc": ["mathematics and computing", "mathematics computing"],
        "phy": ["physics", "engineering physics"],
        "meta": ["metallurgical", "metallurgy", "materials"],
        "prod": ["production engineering", "industrial engineering"],
        "arch": ["architecture", "planning"],
    },
    "quota": {
        "ai": ["all india"],
        "hs": ["home state"],
        "os": ["other state"],
        "go": ["goa"],
        "jk": ["jammu kashmir"],
    },
    "seat_type": {
        "gen": ["open", "general"],
        "general": ["open"],
        "obc": ["obc ncl", "other backward class"],
        "ews": ["economically weaker section"],
        "sc": ["scheduled caste"],
        "st": ["scheduled tribe"],
        "pwd": ["persons with disabilities", "person with disability"],
    },
    "gender_pool": {
        "female": ["female only", "female-only", "supernumerary"],
        "girls": ["female only", "female-only", "supernumerary"],
        "neutral": ["gender neutral", "gender-neutral"],
        "all": ["gender neutral", "gender-neutral"],
    },
    "rank_type": {
        "crl": ["common rank list", "open rank"],
        "category": ["category rank"],
        "pwd": ["pwd category rank", "person with disability"],
    },
}


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


def normalize_for_search(value):
    text = str(value or "").lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def acronym_for(value):
    words = [word for word in normalize_for_search(value).split() if word not in STOPWORDS]
    return "".join(word[0] for word in words if word)


def option_search_text(field, value):
    normalized = normalize_for_search(value)
    terms = {normalized}

    acronym = acronym_for(value)
    if len(acronym) >= 2:
        terms.add(acronym)

    for alias, expansions in FIELD_ALIASES.get(field, {}).items():
        normalized_alias = normalize_for_search(alias)
        normalized_expansions = [normalize_for_search(expansion) for expansion in expansions]
        normalized_words = set(normalized.split())
        alias_matches = normalized_alias in normalized_words
        expansion_matches = any(
            expansion
            and (
                expansion in normalized_words
                if " " not in expansion and len(expansion) <= 3
                else expansion in normalized
            )
            for expansion in normalized_expansions
        )
        if alias_matches or expansion_matches:
            terms.add(normalized_alias)
            terms.update(normalized_expansions)

    return " ".join(sorted(term for term in terms if term))


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
    search_options = {field: set() for field in SEARCH_FIELDS}

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
                for field in SEARCH_FIELDS:
                    search_options[field].add(normalized[field])

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

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    legacy_output = OUTPUT_DIR / "cutoffs.json"
    if legacy_output.exists():
        legacy_output.unlink()

    rows_by_year = {}
    for row in rows:
        rows_by_year.setdefault(row["year"], []).append(row)

    manifest = {"years": []}
    for year, year_rows in sorted(rows_by_year.items()):
        filename = f"cutoffs-{year}.json"
        output_path = OUTPUT_DIR / filename
        compact_payload = {
            "columns": FIELDS,
            "rows": [[row[field] for field in FIELDS] for row in year_rows],
        }
        output_path.write_text(json.dumps(compact_payload, separators=(",", ":")), encoding="utf-8")
        manifest["years"].append({"year": year, "file": filename, "rows": len(year_rows)})

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    search_index = {
        field: {
            value: option_search_text(field, value)
            for value in sorted(values, key=lambda item: str(item).lower())
        }
        for field, values in search_options.items()
    }
    SEARCH_INDEX_PATH.write_text(json.dumps(search_index, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Wrote {len(rows)} rows across {len(rows_by_year)} yearly cutoff files in {OUTPUT_DIR}")
    print(f"Wrote manifest to {MANIFEST_PATH}")
    print(f"Wrote search index to {SEARCH_INDEX_PATH}")


if __name__ == "__main__":
    main()
