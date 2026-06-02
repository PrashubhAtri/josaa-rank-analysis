import type { FilterSearches, Filters, ResultFilters } from "../types";

export const ALL = "ALL";

export const optionalFilterOrder = [
  "institute",
  "academic_program",
  "quota",
  "seat_type",
  "gender_pool",
  "rank_type",
] as const;

export const emptyFilters: Filters = {
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

export const emptyResultFilters: ResultFilters = {
  status: ALL,
  institute: [],
  academic_program: [],
  quota: [],
  seat_type: [],
  gender_pool: [],
  rank_type: [],
  search: "",
};

export const labels: Record<keyof Filters | "status", string> = {
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

export const emptyFilterSearches = Object.fromEntries(
  ["compare_years", ...optionalFilterOrder].map((key) => [key, ""]),
) as FilterSearches;

export const TOP_7_IITS = [
  "Indian Institute of Technology Delhi",
  "Indian Institute of Technology Bombay",
  "Indian Institute of Technology Madras",
  "Indian Institute of Technology Kharagpur",
  "Indian Institute of Technology Kanpur",
  "Indian Institute of Technology Roorkee",
  "Indian Institute of Technology Guwahati",
];

export const RESULT_RENDER_LIMIT = 500;
