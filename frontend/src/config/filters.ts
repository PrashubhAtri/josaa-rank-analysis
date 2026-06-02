import type { FilterSearches, Filters, MultiFilterKey, OptionalFilterKey, ResultFilters } from "../types";

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

const filterValueFullForms: Partial<Record<OptionalFilterKey, Record<string, string>>> = {
  quota: {
    AI: "All India",
    GO: "Goa",
    HS: "Home State",
    JK: "Jammu and Kashmir",
    LA: "Ladakh",
    OS: "Other State",
  },
  seat_type: {
    EWS: "Economically Weaker Sections",
    "EWS (PwD)": "Economically Weaker Sections - Persons with Disabilities",
    "OBC-NCL": "Other Backward Classes - Non-Creamy Layer",
    "OBC-NCL (PwD)": "Other Backward Classes - Non-Creamy Layer, Persons with Disabilities",
    OPEN: "Open",
    "OPEN (PwD)": "Open - Persons with Disabilities",
    SC: "Scheduled Caste",
    "SC (PwD)": "Scheduled Caste - Persons with Disabilities",
    ST: "Scheduled Tribe",
    "ST (PwD)": "Scheduled Tribe - Persons with Disabilities",
  },
  rank_type: {
    CATEGORY_RANK: "Category Rank",
    CRL: "Common Rank List",
    PWD_CATEGORY_RANK: "PwD Category Rank",
  },
};

export function filterOptionLabel(fieldKey: MultiFilterKey, value: string) {
  const fullForm = filterValueFullForms[fieldKey as OptionalFilterKey]?.[value];
  return fullForm ? `${value} - ${fullForm}` : value;
}
