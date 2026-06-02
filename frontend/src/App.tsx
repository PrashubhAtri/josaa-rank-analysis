import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input, Select } from "./components/ui/input";
import { Sheet } from "./components/ui/sheet";
import { Skeleton } from "./components/ui/skeleton";

const ALL = "ALL";
const optionalFilterOrder = [
  "institute",
  "academic_program",
  "quota",
  "seat_type",
  "gender_pool",
  "rank_type",
] as const;

type OptionalFilterKey = (typeof optionalFilterOrder)[number];
type MultiFilterKey = "compare_years" | OptionalFilterKey;
type RankBasis = "closing_rank" | "opening_rank";
type Status = "possible" | "not-possible" | "no-data";
type ResultStatus = Status | typeof ALL;
type RankValue = string | number | null | undefined;
type SearchIndex = Record<string, Record<string, string>>;
type ThemeMode = "light" | "dark";

type Filters = {
  year: string;
  compare_years: string[];
  round_no: string;
  rank: string;
  rankBasis: RankBasis;
} & Record<OptionalFilterKey, string[]>;

type SubmittedFilters = Omit<Filters, "rank"> & {
  rank: number;
};

type ResultFilters = {
  status: ResultStatus;
  search: string;
} & Record<OptionalFilterKey, string[]>;

type FilterSearches = Record<MultiFilterKey, string>;

type ManifestEntry = {
  year: string | number;
  file: string;
};

type CutoffRow = {
  year: string | number;
  round_no: string | number;
  opening_rank?: RankValue;
  closing_rank?: RankValue;
  institute: string;
  academic_program: string;
  quota: string;
  seat_type: string;
  gender_pool: string;
  rank_type: string;
  [key: string]: unknown;
};

type AnalyzedRow = CutoffRow & {
  cutoff_rank: RankValue;
  status: Status;
};

type AnalyzedRound = {
  year: string | number;
  round_no: string | number;
  opening_rank: RankValue;
  closing_rank: RankValue;
  cutoff_rank: RankValue;
  buffer: number | null;
  status: Status;
};

type GroupedRow = AnalyzedRow & {
  rounds: AnalyzedRound[];
  round_count: number;
  rounds_label: string;
  opening_rank: RankValue;
  closing_rank: RankValue;
  cutoff_rank: RankValue;
  buffer: number | null;
  buffer_label: string;
};

type CutoffPayload = CutoffRow[] | {
  columns?: string[];
  rows?: RankValue[][];
};

type MultiSelectFilterProps = {
  disabled?: boolean;
  label: string;
  placeholder?: string;
  options: string[];
  searchIndex: SearchIndex;
  searchValue: string;
  selected: string[] | string;
  fieldKey: MultiFilterKey;
  onChange: (values: string[]) => void;
  onSearchChange: (value: string) => void;
};

const emptyFilters: Filters = {
  year: "",
  compare_years: [],
  round_no: "",
  rank: "",
  rankBasis: "closing_rank",
  institute: [],
  academic_program: [],
  quota: [],
  seat_type: [],
  gender_pool: [],
  rank_type: [],
};

const emptyResultFilters: ResultFilters = {
  status: ALL,
  institute: [],
  academic_program: [],
  quota: [],
  seat_type: [],
  gender_pool: [],
  rank_type: [],
  search: "",
};

const labels: Record<keyof Filters | "status", string> = {
  year: "Year",
  compare_years: "Compare years",
  round_no: "Round",
  rank: "Rank",
  rankBasis: "Rank basis",
  institute: "Institute",
  academic_program: "Program",
  quota: "Quota",
  seat_type: "Seat type",
  gender_pool: "Gender pool",
  rank_type: "Rank type",
  status: "Status",
};

const emptyFilterSearches = Object.fromEntries(
  ["compare_years", ...optionalFilterOrder].map((key) => [key, ""]),
) as FilterSearches;

const waitForPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

const TOP_7_IITS = [
  "Indian Institute of Technology Delhi",
  "Indian Institute of Technology Bombay",
  "Indian Institute of Technology Madras",
  "Indian Institute of Technology Kharagpur",
  "Indian Institute of Technology Kanpur",
  "Indian Institute of Technology Roorkee",
  "Indian Institute of Technology Guwahati",
];
const RESULT_RENDER_LIMIT = 500;

