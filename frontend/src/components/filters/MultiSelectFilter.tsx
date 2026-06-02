import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CheckIcon } from "../icons";
import type { MultiFilterKey, SearchIndex } from "../../types";
import {
  optionMatchesSearch,
  presetIsSelected,
  selectedValues,
  specialOptionRank,
  specialPresetsFor,
} from "../../lib/search";

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

function multiValueLabel(selectedList: string[], placeholder: string) {
  if (!selectedList.length) return placeholder;
  if (selectedList.length === 1) return selectedList[0];
  return `${selectedList.length} selected`;
}

export function MultiSelectFilter({
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
