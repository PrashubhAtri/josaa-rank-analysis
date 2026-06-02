import { useEffect, useMemo, useState } from "react";

const ALL = "ALL";

const emptyFilters = {
  year: "",
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

const emptyFilterSearches = Object.fromEntries(optionalFilterOrder.map((key) => [key, ""]));

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

function optionSearchText(searchIndex, key, value) {
  return normalizeSearch(`${value} ${searchIndex[key]?.[value] || ""}`);
}

function optionMatchesSearch(searchIndex, key, value, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = optionSearchText(searchIndex, key, value);
  return tokens.every((token) => haystack.includes(token));
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

function minRank(values) {
  const numericValues = values.map(Number).filter(Number.isFinite);
  return numericValues.length ? Math.min(...numericValues) : null;
}

function summarizeRounds(rounds) {
  return rounds
    .map((round) => `R${round.round_no}: ${formatRank(round.opening_rank)}-${formatRank(round.closing_rank)} (${statusLabel(round.status)})`)
    .join("; ");
}

function groupAnalyzedRows(rows) {
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
      round_no: row.round_no,
      opening_rank: row.opening_rank,
      closing_rank: row.closing_rank,
      cutoff_rank: row.cutoff_rank,
      status: row.status,
    });
  }

  return [...groups.values()].map((group) => {
    const rounds = group.rounds.sort((a, b) => Number(a.round_no) - Number(b.round_no));
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
  const visibleOptions = options.filter((value) => optionMatchesSearch(searchIndex, fieldKey, value, searchValue));
  const renderedOptions = visibleOptions.slice(0, 120);

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
  const [rows, setRows] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [searchIndex, setSearchIndex] = useState({});
  const [loadState, setLoadState] = useState("loading");
  const [yearLoadState, setYearLoadState] = useState("idle");
  const [filters, setFilters] = useState(emptyFilters);
  const [submitted, setSubmitted] = useState(null);
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
      setRows([]);
      setYearLoadState("idle");
      return;
    }

    const yearEntry = availableYears.find((entry) => String(entry.year) === String(filters.year));
    if (!yearEntry) {
      setRows([]);
      return;
    }

    const controller = new AbortController();
    setYearLoadState("loading");
    fetch(`/data/${yearEntry.file}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load /data/${yearEntry.file}`);
        return response.json();
      })
      .then((data) => {
        setRows(normalizeCutoffPayload(data));
        setYearLoadState("ready");
      })
      .catch((loadError) => {
        if (loadError.name === "AbortError") return;
        setRows([]);
        setError(loadError.message);
        setYearLoadState("error");
      });

    return () => controller.abort();
  }, [filters.year, availableYears]);

  const yearOptions = useMemo(() => sortText(new Set(availableYears.map((entry) => entry.year))).reverse(), [availableYears]);
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
    return applyFilterChain(rows, submitted)
      .map((row) => analyzeRow(row, rank, submitted.rankBasis))
      .sort(compareAnalyzedRows);
  }, [rows, submitted]);

  const groupedResults = useMemo(() => {
    return groupAnalyzedRows(analyzedRows).sort(compareGroupedRows);
  }, [analyzedRows]);

  const visibleResults = useMemo(() => {
    const search = resultFilters.search.trim().toLowerCase();
    return groupedResults.filter((row) => {
      if (resultFilters.status !== ALL && row.status !== resultFilters.status) return false;
      for (const key of optionalFilterOrder) {
        const selected = selectedValues(resultFilters[key]);
        if (selected.length && !selected.includes(row[key])) return false;
      }
      return rowMatchesSearch(searchIndex, row, search);
    });
  }, [groupedResults, resultFilters, searchIndex]);

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
      if (key === "year") next.round_no = "";
      return next;
    });
  }

  function submitAnalysis(event) {
    event.preventDefault();
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
    setSubmitted({ ...filters, rank });
    setResultFilters(emptyResultFilters);
    setResultFilterSearches(emptyFilterSearches);
  }

  function dataStatusLabel() {
    if (loadState === "loading") return "Loading data index";
    if (loadState === "error") return "Data index error";
    if (yearLoadState === "loading") return `Loading ${filters.year} data`;
    if (yearLoadState === "ready") return `${rows.length.toLocaleString()} rows loaded`;
    return `${availableYears.length} years available`;
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Static JoSAA cutoff analysis</p>
          <h1>JoSAA Rank Analysis</h1>
        </div>
        <div className="data-pill">{dataStatusLabel()}</div>
      </header>

      <form className="filter-panel" onSubmit={submitAnalysis}>
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
                  <th>Best opening</th>
                  <th>Best closing</th>
                </tr>
              </thead>
              <tbody>
                {!submitted ? (
                  <tr><td colSpan="10" className="empty-cell">Enter a year and rank, then submit to analyze results.</td></tr>
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
                      <td>{formatRank(row.opening_rank)}</td>
                      <td>{formatRank(row.closing_rank)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="10" className="empty-cell">No rows match the current result filters.</td></tr>
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
    </main>
  );
}

export default App;
