import type { GroupedRow } from "../types";

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function downloadCsv(rows: GroupedRow[]) {
  const columns = [
    "status",
    "year",
    "rounds_label",
    "institute",
    "academic_program",
    "quota",
    "seat_type",
    "gender_pool",
    "rank_type",
    "opening_rank",
    "closing_rank",
    "cutoff_rank",
  ];
  const csv = [columns.join(","), ...rows.map((row) => columns.map((key) => csvEscape(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "josaa-visible-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}
