import { useEffect, useMemo, useRef, useState } from "react";
import { MultiSelectFilter } from "./components/filters/MultiSelectFilter";
import { ThemeIcon } from "./components/icons";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input, Select } from "./components/ui/input";
import { Sheet } from "./components/ui/sheet";
import { Skeleton } from "./components/ui/skeleton";
import {
  ALL,
  emptyFilterSearches,
  emptyFilters,
  emptyResultFilters,
  labels,
  optionalFilterOrder,
  RESULT_RENDER_LIMIT,
} from "./config/filters";
import { initialTheme, waitForPaint } from "./lib/browser";
import { downloadCsv } from "./lib/csv";
import {
  analyzeRow,
  applyFilterChain,
  compareAnalyzedRows,
  compareGroupedRows,
  errorMessage,
  formatBuffer,
  formatRank,
  groupAnalyzedRows,
  normalizeCutoffPayload,
  roundChipLabel,
  sortText,
  statusLabel,
  uniqueOptions,
} from "./lib/rank-analysis";
import { normalizeSearch, presetIsSelected, rowMatchesSearch, selectedValues, specialPresetsFor } from "./lib/search";
import { buildShareParams, initialFiltersFromUrl } from "./lib/url-state";
import type {
  CutoffPayload,
  CutoffRow,
  Filters,
  GroupedRow,
  ManifestEntry,
  OptionalFilterKey,
  RankBasis,
  ResultStatus,
  SearchIndex,
  Status,
  SubmittedFilters,
  ThemeMode,
} from "./types";

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

  const showRoundYears = Boolean(submitted?.compare_years.length);

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
    const params = buildShareParams(nextFilters);
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
                      <span key={`mobile-${row.institute}-${row.academic_program}-${round.year}-${round.round_no}`} className={`round-chip round-${round.status}`}>
                        {roundChipLabel(round, showRoundYears)}
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
                            <span key={`${row.institute}-${row.academic_program}-${round.year}-${round.round_no}`} className={`round-chip round-${round.status}`}>
                              {roundChipLabel(round, showRoundYears)}
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
