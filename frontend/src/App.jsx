import { useEffect, useMemo, useState } from "react";

const ALL = "ALL";

const emptyFilters = {
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

const emptyResultFilters = {
  status: ALL,
  institute: [],
  academic_program: [],
  quota: [],
  seat_type: [],
  gender_pool: [],
  rank_type: [],
  search: "",
};

const optionalFilterOrder = [
  "institute",
  "academic_program",
  "quota",
  "seat_type",
  "gender_pool",
  "rank_type",
];

const labels = {
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

const emptyFilterSearches = Object.fromEntries(["compare_years", ...optionalFilterOrder].map((key) => [key, ""]));

const waitForPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

const TOP_7_IITS = [
  "Indian Institute of Technology Delhi",
  "Indian Institute of Technology Bombay",
  "Indian Institute of Technology Madras",
  "Indian Institute of Technology Kharagpur",
  "Indian Institute of Technology Kanpur",
  "Indian Institute of Technology Roorkee",
  "Indian Institute of Technology Guwahati",
];

function sortText(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(value) {
  return normalizeSearch(value).split(" ").filter(Boolean);
}

function selectedValues(value) {
  return Array.isArray(value) ? value : value && value !== ALL ? [value] : [];
}

function decodeList(value) {
  return value ? value.split("|").map(decodeURIComponent).filter(Boolean) : [];
}

function encodeList(values) {
  return selectedValues(values).map(encodeURIComponent).join("|");
}

function initialFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    ...emptyFilters,
    year: params.get("year") || "",
    compare_years: decodeList(params.get("compare_years")),
    round_no: params.get("round_no") || "",
    rank: params.get("rank") || "",
    rankBasis: params.get("rankBasis") || "closing_rank",
    institute: decodeList(params.get("institute")),
    academic_program: decodeList(params.get("academic_program")),
    quota: decodeList(params.get("quota")),
    seat_type: decodeList(params.get("seat_type")),
    gender_pool: decodeList(params.get("gender_pool")),
    rank_type: decodeList(params.get("rank_type")),
  };
}

function optionSearchText(searchIndex, key, value) {
  return normalizeSearch(`${value} ${searchIndex[key]?.[value] || ""}`);
}

function optionMatchesSearch(searchIndex, key, value, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = optionSearchText(searchIndex, key, value);
  return tokens.every((token) => haystack.includes(token));
}

function isIit(value) {
  return String(value).startsWith("Indian Institute of Technology");
}

function isTopFieldProgram(value) {
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

function specialPresetsFor(fieldKey, options, searchIndex) {
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

function specialOptionRank(fieldKey, value) {
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

function presetIsSelected(selected, values) {
  const selectedSet = new Set(selectedValues(selected));
  return values.length > 0 && values.every((value) => selectedSet.has(value));
}

function rowMatchesSearch(searchIndex, row, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = optionalFilterOrder
    .map((key) => optionSearchText(searchIndex, key, row[key]))
    .join(" ");
  return tokens.every((token) => haystack.includes(token));
}

function rankSortValue(value) {
  return value == null || Number.isNaN(Number(value)) ? Number.POSITIVE_INFINITY : Number(value);
}

function compareAnalyzedRows(a, b) {
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

function roundStatusOrder(status) {
  return { possible: 0, "not-possible": 1, "no-data": 2 }[status] ?? 3;
}

function groupKey(row) {
  return [
    row.institute,
    row.academic_program,
    row.quota,
    row.seat_type,
    row.gender_pool,
    row.rank_type,
  ].join("\u001f");
}

function formatRank(value) {
  return value == null || !Number.isFinite(Number(value)) ? "-" : Number(value).toLocaleString();
}

function formatBuffer(value) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return value >= 0 ? `+${formatRank(value)}` : formatRank(value);
}

function bufferLabel(value, status) {
  if (status === "no-data" || value == null || !Number.isFinite(Number(value))) return "No data";
  if (value >= 1000) return "Safe";
  if (value >= 0) return "Close";
  return "Reach";
}

function minRank(values) {
  const numericValues = values.map(Number).filter(Number.isFinite);
  return numericValues.length ? Math.min(...numericValues) : null;
}

function summarizeRounds(rounds) {
  return rounds
    .map((round) => `${round.year} R${round.round_no}: ${formatRank(round.opening_rank)}-${formatRank(round.closing_rank)} (${statusLabel(round.status)})`)
    .join("; ");
}

function groupAnalyzedRows(rows, rank) {
  const groups = new Map();

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
      });
    }

    const group = groups.get(key);
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

  return [...groups.values()].map((group) => {
    const rounds = group.rounds.sort((a, b) => Number(a.year) - Number(b.year) || Number(a.round_no) - Number(b.round_no));
    const rankedRounds = rounds.filter((round) => round.cutoff_rank != null);
    const possibleRounds = rounds.filter((round) => round.status === "possible");
    const notPossibleRounds = rounds.filter((round) => round.status === "not-possible");
    const status = possibleRounds.length ? "possible" : notPossibleRounds.length ? "not-possible" : "no-data";
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

function compareGroupedRows(a, b) {
  return (
    roundStatusOrder(a.status) - roundStatusOrder(b.status) ||
    rankSortValue(a.cutoff_rank) - rankSortValue(b.cutoff_rank) ||
    rankSortValue(a.opening_rank) - rankSortValue(b.opening_rank) ||
    rankSortValue(a.closing_rank) - rankSortValue(b.closing_rank) ||
    String(a.institute).localeCompare(String(b.institute)) ||
    String(a.academic_program).localeCompare(String(b.academic_program))
  );
}

function uniqueOptions(rows, key) {
  return sortText(new Set(rows.map((row) => row[key]).filter((value) => value !== "" && value != null)));
}

function normalizeCutoffPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!Array.isArray(payload?.columns) || !Array.isArray(payload?.rows)) return [];

  return payload.rows.map((values) => {
    return Object.fromEntries(payload.columns.map((column, index) => [column, values[index]]));
  });
}

function applyFilterChain(rows, filters, stopBeforeKey) {
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
      filtered = filtered.filter((row) => selected.includes(row[key]));
    }
  }

  return filtered;
}

