import { optionalFilterOrder } from "../config/filters";
import type {
  AnalyzedRow,
  AnalyzedRound,
  CutoffPayload,
  CutoffRow,
  Filters,
  GroupedRow,
  OptionalFilterKey,
  RankBasis,
  RankValue,
  ResultStatus,
  Status,
  SubmittedFilters,
} from "../types";
import { selectedValues } from "./search";

export function sortText(values: Iterable<RankValue>) {
  return [...values].map(String).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function rankSortValue(value: RankValue) {
  return value == null || Number.isNaN(Number(value)) ? Number.POSITIVE_INFINITY : Number(value);
}

export function compareAnalyzedRows(a: AnalyzedRow, b: AnalyzedRow) {
  const order = { possible: 0, "not-possible": 1, "no-data": 2 };
  return (
    order[a.status] - order[b.status] ||
    rankSortValue(a.cutoff_rank) - rankSortValue(b.cutoff_rank) ||
    rankSortValue(a.opening_rank) - rankSortValue(b.opening_rank) ||
    rankSortValue(a.closing_rank) - rankSortValue(b.closing_rank) ||
    String(a.institute).localeCompare(String(b.institute)) ||
    String(a.academic_program).localeCompare(String(b.academic_program))
  );
}

function roundStatusOrder(status: Status) {
  return { possible: 0, "not-possible": 1, "no-data": 2 }[status] ?? 3;
}

function groupKey(row: CutoffRow) {
  return [
    row.institute,
    row.academic_program,
    row.quota,
    row.seat_type,
    row.gender_pool,
    row.rank_type,
  ].join("\u001f");
}

export function formatRank(value: RankValue) {
  return value == null || !Number.isFinite(Number(value)) ? "-" : Number(value).toLocaleString();
}

export function formatBuffer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return value >= 0 ? `+${formatRank(value)}` : formatRank(value);
}

function bufferLabel(value: number | null | undefined, status: Status) {
  if (status === "no-data" || value == null || !Number.isFinite(Number(value))) return "No data";
  if (value >= 1000) return "Safe";
  if (value >= 0) return "Close";
  return "Reach";
}

function minRank(values: RankValue[]) {
  const numericValues = values.map(Number).filter(Number.isFinite);
  return numericValues.length ? Math.min(...numericValues) : null;
}

function summarizeRounds(rounds: AnalyzedRound[]) {
  return rounds
    .map((round) => `${round.year} R${round.round_no}: ${formatRank(round.opening_rank)}-${formatRank(round.closing_rank)} (${statusLabel(round.status)})`)
    .join("; ");
}

export function roundChipLabel(round: AnalyzedRound, showYear: boolean) {
  const prefix = showYear ? `${round.year} R${round.round_no}` : `R${round.round_no}`;
  return `${prefix} ${formatRank(round.opening_rank)}-${formatRank(round.closing_rank)}`;
}

export function groupAnalyzedRows(rows: AnalyzedRow[], rank: number) {
  const groups = new Map<string, GroupedRow>();

  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) {
      groups.set(key, {
        ...row,
        opening_rank: null,
        closing_rank: null,
        cutoff_rank: null,
        status: "no-data",
        rounds: [],
        round_count: 0,
        rounds_label: "",
        buffer: null,
        buffer_label: "No data",
      });
    }

    const group = groups.get(key)!;
    group.rounds.push({
      year: row.year,
      round_no: row.round_no,
      opening_rank: row.opening_rank,
      closing_rank: row.closing_rank,
      cutoff_rank: row.cutoff_rank,
      buffer: row.cutoff_rank == null ? null : Number(row.cutoff_rank) - rank,
      status: row.status,
    });
  }

  return [...groups.values()].map<GroupedRow>((group) => {
    const rounds = group.rounds.sort((a, b) => Number(a.year) - Number(b.year) || Number(a.round_no) - Number(b.round_no));
    const rankedRounds = rounds.filter((round) => round.cutoff_rank != null);
    const possibleRounds = rounds.filter((round) => round.status === "possible");
    const notPossibleRounds = rounds.filter((round) => round.status === "not-possible");
    const status: Status = possibleRounds.length ? "possible" : notPossibleRounds.length ? "not-possible" : "no-data";
    const statusRounds = status === "possible" ? possibleRounds : status === "not-possible" ? notPossibleRounds : rounds;
    const sortRound = statusRounds
      .slice()
      .sort(
        (a, b) =>
          rankSortValue(a.cutoff_rank) - rankSortValue(b.cutoff_rank) ||
          Number(a.round_no) - Number(b.round_no),
      )[0];

    return {
      ...group,
      status,
      rounds,
      round_count: rounds.length,
      rounds_label: summarizeRounds(rounds),
      opening_rank: minRank(rankedRounds.map((round) => round.opening_rank)),
      closing_rank: minRank(rankedRounds.map((round) => round.closing_rank)),
      cutoff_rank: sortRound?.cutoff_rank ?? null,
      buffer: sortRound?.buffer ?? null,
      buffer_label: bufferLabel(sortRound?.buffer, status),
    };
  });
}

export function compareGroupedRows(a: GroupedRow, b: GroupedRow) {
  return (
    roundStatusOrder(a.status) - roundStatusOrder(b.status) ||
    rankSortValue(a.cutoff_rank) - rankSortValue(b.cutoff_rank) ||
    rankSortValue(a.opening_rank) - rankSortValue(b.opening_rank) ||
    rankSortValue(a.closing_rank) - rankSortValue(b.closing_rank) ||
    String(a.institute).localeCompare(String(b.institute)) ||
    String(a.academic_program).localeCompare(String(b.academic_program))
  );
}

export function uniqueOptions(rows: CutoffRow[], key: OptionalFilterKey | "round_no") {
  return sortText(new Set(rows.map((row) => row[key]).filter((value) => value !== "" && value != null)));
}

export function normalizeCutoffPayload(payload: CutoffPayload): CutoffRow[] {
  if (Array.isArray(payload)) return payload;
  if (!Array.isArray(payload?.columns) || !Array.isArray(payload?.rows)) return [];
  const { columns, rows } = payload;

  return rows.map((values) => {
    return Object.fromEntries(columns.map((column, index) => [column, values[index]])) as CutoffRow;
  });
}

export function applyFilterChain(rows: CutoffRow[], filters: Filters | SubmittedFilters, stopBeforeKey?: OptionalFilterKey) {
  let filtered = rows;

  if (filters.year) {
    filtered = filtered.filter((row) => String(row.year) === String(filters.year));
  }
  if (filters.round_no) {
    filtered = filtered.filter((row) => String(row.round_no) === String(filters.round_no));
  }

  for (const key of optionalFilterOrder) {
    if (key === stopBeforeKey) {
      break;
    }
    const selected = selectedValues(filters[key]);
    if (selected.length) {
      filtered = filtered.filter((row) => selected.includes(String(row[key])));
    }
  }

  return filtered;
}

export function analyzeRow(row: CutoffRow, rank: number, rankBasis: RankBasis): AnalyzedRow {
  const cutoff = row[rankBasis] as RankValue;
  if (cutoff == null || Number.isNaN(Number(cutoff))) {
    return { ...row, cutoff_rank: null, status: "no-data" };
  }
  return {
    ...row,
    cutoff_rank: cutoff,
    status: rank <= Number(cutoff) ? "possible" : "not-possible",
  };
}

export function statusLabel(status: ResultStatus) {
  if (status === "possible") return "Possible";
  if (status === "not-possible") return "Not possible";
  if (status === "no-data") return "No cutoff";
  return "All statuses";
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
