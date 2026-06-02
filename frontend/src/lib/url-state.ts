import { emptyFilters, optionalFilterOrder } from "../config/filters";
import type { Filters, RankBasis, RankValue } from "../types";
import { selectedValues } from "./search";

function decodeList(value: string | null) {
  return value ? value.split("|").map(decodeURIComponent).filter(Boolean) : [];
}

export function encodeList(values: string[] | string | number | null | undefined) {
  return selectedValues(values).map(encodeURIComponent).join("|");
}

export function initialFiltersFromUrl(): Filters {
  const params = new URLSearchParams(window.location.search);
  const rankBasis: RankBasis = params.get("rankBasis") === "opening_rank" ? "opening_rank" : "closing_rank";

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

export function buildShareParams(nextFilters: Filters | (Omit<Filters, "rank"> & { rank: RankValue })) {
  const params = new URLSearchParams();
  for (const key of ["year", "round_no", "rank", "rankBasis"] as const) {
    if (nextFilters[key]) params.set(key, String(nextFilters[key]));
  }
  for (const key of ["compare_years", ...optionalFilterOrder] as const) {
    const encoded = encodeList(nextFilters[key]);
    if (encoded) params.set(key, encoded);
  }
  return params;
}