function initialTheme(): ThemeMode {
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function sortText(values: Iterable<RankValue>) {
  return [...values].map(String).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function normalizeSearch(value: RankValue) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(value: string) {
  return normalizeSearch(value).split(" ").filter(Boolean);
}

function selectedValues(value: string[] | string | number | null | undefined) {
  return Array.isArray(value) ? value.map(String) : value && value !== ALL ? [String(value)] : [];
}

function decodeList(value: string | null) {
  return value ? value.split("|").map(decodeURIComponent).filter(Boolean) : [];
}

function encodeList(values: string[] | string | number | null | undefined) {
  return selectedValues(values).map(encodeURIComponent).join("|");
}

function initialFiltersFromUrl(): Filters {
  const params = new URLSearchParams(window.location.search);
  const rankBasis = params.get("rankBasis") === "opening_rank" ? "opening_rank" : "closing_rank";

  return {
    ...emptyFilters,
    year: params.get("year") || "",
    compare_years: decodeList(params.get("compare_years")),
    round_no: params.get("round_no") || "",
    rank: params.get("rank") || "",
    rankBasis,
    institute: decodeList(params.get("institute")),
    academic_program: decodeList(params.get("academic_program")),
    quota: decodeList(params.get("quota")),
    seat_type: decodeList(params.get("seat_type")),
    gender_pool: decodeList(params.get("gender_pool")),
    rank_type: decodeList(params.get("rank_type")),
  };
}

function optionSearchText(searchIndex: SearchIndex, key: string, value: RankValue) {
  return normalizeSearch(`${value} ${searchIndex[key]?.[String(value)] || ""}`);
}

function optionMatchesSearch(searchIndex: SearchIndex, key: string, value: string, query: string) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = optionSearchText(searchIndex, key, value);
  return tokens.every((token) => haystack.includes(token));
}

function isIit(value: RankValue) {
  return String(value).startsWith("Indian Institute of Technology");
}

function isTopFieldProgram(value: RankValue) {
  const program = normalizeSearch(value);

  return (
    program.includes("computer science") ||
    program.includes("computer engineering") ||
    program.includes(" cse ") ||
    program.startsWith("cse ") ||
    program.endsWith(" cse") ||
    program.includes("information technology") ||
    program.includes("electronics and communication") ||
    program.includes("electronics communication") ||
    program.includes(" ece ") ||
    program.startsWith("ece ") ||
    program.endsWith(" ece") ||
    program.includes("electronics and electrical communication") ||
    program.includes("electrical and electronics") ||
    program.includes("electrical engineering")
  );
}

function specialPresetsFor(fieldKey: MultiFilterKey, options: string[], searchIndex: SearchIndex) {
  if (fieldKey === "institute") {
    return [
      {
        label: "All IITs",
        values: options.filter(isIit),
      },
      {
        label: "Top 7 IITs",
        values: TOP_7_IITS.filter((institute) => options.includes(institute)),
      },
    ];
  }

  if (fieldKey === "academic_program") {
    return [
      {
        label: "Top fields",
        values: options.filter(isTopFieldProgram),
      },
    ];
  }

  return [];
}

function specialOptionRank(fieldKey: MultiFilterKey, value: string) {
  if (fieldKey === "institute") {
    const topIndex = TOP_7_IITS.indexOf(value);
    if (topIndex >= 0) return topIndex;
    if (isIit(value)) return 100;
  }

  if (fieldKey === "academic_program" && isTopFieldProgram(value)) {
    const program = normalizeSearch(value);
    if (program.includes("computer science") || program.includes(" cse ")) return 0;
    if (program.includes("electronics and communication") || program.includes(" ece ")) return 1;
    if (program.includes("electrical engineering") || program.includes("electrical and electronics")) return 2;
    if (program.includes("information technology")) return 3;
    return 10;
  }

  return 1000;
}

function presetIsSelected(selected: string[] | string, values: string[]) {
  const selectedSet = new Set(selectedValues(selected));
  return values.length > 0 && values.every((value) => selectedSet.has(value));
}

function rowMatchesSearch(searchIndex: SearchIndex, row: GroupedRow, query: string) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = optionalFilterOrder
    .map((key) => optionSearchText(searchIndex, key, row[key]))
    .join(" ");
  return tokens.every((token) => haystack.includes(token));
}

function rankSortValue(value: RankValue) {
  return value == null || Number.isNaN(Number(value)) ? Number.POSITIVE_INFINITY : Number(value);
}

