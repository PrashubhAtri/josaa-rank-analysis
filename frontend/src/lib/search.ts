import { ALL, optionalFilterOrder, TOP_7_IITS } from "../config/filters";
import type { GroupedRow, MultiFilterKey, RankValue, SearchIndex } from "../types";

export function normalizeSearch(value: RankValue) {
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

export function selectedValues(value: string[] | string | number | null | undefined) {
  return Array.isArray(value) ? value.map(String) : value && value !== ALL ? [String(value)] : [];
}

function optionSearchText(searchIndex: SearchIndex, key: string, value: RankValue) {
  return normalizeSearch(`${value} ${searchIndex[key]?.[String(value)] || ""}`);
}

export function optionMatchesSearch(searchIndex: SearchIndex, key: string, value: string, query: string) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = optionSearchText(searchIndex, key, value);
  return tokens.every((token) => haystack.includes(token));
}

function isIit(value: RankValue) {
  return String(value).startsWith("Indian Institute of Technology");
}

export function specialPresetsFor(fieldKey: MultiFilterKey, options: string[], _searchIndex: SearchIndex) {
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

  return [];
}

export function specialOptionRank(fieldKey: MultiFilterKey, value: string) {
  if (fieldKey === "institute") {
    const topIndex = TOP_7_IITS.indexOf(value);
    if (topIndex >= 0) return topIndex;
    if (isIit(value)) return 100;
  }

  return 1000;
}

export function presetIsSelected(selected: string[] | string, values: string[]) {
  const selectedSet = new Set(selectedValues(selected));
  return values.length > 0 && values.every((value) => selectedSet.has(value));
}

export function rowMatchesSearch(searchIndex: SearchIndex, row: GroupedRow, query: string) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = optionalFilterOrder
    .map((key) => optionSearchText(searchIndex, key, row[key]))
    .join(" ");
  return tokens.every((token) => haystack.includes(token));
}