function analyzeRow(row, rank, rankBasis) {
  const cutoff = row[rankBasis];
  if (cutoff == null || Number.isNaN(Number(cutoff))) {
    return { ...row, cutoff_rank: null, status: "no-data" };
  }
  return {
    ...row,
    cutoff_rank: cutoff,
    status: rank <= Number(cutoff) ? "possible" : "not-possible",
  };
}

function statusLabel(status) {
  if (status === "possible") return "Possible";
  if (status === "not-possible") return "Not possible";
  if (status === "no-data") return "No cutoff";
  return "All statuses";
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadCsv(rows) {
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
  options,
  searchIndex,
  searchValue,
  selected,
  fieldKey,
  onChange,
  onSearchChange,
}) {
  const selectedList = selectedValues(selected);
  const visibleOptions = options
    .filter((value) => optionMatchesSearch(searchIndex, fieldKey, value, searchValue))
    .sort((a, b) => {
      const rankDelta = specialOptionRank(fieldKey, a) - specialOptionRank(fieldKey, b);
      return rankDelta || String(a).localeCompare(String(b), undefined, { numeric: true });
    });
  const renderedOptions = visibleOptions.slice(0, 120);
  const specialPresets = specialPresetsFor(fieldKey, options, searchIndex).filter((preset) => preset.values.length);

  function toggleValue(value) {
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
    <details className={`multi-filter${disabled ? " is-disabled" : ""}`}>
      <summary>{label}</summary>
      <div className="multi-menu">
        <input
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
              <button
                key={preset.label}
                type="button"
                className={`preset-button${presetIsSelected(selectedList, preset.values) ? " is-active" : ""}`}
                onClick={() => onChange(preset.values)}
                disabled={disabled}
              >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="multi-actions">
          <button type="button" className="mini-button" onClick={selectVisible} disabled={disabled || !visibleOptions.length}>
            Select shown
          </button>
          <button type="button" className="mini-button secondary-mini" onClick={() => onChange([])} disabled={disabled || !selectedList.length}>
            Clear
          </button>
        </div>
        <div className="option-list">
          {renderedOptions.map((value) => (
            <label key={value} className="check-option">
              <input
                type="checkbox"
                checked={selectedList.includes(value)}
                onChange={() => toggleValue(value)}
                disabled={disabled}
              />
              <span>{value}</span>
            </label>
          ))}
          {visibleOptions.length > renderedOptions.length ? (
            <p className="option-limit">Showing first {renderedOptions.length} of {visibleOptions.length}. Keep typing to narrow.</p>
          ) : null}
          {!visibleOptions.length ? <p className="option-limit">No matching options.</p> : null}
        </div>
      </div>
    </details>
  );
}

