import type { ALL, optionalFilterOrder } from "./config/filters";

export type OptionalFilterKey = (typeof optionalFilterOrder)[number];
export type MultiFilterKey = "compare_years" | OptionalFilterKey;
export type RankBasis = "closing_rank" | "opening_rank";
export type Status = "possible" | "not-possible" | "no-data";
export type ResultStatus = Status | typeof ALL;
export type RankValue = string | number | null | undefined;
export type SearchIndex = Record<string, Record<string, string>>;
export type ThemeMode = "light" | "dark";

export type Filters = {
  year: string;
  compare_years: string[];
  round_no: string;
  rank: string;
  rankBasis: RankBasis;
} & Record<OptionalFilterKey, string[]>;

export type SubmittedFilters = Omit<Filters, "rank"> & {
  rank: number;
};

export type ResultFilters = {
  status: ResultStatus;
  search: string;
} & Record<OptionalFilterKey, string[]>;

export type FilterSearches = Record<MultiFilterKey, string>;

export type ManifestEntry = {
  year: string | number;
  file: string;
};

export type CutoffRow = {
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

export type AnalyzedRow = CutoffRow & {
  cutoff_rank: RankValue;
  status: Status;
};

export type AnalyzedRound = {
  year: string | number;
  round_no: string | number;
  opening_rank: RankValue;
  closing_rank: RankValue;
  cutoff_rank: RankValue;
  buffer: number | null;
  status: Status;
};

export type GroupedRow = AnalyzedRow & {
  rounds: AnalyzedRound[];
  round_count: number;
  rounds_label: string;
  opening_rank: RankValue;
  closing_rank: RankValue;
  cutoff_rank: RankValue;
  buffer: number | null;
  buffer_label: string;
};

export type CutoffPayload =
  | CutoffRow[]
  | {
      columns?: string[];
      rows?: RankValue[][];
    };
