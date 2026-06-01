from playwright.sync_api import sync_playwright
import pandas as pd
from io import StringIO
from pathlib import Path
import re
from datetime import datetime
import argparse


URL = "https://josaa.admissions.nic.in/applicant/seatmatrix/openingclosingrankarchieve.aspx"

OUTPUT_DIR = Path("raw")

YEAR_SELECTOR = "#ctl00_ContentPlaceHolder1_ddlYear"
ROUND_SELECTOR = "#ctl00_ContentPlaceHolder1_ddlroundno"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Manually capture JoSAA opening-closing rank table after selecting filters in browser."
    )

    parser.add_argument(
        "--year",
        required=True,
        help="Year metadata to store in CSV. Example: 2025",
    )

    parser.add_argument(
        "--round",
        required=True,
        dest="round_no",
        help="Round metadata to store in CSV. Example: 6",
    )

    return parser.parse_args()


def sanitize_filename(value: str) -> str:
    value = str(value).strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "unknown"


def clean_rank_value(value):
    """
    Converts:
    123 -> 123
    '123' -> 123
    '123P' -> 123
    '' -> None
    NaN -> None
    """

    if pd.isna(value):
        return None

    value = str(value).strip()

    if value == "" or value.lower() in {"nan", "none", "-"}:
        return None

    value = value.replace(",", "")

    numeric_part = re.sub(r"[^0-9]", "", value)

    if numeric_part == "":
        return None

    return int(numeric_part)


def has_preparatory_suffix(value) -> bool:
    if pd.isna(value):
        return False

    return str(value).strip().upper().endswith("P")


def get_rank_type(seat_type: str) -> str:
    seat_type_upper = str(seat_type).upper().strip()

    if "PWD" in seat_type_upper:
        return "PWD_CATEGORY_RANK"

    if seat_type_upper == "OPEN":
        return "CRL"

    return "CATEGORY_RANK"


def normalize_text_column(series: pd.Series) -> pd.Series:
    return (
        series.fillna("")
        .astype(str)
        .str.strip()
        .replace({"nan": "", "None": ""})
    )


def normalize_columns(df: pd.DataFrame, year: str, round_no: str) -> pd.DataFrame:
    """
    Converts JoSAA result table into a stable analysis-friendly format.

    Final columns:
    year
    round_no
    institute
    academic_program
    quota
    seat_type
    gender_pool
    opening_rank
    closing_rank
    opening_rank_is_preparatory
    closing_rank_is_preparatory
    rank_type
    """

    df = df.dropna(how="all")
    df = df.dropna(axis=1, how="all")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [
            " ".join(str(x).strip() for x in col if str(x).lower() != "nan").strip()
            for col in df.columns
        ]

    df.columns = [str(c).strip() for c in df.columns]

    rename_map = {}

    for col in df.columns:
        normalized = col.lower().strip()

        if normalized == "institute" or normalized.endswith("institute"):
            rename_map[col] = "institute"

        elif "academic" in normalized and "program" in normalized:
            rename_map[col] = "academic_program"

        elif normalized == "program" or "program name" in normalized:
            rename_map[col] = "academic_program"

        elif normalized == "quota":
            rename_map[col] = "quota"

        elif "seat" in normalized and "type" in normalized:
            rename_map[col] = "seat_type"

        elif "gender" in normalized:
            rename_map[col] = "gender_pool"

        elif "opening" in normalized and "rank" in normalized:
            rename_map[col] = "opening_rank_raw"

        elif "closing" in normalized and "rank" in normalized:
            rename_map[col] = "closing_rank_raw"

    df = df.rename(columns=rename_map)

    required_columns = [
        "institute",
        "academic_program",
        "quota",
        "seat_type",
        "gender_pool",
        "opening_rank_raw",
        "closing_rank_raw",
    ]

    missing = [col for col in required_columns if col not in df.columns]

    if missing:
        print("\nColumns found in table:")
        for col in df.columns:
            print(f" - {col}")

        raise ValueError(f"Missing expected columns: {missing}")

    cleaned = pd.DataFrame()

    cleaned["year"] = int(year)
    cleaned["round_no"] = int(round_no)

    cleaned["institute"] = normalize_text_column(df["institute"])
    cleaned["academic_program"] = normalize_text_column(df["academic_program"])
    cleaned["quota"] = normalize_text_column(df["quota"])
    cleaned["seat_type"] = normalize_text_column(df["seat_type"])
    cleaned["gender_pool"] = normalize_text_column(df["gender_pool"])

    cleaned["opening_rank"] = df["opening_rank_raw"].apply(clean_rank_value)
    cleaned["closing_rank"] = df["closing_rank_raw"].apply(clean_rank_value)

    cleaned["opening_rank_is_preparatory"] = df["opening_rank_raw"].apply(has_preparatory_suffix)
    cleaned["closing_rank_is_preparatory"] = df["closing_rank_raw"].apply(has_preparatory_suffix)

    cleaned["rank_type"] = cleaned["seat_type"].apply(get_rank_type)

    cleaned = cleaned[
        (cleaned["institute"] != "")
        & (cleaned["academic_program"] != "")
        & (cleaned["quota"] != "")
        & (cleaned["seat_type"] != "")
        & (cleaned["gender_pool"] != "")
    ]

    cleaned = cleaned.drop_duplicates()

    return cleaned