function compareAnalyzedRows(a: AnalyzedRow, b: AnalyzedRow) {
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

function formatRank(value: RankValue) {
  return value == null || !Number.isFinite(Number(value)) ? "-" : Number(value).toLocaleString();
}

function formatBuffer(value: number | null | undefined) {
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function groupAnalyzedRows(rows: AnalyzedRow[], rank: number) {
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

function compareGroupedRows(a: GroupedRow, b: GroupedRow) {
  return (
    roundStatusOrder(a.status) - roundStatusOrder(b.status) ||
    rankSortValue(a.cutoff_rank) - rankSortValue(b.cutoff_rank) ||
    rankSortValue(a.opening_rank) - rankSortValue(b.opening_rank) ||
    rankSortValue(a.closing_rank) - rankSortValue(b.closing_rank) ||
    String(a.institute).localeCompare(String(b.institute)) ||
    String(a.academic_program).localeCompare(String(b.academic_program))
  );
}

function uniqueOptions(rows: CutoffRow[], key: OptionalFilterKey | "round_no") {
  return sortText(new Set(rows.map((row) => row[key]).filter((value) => value !== "" && value != null)));
}

function normalizeCutoffPayload(payload: CutoffPayload): CutoffRow[] {
  if (Array.isArray(payload)) return payload;
  if (!Array.isArray(payload?.columns) || !Array.isArray(payload?.rows)) return [];
  const { columns, rows } = payload;

  return rows.map((values) => {
    return Object.fromEntries(columns.map((column, index) => [column, values[index]])) as CutoffRow;
  });
}

function applyFilterChain(rows: CutoffRow[], filters: Filters | SubmittedFilters, stopBeforeKey?: OptionalFilterKey) {
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

function analyzeRow(row: CutoffRow, rank: number, rankBasis: RankBasis): AnalyzedRow {
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

function statusLabel(status: ResultStatus) {
  if (status === "possible") return "Possible";
  if (status === "not-possible") return "Not possible";
  if (status === "no-data") return "No cutoff";
  return "All statuses";
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M13.3 4.2 6.4 11 3.2 7.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: ThemeMode }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 2.5v2M10 15.5v2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M2.5 10h2M15.5 10h2M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M15.7 12.4A6.2 6.2 0 0 1 7.6 4.3 6.8 6.8 0 1 0 15.7 12.4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function multiValueLabel(selectedList: string[], placeholder: string) {
  if (!selectedList.length) return placeholder;
  if (selectedList.length === 1) return selectedList[0];
  return `${selectedList.length} selected`;
}

function downloadCsv(rows: GroupedRow[]) {
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

function MultiSelectFilter({
  disabled = false,
  label,
  placeholder = "Any",
  options,
  searchIndex,
  searchValue,
  selected,
  fieldKey,
  onChange,
  onSearchChange,
}: MultiSelectFilterProps) {
  const selectedList = selectedValues(selected);
  const visibleOptions = options
    .filter((value) => optionMatchesSearch(searchIndex, fieldKey, value, searchValue))
    .sort((a, b) => {
      const rankDelta = specialOptionRank(fieldKey, a) - specialOptionRank(fieldKey, b);
      return rankDelta || String(a).localeCompare(String(b), undefined, { numeric: true });
    });
  const renderedOptions = visibleOptions.slice(0, 120);
  const specialPresets = specialPresetsFor(fieldKey, options, searchIndex).filter((preset) => preset.values.length);

  function toggleValue(value: string) {
    if (selectedList.includes(value)) {
      onChange(selectedList.filter((selectedValue) => selectedValue !== value));
    } else {
      onChange([...selectedList, value]);
    }
  }

  function selectVisible() {
    onChange([...new Set([...selectedList, ...visibleOptions])]);
  }

  return (
    <div className={`filter-field multi-filter-field${disabled ? " is-disabled" : ""}`}>
      <span className="filter-label">{label}</span>
      <details className="multi-filter">
        <summary className="multi-trigger">
          <span className={`filter-control-value${selectedList.length ? "" : " is-placeholder"}`}>
            {multiValueLabel(selectedList, placeholder)}
          </span>
          {selectedList.length ? <span className="filter-count">{selectedList.length}</span> : null}
        </summary>
        <div className="multi-menu">
          <Input
            className="multi-search"
            value={searchValue}
            placeholder={`Search ${label.toLowerCase()}`}
            onChange={(event) => onSearchChange(event.target.value)}
            disabled={disabled}
          />
          {specialPresets.length ? (
            <div className="preset-block">
              <span>Quick picks</span>
              <div className="preset-actions">
                {specialPresets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="chip"
                    className={`preset-button${presetIsSelected(selectedList, preset.values) ? " is-active" : ""}`}
                    onClick={() => onChange(preset.values)}
                    disabled={disabled}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="multi-actions">
            <Button type="button" variant="mini" className="mini-button" onClick={selectVisible} disabled={disabled || !visibleOptions.length}>
              Select shown
            </Button>
            <Button type="button" variant="mini" className="mini-button secondary-mini" onClick={() => onChange([])} disabled={disabled || !selectedList.length}>
              Clear
            </Button>
          </div>
          <div className="option-list">
            {renderedOptions.map((value) => {
              const isSelected = selectedList.includes(value);
              return (
                <label key={value} className={`check-option${isSelected ? " is-selected" : ""}`}>
                  <input
                    className="check-option-input"
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleValue(value)}
                    disabled={disabled}
                  />
                  <span className="check-indicator">{isSelected ? <CheckIcon /> : null}</span>
                  <span className="check-text">{value}</span>
                </label>
              );
            })}
            {visibleOptions.length > renderedOptions.length ? (
              <p className="option-limit">Showing first {renderedOptions.length} of {visibleOptions.length}. Keep typing to narrow.</p>
            ) : null}
            {!visibleOptions.length ? <p className="option-limit">No matching options.</p> : null}
          </div>
        </div>
      </details>
    </div>
  );
}

function App() {
  const didAutoSubmitFromUrl = useRef(false);
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [yearRows, setYearRows] = useState<Record<string, CutoffRow[]>>({});
  const [availableYears, setAvailableYears] = useState<ManifestEntry[]>([]);
  const [searchIndex, setSearchIndex] = useState<SearchIndex>({});
  const [loadState, setLoadState] = useState("loading");
  const [yearLoadState, setYearLoadState] = useState("idle");
  const [filters, setFilters] = useState(initialFiltersFromUrl);
  const [submitted, setSubmitted] = useState<SubmittedFilters | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [bestOnly, setBestOnly] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<GroupedRow | null>(null);
  const [resultFilters, setResultFilters] = useState(emptyResultFilters);
  const [filterSearches, setFilterSearches] = useState(emptyFilterSearches);
  const [resultFilterSearches, setResultFilterSearches] = useState(emptyFilterSearches);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    Promise.all([
      fetch("/data/manifest.json").then((response) => {
        if (!response.ok) throw new Error("Could not load /data/manifest.json");
        return response.json();
      }),
      fetch("/data/search-index.json")
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({})),
    ])
      .then(([manifest, index]: [{ years?: ManifestEntry[] }, SearchIndex]) => {
        const years = Array.isArray(manifest?.years) ? manifest.years : [];
        setAvailableYears(years);
        setSearchIndex(index && typeof index === "object" ? index : {});
        setLoadState("ready");
      })
      .catch((loadError: unknown) => {
        setError(errorMessage(loadError));
        setLoadState("error");
      });
  }, []);

  useEffect(() => {
    if (!filters.year) {
      setYearLoadState("idle");
      return;
    }
    if (loadState !== "ready") {
      setYearLoadState("idle");
      return;
    }

    const yearsToLoad = [...new Set([filters.year, ...selectedValues(filters.compare_years)].filter(Boolean).map(String))];
    const missingYears = yearsToLoad.filter((year) => !yearRows[year]);
    if (!missingYears.length) {
      setYearLoadState("ready");
      return;
    }
    const missingEntries = missingYears.filter((year) => !availableYears.some((entry) => String(entry.year) === String(year)));
    if (missingEntries.length) {
      setError(`No data file listed for ${missingEntries.join(", ")}`);
      setYearLoadState("error");
      return;
    }

    const controller = new AbortController();
    setYearLoadState("loading");

    Promise.all(missingYears.map((year) => {
      const yearEntry = availableYears.find((entry) => String(entry.year) === String(year));
      if (!yearEntry) throw new Error(`No data file listed for ${year}`);
      return fetch(`/data/${yearEntry.file}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Could not load /data/${yearEntry.file}`);
          return response.json();
        })
        .then((data: CutoffPayload) => [year, normalizeCutoffPayload(data)] as const);
    }))
      .then((loadedYears) => {
        setYearRows((current) => {
          const next = { ...current };
          for (const [year, data] of loadedYears) next[year] = data;
          return next;
        });
        setYearLoadState("ready");
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(errorMessage(loadError));
        setYearLoadState("error");
      });

    return () => controller.abort();
  }, [filters.year, filters.compare_years, availableYears, yearRows, loadState]);

  const yearOptions = useMemo(() => sortText(new Set(availableYears.map((entry) => String(entry.year)))).reverse(), [availableYears]);
  const rows = useMemo(() => yearRows[String(filters.year)] || [], [yearRows, filters.year]);
  const analysisRows = useMemo(() => {
    const years = [...new Set([filters.year, ...selectedValues(filters.compare_years)].filter(Boolean).map(String))];
    return years.flatMap((year) => yearRows[year] || []);
  }, [yearRows, filters.year, filters.compare_years]);
  const roundOptions = useMemo(() => uniqueOptions(applyFilterChain(rows, filters, "institute"), "round_no"), [rows, filters]);

  const filterOptions = useMemo(() => {
    const options = {} as Record<OptionalFilterKey, string[]>;
    for (const key of optionalFilterOrder) {
      options[key] = uniqueOptions(applyFilterChain(rows, filters, key), key);
    }
    return options;
  }, [rows, filters]);

  const analyzedRows = useMemo(() => {
    if (!submitted) return [];
    const rank = Number(submitted.rank);
    return applyFilterChain(analysisRows, { ...submitted, year: "" })
      .map((row) => analyzeRow(row, rank, submitted.rankBasis))
      .sort(compareAnalyzedRows);
  }, [analysisRows, submitted]);

  const groupedResults = useMemo(() => {
    return groupAnalyzedRows(analyzedRows, Number(submitted?.rank || 0)).sort(compareGroupedRows);
  }, [analyzedRows, submitted]);

  const visibleResults = useMemo(() => {
    const search = resultFilters.search.trim().toLowerCase();
    return groupedResults.filter((row) => {
      if (bestOnly && row.status !== "possible") return false;
      if (resultFilters.status !== ALL && row.status !== resultFilters.status) return false;
      for (const key of optionalFilterOrder) {
        const selected = selectedValues(resultFilters[key]);
        if (selected.length && !selected.includes(String(row[key]))) return false;
      }
      return rowMatchesSearch(searchIndex, row, search);
    });
  }, [groupedResults, resultFilters, searchIndex, bestOnly]);

  const summary = useMemo(() => {
    return visibleResults.reduce(
      (totals: { total: number } & Record<Status, number>, row) => {
        totals.total += 1;
        totals[row.status] += 1;
        return totals;
      },
      { total: 0, possible: 0, "not-possible": 0, "no-data": 0 },
    );
  }, [visibleResults]);

  const resultOptions = useMemo(() => {
    const options = {} as Record<OptionalFilterKey, string[]>;
    for (const key of optionalFilterOrder) {
      options[key] = uniqueOptions(groupedResults, key);
    }
    return options;
  }, [groupedResults]);
  const displayedResults = useMemo(() => visibleResults.slice(0, RESULT_RENDER_LIMIT), [visibleResults]);
  const hiddenResultCount = Math.max(visibleResults.length - displayedResults.length, 0);

  function updateFilter(key: keyof Filters, value: string | string[]) {
    if (key === "rank" && String(value) !== "" && !/^\d+$/.test(String(value))) {
      return;
    }

    setFilters((current) => {
      const next = { ...current };
      if (key === "rankBasis") {
        next.rankBasis = value === "opening_rank" ? "opening_rank" : "closing_rank";
      } else {
        Object.assign(next, { [key]: value });
      }
      const startIndex = optionalFilterOrder.indexOf(key as OptionalFilterKey);
      if (key === "year" || key === "round_no") {
        for (const optionalKey of optionalFilterOrder) next[optionalKey] = [];
      } else if (startIndex >= 0) {
        for (const optionalKey of optionalFilterOrder.slice(startIndex + 1)) next[optionalKey] = [];
      }
      if (key === "year") {
        next.round_no = "";
        next.compare_years = selectedValues(next.compare_years).filter((year) => String(year) !== String(value));
      }
      return next;
    });
  }

  function updateShareUrl(nextFilters: Filters | SubmittedFilters = submitted || filters) {
    const params = new URLSearchParams();
    for (const key of ["year", "round_no", "rank", "rankBasis"] as const) {
      if (nextFilters[key]) params.set(key, String(nextFilters[key]));
    }
    for (const key of ["compare_years", ...optionalFilterOrder] as const) {
      const encoded = encodeList(nextFilters[key]);
      if (encoded) params.set(key, encoded);
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
    return `${window.location.origin}${nextUrl}`;
  }

  function copyShareUrl() {
    const url = updateShareUrl();
    navigator.clipboard?.writeText(url);
    setError("");
    setToast("Share link copied");
  }

  function applyPreset(fieldKey: OptionalFilterKey, values: string[]) {
    updateFilter(fieldKey, values);
  }

  async function submitAnalysis(event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    const rank = Number(filters.rank);
    if (!filters.year || !Number.isInteger(rank) || rank <= 0) {
      setError("Choose a year and positive integer rank before analyzing.");
      return;
    }
    if (yearLoadState !== "ready") {
      setError("Wait for the selected year's data to finish loading.");
      return;
    }
    setError("");
    setIsAnalyzing(true);
    await waitForPaint();
    setSubmitted({ ...filters, rank });
    updateShareUrl({ ...filters, rank });
    setResultFilters(emptyResultFilters);
    setResultFilterSearches(emptyFilterSearches);
    window.setTimeout(() => setIsAnalyzing(false), 120);
  }

  useEffect(() => {
    const rank = Number(filters.rank);
    if (
      didAutoSubmitFromUrl.current ||
      !window.location.search ||
      !filters.year ||
      !Number.isInteger(rank) ||
      rank <= 0 ||
      yearLoadState !== "ready"
    ) {
      return;
    }

    didAutoSubmitFromUrl.current = true;
    setSubmitted({ ...filters, rank });
    setResultFilters(emptyResultFilters);
    setResultFilterSearches(emptyFilterSearches);
  }, [filters, yearLoadState]);

  function dataStatusLabel() {
    if (loadState === "loading") return "Loading data index";
    if (loadState === "error") return "Data index error";
    if (yearLoadState === "loading") return `Loading ${filters.year} data`;
    if (yearLoadState === "ready") return `${analysisRows.length.toLocaleString()} rows loaded`;
    return `${availableYears.length} years available`;
  }

  const topInstitutePresets = specialPresetsFor("institute", filterOptions.institute || [], searchIndex);
  const topFieldPreset = specialPresetsFor("academic_program", filterOptions.academic_program || [], searchIndex)[0];

  return (
    <main className="app-shell">
      {(yearLoadState === "loading" || isAnalyzing) ? (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loader-card">
            <Skeleton className="loader-skeleton" aria-hidden="true" />
            <div>
              <strong>{isAnalyzing ? "Analyzing rank" : `Loading ${filters.year} data`}</strong>
              <p>{isAnalyzing ? "Preparing grouped college and course results..." : "Fetching cutoff data for the selected year..."}</p>
            </div>
          </div>
        </div>
      ) : null}
      <header className="page-header">
        <div>
          <div className="header-kicker">
            <span>2021 to 2025</span>
          </div>
          <h1>JoSAA Rank Analysis</h1>
          <p className="header-copy">Fast rank analysis for IIT, NIT, IIIT, and GFTI counselling options.</p>
        </div>
        <div className="header-actions">
          <Badge>{dataStatusLabel()}</Badge>
          <Button
            type="button"
            variant="secondary"
            className="icon-button theme-toggle"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            <ThemeIcon theme={theme} />
          </Button>
        </div>
      </header>

      <Card className="filter-panel">
      <form onSubmit={submitAnalysis}>
        <div className="quick-strip">
          {topInstitutePresets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="chip"
              className={`quick-chip${presetIsSelected(filters.institute, preset.values) ? " is-active" : ""}`}
              onClick={() => applyPreset("institute", preset.values)}
            >
              {preset.label}
            </Button>
          ))}
          {topFieldPreset ? (
            <Button
              type="button"
              variant="chip"
              className={`quick-chip${presetIsSelected(filters.academic_program, topFieldPreset.values) ? " is-active" : ""}`}
              onClick={() => applyPreset("academic_program", topFieldPreset.values)}
            >
              Top fields
            </Button>
          ) : null}
        </div>
        <div className="filter-grid">
          <label className="filter-field">
            <span className="filter-label">{labels.year}</span>
            <Select value={filters.year} onChange={(event) => updateFilter("year", event.target.value)} required>
              <option value="">Select year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </Select>
          </label>
          <MultiSelectFilter
            fieldKey="compare_years"
            label={labels.compare_years}
            placeholder="None"
            options={yearOptions.filter((year) => String(year) !== String(filters.year))}
            searchIndex={searchIndex}
            searchValue={filterSearches.compare_years || ""}
            selected={filters.compare_years}
            onChange={(values) => updateFilter("compare_years", values)}
            onSearchChange={(value) => setFilterSearches((current) => ({ ...current, compare_years: value }))}
          />
          <label className="filter-field">
            <span className="filter-label">{labels.round_no}</span>
            <Select value={filters.round_no} onChange={(event) => updateFilter("round_no", event.target.value)}>
              <option value="">All rounds</option>
              {roundOptions.map((round) => (
                <option key={round} value={round}>Round {round}</option>
              ))}
            </Select>
          </label>
          <label className="filter-field">
            <span className="filter-label">{labels.rank}</span>
            <Input
              value={filters.rank}
              min="1"
              step="1"
              type="number"
              inputMode="numeric"
              onChange={(event) => updateFilter("rank", event.target.value)}
              onKeyDown={(event) => {
                if ([".", "-", "+", "e", "E"].includes(event.key)) {
                  event.preventDefault();
                }
              }}
              required
            />
          </label>
          <label className="filter-field">
            <span className="filter-label">{labels.rankBasis}</span>
            <Select value={filters.rankBasis} onChange={(event) => updateFilter("rankBasis", event.target.value as RankBasis)} required>
              <option value="closing_rank">Closing rank</option>
              <option value="opening_rank">Opening rank</option>
            </Select>
          </label>
          {optionalFilterOrder.map((key) => (
            <MultiSelectFilter
              key={key}
              fieldKey={key}
              label={labels[key]}
              options={filterOptions[key] || []}
              searchIndex={searchIndex}
              searchValue={filterSearches[key]}
              selected={filters[key]}
              onChange={(values) => updateFilter(key, values)}
              onSearchChange={(value) => setFilterSearches((current) => ({ ...current, [key]: value }))}
            />
          ))}
        </div>
        <div className="filter-actions">
          <Button type="submit" disabled={Boolean(filters.year && yearLoadState !== "ready")}>Analyze rank</Button>
          <Button type="button" variant="secondary" className="secondary" onClick={copyShareUrl}>
            Copy/share link
          </Button>
          <Button type="button" variant="secondary" className="secondary" onClick={() => { setFilters(emptyFilters); setSubmitted(null); setResultFilters(emptyResultFilters); setFilterSearches(emptyFilterSearches); setResultFilterSearches(emptyFilterSearches); setError(""); }}>
            Reset
          </Button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </form>
      </Card>

      <section className="content-grid">
        <Card className="results-area">
          <div className="result-toolbar">
            <label>
              <span>Search results</span>
              <Input value={resultFilters.search} placeholder="Institute, program, quota..." onChange={(event) => setResultFilters((current) => ({ ...current, search: event.target.value }))} />
            </label>
            <label>
              <span>{labels.status}</span>
              <Select value={resultFilters.status} onChange={(event) => setResultFilters((current) => ({ ...current, status: event.target.value as ResultStatus }))}>
                <option value={ALL}>All statuses</option>
                <option value="possible">Possible</option>
                <option value="not-possible">Not possible</option>
                <option value="no-data">No cutoff</option>
              </Select>
            </label>
            {optionalFilterOrder.map((key) => (
              <MultiSelectFilter
                key={key}
                disabled={!submitted}
                fieldKey={key}
                label={labels[key]}
                options={resultOptions[key] || []}
                searchIndex={searchIndex}
                searchValue={resultFilterSearches[key]}
                selected={resultFilters[key]}
                onChange={(values) => setResultFilters((current) => ({ ...current, [key]: values }))}
                onSearchChange={(value) => setResultFilterSearches((current) => ({ ...current, [key]: value }))}
              />
            ))}
            <div className="result-filter-footer">
              <label className="standalone-checkbox">
                <input type="checkbox" checked={bestOnly} onChange={(event) => setBestOnly(event.target.checked)} />
                <span>Best possible only</span>
              </label>
              <Button type="button" variant="secondary" className="secondary" onClick={() => downloadCsv(visibleResults)} disabled={!visibleResults.length}>
                Export CSV
              </Button>
            </div>
          </div>

          <div className="mobile-results">
            {!submitted ? (
              <Card className="empty-card">Enter a year and rank, then submit to analyze results.</Card>
            ) : displayedResults.length ? (
              displayedResults.map((row, index) => (
                <article key={`mobile-${row.year}-${row.institute}-${row.academic_program}-${row.quota}-${row.seat_type}-${row.gender_pool}-${index}`} className={`result-card row-${row.status}`}>
                  <div className="card-topline">
                    <Badge variant={row.status}>{statusLabel(row.status)}</Badge>
                    <span>{row.quota} / {row.seat_type} / {row.rank_type}</span>
                  </div>
                  <h3>{row.institute}</h3>
                  <p>{row.academic_program}</p>
                  <div className="round-stack">
                    {row.rounds.map((round) => (
                      <span key={`mobile-${row.institute}-${row.academic_program}-${round.round_no}`} className={`round-chip round-${round.status}`}>
                        R{round.round_no} {formatRank(round.opening_rank)}-{formatRank(round.closing_rank)}
                      </span>
                    ))}
                  </div>
                  <dl className="card-metrics">
                    <div><dt>Gender</dt><dd>{row.gender_pool}</dd></div>
                    <div><dt>Buffer</dt><dd>{row.buffer_label} {formatBuffer(row.buffer)}</dd></div>
                    <div><dt>Best opening</dt><dd>{formatRank(row.opening_rank)}</dd></div>
                    <div><dt>Best closing</dt><dd>{formatRank(row.closing_rank)}</dd></div>
                  </dl>
                  <Button type="button" className="card-detail-button" onClick={() => setSelectedDetail(row)}>Open details</Button>
                </article>
              ))
            ) : (
              <Card className="empty-card">No rows match the current result filters.</Card>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Round</th>
                  <th>Institute</th>
                  <th>Program</th>
                  <th>Quota</th>
                  <th>Seat</th>
                  <th>Gender</th>
                  <th>Rank type</th>
                  <th>Buffer</th>
                  <th>Best opening</th>
                  <th>Best closing</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {!submitted ? (
                  <tr><td colSpan={12} className="empty-cell">Enter a year and rank to analyze results.</td></tr>
                ) : displayedResults.length ? (
                  displayedResults.map((row, index) => (
                    <tr key={`${row.year}-${row.institute}-${row.academic_program}-${row.quota}-${row.seat_type}-${row.gender_pool}-${index}`} className={`row-${row.status}`}>
                      <td><Badge variant={row.status}>{statusLabel(row.status)}</Badge></td>
                      <td>
                        <div className="round-stack">
                          {row.rounds.map((round) => (
                            <span key={`${row.institute}-${row.academic_program}-${round.round_no}`} className={`round-chip round-${round.status}`}>
                              R{round.round_no} {formatRank(round.opening_rank)}-{formatRank(round.closing_rank)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{row.institute}</td>
                      <td>{row.academic_program}</td>
                      <td>{row.quota}</td>
                      <td>{row.seat_type}</td>
                      <td>{row.gender_pool}</td>
                      <td>{row.rank_type}</td>
                      <td><span className={`buffer-pill buffer-${normalizeSearch(row.buffer_label)}`}>{row.buffer_label} {formatBuffer(row.buffer)}</span></td>
                      <td>{formatRank(row.opening_rank)}</td>
                      <td>{formatRank(row.closing_rank)}</td>
                      <td><Button type="button" variant="mini" className="mini-button open-detail-button" onClick={() => setSelectedDetail(row)}>Open</Button></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={12} className="empty-cell">No rows match the current result filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {hiddenResultCount ? (
            <p className="result-limit-note">
              Showing first {displayedResults.length.toLocaleString()} of {visibleResults.length.toLocaleString()} matching rows. Use result filters or search to narrow before reviewing every row.
            </p>
          ) : null}
        </Card>

        <Card className="summary-panel">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
          <dl>
            <div><dt>Visible rows</dt><dd>{summary.total.toLocaleString()}</dd></div>
            <div><dt>Possible</dt><dd>{summary.possible.toLocaleString()}</dd></div>
            <div><dt>Not possible</dt><dd>{summary["not-possible"].toLocaleString()}</dd></div>
            <div><dt>No cutoff</dt><dd>{summary["no-data"].toLocaleString()}</dd></div>
          </dl>
          {submitted ? (
            <p>
              Rank {submitted.rank.toLocaleString()} compared against {submitted.rankBasis === "closing_rank" ? "closing" : "opening"} ranks for {submitted.year}
              {submitted.round_no ? `, round ${submitted.round_no}` : ", all rounds"}.
            </p>
          ) : (
            <p>Submit a rank analysis to populate possible, not possible, and missing cutoff groups.</p>
          )}
          </CardContent>
        </Card>
      </section>

      {selectedDetail ? (
        <Sheet>
            <Button type="button" variant="secondary" className="detail-close" onClick={() => setSelectedDetail(null)}>Close</Button>
            <Badge variant={selectedDetail.status}>{statusLabel(selectedDetail.status)}</Badge>
            <h2>{selectedDetail.institute}</h2>
            <p>{selectedDetail.academic_program}</p>
            <dl className="detail-meta">
              <div><dt>Quota</dt><dd>{selectedDetail.quota}</dd></div>
              <div><dt>Seat</dt><dd>{selectedDetail.seat_type}</dd></div>
              <div><dt>Gender</dt><dd>{selectedDetail.gender_pool}</dd></div>
              <div><dt>Rank type</dt><dd>{selectedDetail.rank_type}</dd></div>
              <div><dt>Buffer</dt><dd>{selectedDetail.buffer_label} {formatBuffer(selectedDetail.buffer)}</dd></div>
            </dl>
            <div className="detail-rounds">
              {selectedDetail.rounds.map((round) => (
                <div key={`${round.year}-${round.round_no}`} className={`detail-round round-${round.status}`}>
                  <strong>{round.year} Round {round.round_no}</strong>
                  <span>Opening {formatRank(round.opening_rank)}</span>
                  <span>Closing {formatRank(round.closing_rank)}</span>
                  <span>{statusLabel(round.status)} / {formatBuffer(round.buffer)}</span>
                </div>
              ))}
            </div>
        </Sheet>
      ) : null}
      <footer className="app-footer">
        <span>Made by me for students to find information easier.</span>
        <a href="https://github.com/PrashubhAtri" target="_blank" rel="noreferrer">@PrashubhAtri</a>
      </footer>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}

export default App;
