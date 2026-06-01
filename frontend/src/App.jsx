import { useEffect, useMemo, useState } from "react";

const ALL = "ALL";

const emptyFilters = {
  year: "",
  round_no: "",
  rank: "",
  rankBasis: "closing_rank",
  institute: ALL,
  academic_program: ALL,
  quota: ALL,
  seat_type: ALL,
  gender_pool: ALL,
  rank_type: ALL,
};

const emptyResultFilters = {
  status: ALL,
  institute: ALL,
  academic_program: ALL,
  quota: ALL,
  seat_type: ALL,
  gender_pool: ALL,
  rank_type: ALL,
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

function sortText(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
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

function uniqueOptions(rows, key) {
  return sortText(new Set(rows.map((row) => row[key]).filter((value) => value !== "" && value != null)));
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
    if (filters[key] && filters[key] !== ALL) {
      filtered = filtered.filter((row) => row[key] === filters[key]);
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
    "round_no",
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

function App() {
  const [rows, setRows] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [filters, setFilters] = useState(emptyFilters);
  const [submitted, setSubmitted] = useState(null);
  const [resultFilters, setResultFilters] = useState(emptyResultFilters);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/data/cutoffs.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load /data/cutoffs.json");
        }
        return response.json();
      })
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setLoadState("ready");
      })
      .catch((loadError) => {
        setError(loadError.message);
        setLoadState("error");
      });
  }, []);

  const yearOptions = useMemo(() => sortText(new Set(rows.map((row) => row.year))).reverse(), [rows]);
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

  const visibleResults = useMemo(() => {
    const search = resultFilters.search.trim().toLowerCase();
    return analyzedRows.filter((row) => {
      if (resultFilters.status !== ALL && row.status !== resultFilters.status) return false;
      for (const key of optionalFilterOrder) {
        if (resultFilters[key] !== ALL && row[key] !== resultFilters[key]) return false;
      }
      if (!search) return true;
      return [row.institute, row.academic_program, row.quota, row.seat_type, row.gender_pool, row.rank_type]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [analyzedRows, resultFilters]);

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
      options[key] = uniqueOptions(analyzedRows, key);
    }
    return options;
  }, [analyzedRows]);

  function updateFilter(key, value) {
    if (key === "rank" && value !== "" && !/^\d+$/.test(value)) {
      return;
    }

    setFilters((current) => {
      const next = { ...current, [key]: value };
      const startIndex = optionalFilterOrder.indexOf(key);
      if (key === "year" || key === "round_no") {
        for (const optionalKey of optionalFilterOrder) next[optionalKey] = ALL;
      } else if (startIndex >= 0) {
        for (const optionalKey of optionalFilterOrder.slice(startIndex + 1)) next[optionalKey] = ALL;
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
    setError("");
    setSubmitted({ ...filters, rank });
    setResultFilters(emptyResultFilters);
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Static JoSAA cutoff analysis</p>
          <h1>JoSAA Rank Analysis</h1>
        </div>
        <div className="data-pill">{loadState === "ready" ? `${rows.length.toLocaleString()} rows loaded` : "Loading data"}</div>
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
            <label key={key}>
              <span>{labels[key]}</span>
              <select value={filters[key]} onChange={(event) => updateFilter(key, event.target.value)}>
                <option value={ALL}>All {labels[key].toLowerCase()}s</option>
                {(filterOptions[key] || []).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="filter-actions">
          <button type="submit">Analyze rank</button>
          <button type="button" className="secondary" onClick={() => { setFilters(emptyFilters); setSubmitted(null); setResultFilters(emptyResultFilters); setError(""); }}>
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
              <label key={key}>
                <span>{labels[key]}</span>
                <select value={resultFilters[key]} onChange={(event) => setResultFilters((current) => ({ ...current, [key]: event.target.value }))} disabled={!submitted}>
                  <option value={ALL}>All</option>
                  {(resultOptions[key] || []).map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
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
                  <th>Opening</th>
                  <th>Closing</th>
                </tr>
              </thead>
              <tbody>
                {!submitted ? (
                  <tr><td colSpan="10" className="empty-cell">Enter a year and rank, then submit to analyze results.</td></tr>
                ) : visibleResults.length ? (
                  visibleResults.map((row, index) => (
                    <tr key={`${row.year}-${row.round_no}-${row.institute}-${row.academic_program}-${row.quota}-${row.seat_type}-${row.gender_pool}-${index}`} className={`row-${row.status}`}>
                      <td><span className={`status-dot status-${row.status}`}>{statusLabel(row.status)}</span></td>
                      <td>Round {row.round_no}</td>
                      <td>{row.institute}</td>
                      <td>{row.academic_program}</td>
                      <td>{row.quota}</td>
                      <td>{row.seat_type}</td>
                      <td>{row.gender_pool}</td>
                      <td>{row.rank_type}</td>
                      <td>{row.opening_rank ?? "-"}</td>
                      <td>{row.closing_rank ?? "-"}</td>
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