def extract_all_tables(page):
    tables = page.locator("table")
    table_count = tables.count()

    if table_count == 0:
        raise RuntimeError("No tables found on the page. Did you click Submit?")

    candidates = []

    for i in range(table_count):
        html = tables.nth(i).inner_html()

        try:
            dfs = pd.read_html(StringIO(f"<table>{html}</table>"))
        except ValueError:
            continue

        for df in dfs:
            if df.shape[0] > 0 and df.shape[1] > 0:
                candidates.append((i, df))

    if not candidates:
        raise RuntimeError("Tables were found, but none could be parsed by pandas.")

    return candidates


def pick_result_table(candidates):
    """
    Pick the table that most likely contains the JoSAA OR-CR result data.
    """

    best = None
    best_score = -1

    keywords = [
        "Institute",
        "Academic",
        "Program",
        "Quota",
        "Seat",
        "Gender",
        "Opening",
        "Closing",
        "Rank",
    ]

    for index, df in candidates:
        columns_text = " ".join(str(c) for c in df.columns)
        sample_text = df.head(10).to_string()

        combined = f"{columns_text} {sample_text}"

        score = sum(1 for keyword in keywords if keyword.lower() in combined.lower())

        score += min(df.shape[0], 200) * 0.01
        score += df.shape[1] * 0.1

        if score > best_score:
            best_score = score
            best = (index, df)

    if best is None:
        raise RuntimeError("Could not identify result table.")

    return best


def main():
    args = parse_args()

    year = args.year.strip()
    round_no = args.round_no.strip()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        page.goto(URL, wait_until="domcontentloaded", timeout=60000)

        print("\nBrowser opened.")
        print("Manually select filters on the JoSAA page.")
        print(f"Make sure you select Year = {year} and Round = {round_no}.")
        print("Then click Submit on the website.")

        input("\nAfter the result table appears, come back here and press Enter... ")

        candidates = extract_all_tables(page)

        print(f"\nParsed {len(candidates)} table candidate(s).")

        table_index, raw_df = pick_result_table(candidates)

        print(f"Using table index: {table_index}")
        print(f"Raw table shape: {raw_df.shape}")

        cleaned_df = normalize_columns(raw_df, year, round_no)

        print(f"Cleaned table shape: {cleaned_df.shape}")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        output_file = (
            f"josaa_"
            f"{sanitize_filename(year)}_"
            f"round_{sanitize_filename(round_no)}_"
            f"manual_{timestamp}.csv"
        )

        output_path = OUTPUT_DIR / output_file

        cleaned_df.to_csv(output_path, index=False)

        print("\nSaved clean CSV:")
        print(output_path)

        print("\nPreview:")
        print(cleaned_df.head(10).to_string(index=False))

        browser.close()


if __name__ == "__main__":
    main()