function App() {
  const [yearRows, setYearRows] = useState({});
  const [availableYears, setAvailableYears] = useState([]);
  const [searchIndex, setSearchIndex] = useState({});
  const [loadState, setLoadState] = useState("loading");
  const [yearLoadState, setYearLoadState] = useState("idle");
  const [filters, setFilters] = useState(initialFiltersFromUrl);
  const [submitted, setSubmitted] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [bestOnly, setBestOnly] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [resultFilters, setResultFilters] = useState(emptyResultFilters);
  const [filterSearches, setFilterSearches] = useState(emptyFilterSearches);
  const [resultFilterSearches, setResultFilterSearches] = useState(emptyFilterSearches);
  const [error, setError] = useState("");

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
      .then(([manifest, index]) => {
        const years = Array.isArray(manifest?.years) ? manifest.years : [];
        setAvailableYears(years);
        setSearchIndex(index && typeof index === "object" ? index : {});
        setLoadState("ready");
      })
      .catch((loadError) => {
        setError(loadError.message);
        setLoadState("error");
      });
  }, []);

  useEffect(() => {
    if (!filters.year) {
      setYearLoadState("idle");
      return;
    }

    const yearsToLoad = [...new Set([filters.year, ...selectedValues(filters.compare_years)].filter(Boolean).map(String))];
    const missingYears = yearsToLoad.filter((year) => !yearRows[year]);
    if (!missingYears.length) {
      setYearLoadState("ready");
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
        .then((data) => [year, normalizeCutoffPayload(data)]);
    }))
      .then((loadedYears) => {
        setYearRows((current) => {
          const next = { ...current };
          for (const [year, data] of loadedYears) next[year] = data;
          return next;
        });
        setYearLoadState("ready");
      })
      .catch((loadError) => {
        if (loadError.name === "AbortError") return;
        setError(loadError.message);
        setYearLoadState("error");
      });

    return () => controller.abort();
  }, [filters.year, filters.compare_years, availableYears, yearRows]);

  const yearOptions = useMemo(() => sortText(new Set(availableYears.map((entry) => entry.year))).reverse(), [availableYears]);
  const rows = useMemo(() => yearRows[String(filters.year)] || [], [yearRows, filters.year]);
  const analysisRows = useMemo(() => {
    const years = [...new Set([filters.year, ...selectedValues(filters.compare_years)].filter(Boolean).map(String))];
    return years.flatMap((year) => yearRows[year] || []);
  }, [yearRows, filters.year, filters.compare_years]);
  const roundOptions = useMemo(() => uniqueOptions(applyFilterChain(rows, filters, "institute"), "round_no"), [rows, filters]);

  const filterOptions = useMemo(() => {
    const options = {};
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
        if (selected.length && !selected.includes(row[key])) return false;
      }
      return rowMatchesSearch(searchIndex, row, search);
    });
  }, [groupedResults, resultFilters, searchIndex, bestOnly]);

  const summary = useMemo(() => {
    return visibleResults.reduce(
      (totals, row) => {
        totals.total += 1;
        totals[row.status] += 1;
        return totals;
      },
      { total: 0, possible: 0, "not-possible": 0, "no-data": 0 },
    );
  }, [visibleResults]);

  const resultOptions = useMemo(() => {
    const options = {};
    for (const key of optionalFilterOrder) {
      options[key] = uniqueOptions(groupedResults, key);
    }
    return options;
  }, [groupedResults]);

  function updateFilter(key, value) {
    if (key === "rank" && value !== "" && !/^\d+$/.test(value)) {
      return;
    }

    setFilters((current) => {
      const next = { ...current, [key]: value };
      const startIndex = optionalFilterOrder.indexOf(key);
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

  function updateShareUrl(nextFilters = submitted || filters) {
    const params = new URLSearchParams();
    for (const key of ["year", "round_no", "rank", "rankBasis"]) {
      if (nextFilters[key]) params.set(key, nextFilters[key]);
    }
    for (const key of ["compare_years", ...optionalFilterOrder]) {
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
    setError("Share link copied to this page URL.");
  }

  function applyPreset(fieldKey, values) {
    updateFilter(fieldKey, values);
  }

  async function submitAnalysis(event) {
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
            <span className="spinner" aria-hidden="true" />
            <div>
              <strong>{isAnalyzing ? "Analyzing rank" : `Loading ${filters.year} data`}</strong>
              <p>{isAnalyzing ? "Preparing grouped college and course results..." : "Fetching cutoff data for the selected year..."}</p>
            </div>
          </div>
        </div>
      ) : null}
      <header className="page-header">
        <div>
          <p className="eyebrow">Static JoSAA cutoff analysis</p>
          <h1>JoSAA Rank Analysis</h1>
        </div>
        <div className="data-pill">{dataStatusLabel()}</div>
      </header>

      <form className="filter-panel" onSubmit={submitAnalysis}>
        <div className="quick-strip">
          {topInstitutePresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`quick-chip${presetIsSelected(filters.institute, preset.values) ? " is-active" : ""}`}
              onClick={() => applyPreset("institute", preset.values)}
            >
              {preset.label}
            </button>
          ))}
          {topFieldPreset ? (
            <button
              type="button"
              className={`quick-chip${presetIsSelected(filters.academic_program, topFieldPreset.values) ? " is-active" : ""}`}
              onClick={() => applyPreset("academic_program", topFieldPreset.values)}
            >
              Top fields
            </button>
          ) : null}
        </div>
        <div className="filter-grid">
          <label>
            <span>{labels.year}</span>
            <select value={filters.year} onChange={(event) => updateFilter("year", event.target.value)} required>
              <option value="">Select year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <MultiSelectFilter
            fieldKey="compare_years"
            label={labels.compare_years}
            options={yearOptions.filter((year) => String(year) !== String(filters.year))}
            searchIndex={searchIndex}
            searchValue={filterSearches.compare_years || ""}
            selected={filters.compare_years}
            onChange={(values) => updateFilter("compare_years", values)}
            onSearchChange={(value) => setFilterSearches((current) => ({ ...current, compare_years: value }))}
          />
          <label>
            <span>{labels.round_no}</span>
            <select value={filters.round_no} onChange={(event) => updateFilter("round_no", event.target.value)}>
              <option value="">All rounds</option>
              {roundOptions.map((round) => (
                <option key={round} value={round}>Round {round}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{labels.rank}</span>
            <input
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
          <label>
            <span>{labels.rankBasis}</span>
            <select value={filters.rankBasis} onChange={(event) => updateFilter("rankBasis", event.target.value)} required>
              <option value="closing_rank">Closing rank</option>
              <option value="opening_rank">Opening rank</option>
            </select>
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
          <button type="submit" disabled={filters.year && yearLoadState !== "ready"}>Analyze rank</button>
          <button type="button" className="secondary" onClick={copyShareUrl}>
            Copy/share link
          </button>
          <button type="button" className="secondary" onClick={() => { setFilters(emptyFilters); setSubmitted(null); setResultFilters(emptyResultFilters); setFilterSearches(emptyFilterSearches); setResultFilterSearches(emptyFilterSearches); setError(""); }}>
            Reset
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </form>

      <section className="content-grid">
        <div className="results-area">
          <div className="result-toolbar">
            <label>
              <span>Search results</span>
              <input value={resultFilters.search} placeholder="Institute, program, quota..." onChange={(event) => setResultFilters((current) => ({ ...current, search: event.target.value }))} />
            </label>
            <label>
              <span>{labels.status}</span>
              <select value={resultFilters.status} onChange={(event) => setResultFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value={ALL}>All statuses</option>
                <option value="possible">Possible</option>
                <option value="not-possible">Not possible</option>
                <option value="no-data">No cutoff</option>
              </select>
            </label>
            <label className="toggle-line">
              <input type="checkbox" checked={bestOnly} onChange={(event) => setBestOnly(event.target.checked)} />
              <span>Best possible only</span>
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
            <button type="button" className="secondary" onClick={() => downloadCsv(visibleResults)} disabled={!visibleResults.length}>
              Export CSV
            </button>
          </div>

          <div className="mobile-results">
            {!submitted ? (
              <div className="empty-card">Enter a year and rank, then submit to analyze results.</div>
            ) : visibleResults.length ? (
              visibleResults.map((row, index) => (
                <article key={`mobile-${row.year}-${row.institute}-${row.academic_program}-${row.quota}-${row.seat_type}-${row.gender_pool}-${index}`} className={`result-card row-${row.status}`}>
                  <div className="card-topline">
                    <span className={`status-dot status-${row.status}`}>{statusLabel(row.status)}</span>
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
                  <button type="button" className="card-detail-button" onClick={() => setSelectedDetail(row)}>Open details</button>
                </article>
              ))
            ) : (
              <div className="empty-card">No rows match the current result filters.</div>
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
                  <tr><td colSpan="12" className="empty-cell">Enter a year and rank, then submit to analyze results.</td></tr>
                ) : visibleResults.length ? (
                  visibleResults.map((row, index) => (
                    <tr key={`${row.year}-${row.institute}-${row.academic_program}-${row.quota}-${row.seat_type}-${row.gender_pool}-${index}`} className={`row-${row.status}`}>
                      <td><span className={`status-dot status-${row.status}`}>{statusLabel(row.status)}</span></td>
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
                      <td><button type="button" className="mini-button secondary-mini" onClick={() => setSelectedDetail(row)}>Open</button></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="12" className="empty-cell">No rows match the current result filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="summary-panel">
          <h2>Summary</h2>
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
        </aside>
      </section>

      <div className="mobile-action-bar">
        <button type="button" onClick={() => document.querySelector(".filter-panel")?.scrollIntoView({ behavior: "smooth" })}>Filters</button>
        <button type="button" onClick={submitAnalysis} disabled={!filters.year || yearLoadState !== "ready"}>Analyze</button>
        <span>{visibleResults.length.toLocaleString()} results</span>
      </div>

      {selectedDetail ? (
        <div className="detail-backdrop" role="dialog" aria-modal="true">
          <aside className="detail-drawer">
            <button type="button" className="detail-close" onClick={() => setSelectedDetail(null)}>Close</button>
            <span className={`status-dot status-${selectedDetail.status}`}>{statusLabel(selectedDetail.status)}</span>
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
          </aside>
        </div>
      ) : null}
    </main>
  );
}

export default App;
