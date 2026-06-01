import pandas as pd
from pathlib import Path
import argparse
import re


EXPECTED_COLUMNS = [
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


def parse_args():
    parser = argparse.ArgumentParser(
        description="Fix already collected JoSAA CSV files by filling missing year and round_no."
    )

    parser.add_argument(
        "--input",
        required=True,
        help="Path to existing CSV file or folder containing CSV files.",
    )

    parser.add_argument(
        "--year",
        required=True,
        help="Year to fill. Example: 2025",
    )

    parser.add_argument(
        "--round",
        required=True,
        dest="round_no",
        help="Round number to fill. Example: 6",
    )

    parser.add_argument(
        "--output-dir",
        default="data/fixed",
        help="Folder where fixed CSV files will be saved. Default: data/fixed",
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite the input file instead of writing to output-dir.",
    )

    return parser.parse_args()


def clean_rank_value(value):
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


def fix_bool_value(value):
    if pd.isna(value):
        return False

    value = str(value).strip().lower()

    return value in {"true", "1", "yes", "y"}


def get_rank_type(seat_type: str) -> str:
    seat_type_upper = str(seat_type).upper().strip()

    if "PWD" in seat_type_upper:
        return "PWD_CATEGORY_RANK"

    if seat_type_upper == "OPEN":
        return "CRL"

    return "CATEGORY_RANK"


def fix_one_csv(input_path: Path, year: str, round_no: str, output_dir: Path, overwrite: bool):
    df = pd.read_csv(input_path)

    # Case 1: already clean format but year/round missing
    if "year" in df.columns:
        df["year"] = df["year"].fillna(year)
        df.loc[df["year"].astype(str).str.strip().isin(["", "nan", "None"]), "year"] = year
    else:
        df.insert(0, "year", year)

    if "round_no" in df.columns:
        df["round_no"] = df["round_no"].fillna(round_no)
        df.loc[df["round_no"].astype(str).str.strip().isin(["", "nan", "None"]), "round_no"] = round_no
    else:
        df.insert(1, "round_no", round_no)

    df["year"] = df["year"].astype(int)
    df["round_no"] = df["round_no"].astype(int)

    # Normalize rank columns if present
    if "opening_rank" in df.columns:
        df["opening_rank"] = df["opening_rank"].apply(clean_rank_value)

    if "closing_rank" in df.columns:
        df["closing_rank"] = df["closing_rank"].apply(clean_rank_value)

    # Normalize boolean columns if present
    if "opening_rank_is_preparatory" in df.columns:
        df["opening_rank_is_preparatory"] = df["opening_rank_is_preparatory"].apply(fix_bool_value)
    else:
        df["opening_rank_is_preparatory"] = False

    if "closing_rank_is_preparatory" in df.columns:
        df["closing_rank_is_preparatory"] = df["closing_rank_is_preparatory"].apply(fix_bool_value)
    else:
        df["closing_rank_is_preparatory"] = False

    # Add rank_type if missing
    if "rank_type" not in df.columns and "seat_type" in df.columns:
        df["rank_type"] = df["seat_type"].apply(get_rank_type)

    # Reorder columns if possible
    existing_expected = [col for col in EXPECTED_COLUMNS if col in df.columns]
    other_columns = [col for col in df.columns if col not in existing_expected]
    df = df[existing_expected + other_columns]

    df = df.drop_duplicates()

    if overwrite:
        output_path = input_path
    else:
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / input_path.name

    df.to_csv(output_path, index=False)

    print(f"Fixed: {input_path} -> {output_path}")
    print(f"Rows: {len(df)}")


def main():
    args = parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)

    if input_path.is_file():
        csv_files = [input_path]
    elif input_path.is_dir():
        csv_files = sorted(input_path.glob("*.csv"))
    else:
        raise FileNotFoundError(f"Input path does not exist: {input_path}")

    if not csv_files:
        raise RuntimeError(f"No CSV files found at: {input_path}")

    for csv_file in csv_files:
        fix_one_csv(
            input_path=csv_file,
            year=args.year,
            round_no=args.round_no,
            output_dir=output_dir,
            overwrite=args.overwrite,
        )


if __name__ == "__main__":
    main()