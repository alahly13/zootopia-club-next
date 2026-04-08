"use client";

import { Check, ChevronDown, Search, type LucideIcon } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export type SettingsSelectOption = {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  leadingVisual?: string;
  searchTokens?: string[];
};

type SettingsCountrySelectProps = {
  id?: string;
  label: string;
  labelVisuallyHidden?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  searchEmpty: string;
  value: string;
  options: SettingsSelectOption[];
  icon: LucideIcon;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
};

function normalizeSearchValue(value: string) {
  return String(value || "").trim().toLocaleLowerCase();
}

export function SettingsCountrySelect({
  id,
  label,
  labelVisuallyHidden = false,
  placeholder,
  searchPlaceholder,
  searchEmpty,
  value,
  options,
  icon: Icon,
  onChange,
  error,
  disabled = false,
}: SettingsCountrySelectProps) {
  const generatedId = useId();
  const controlId = id ?? `settings-country-select-${generatedId}`;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const selectedOption =
    options.find((option) => option.value === value) ?? null;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(deferredQuery);
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const searchIndex = [
        option.label,
        option.description,
        option.badge,
        ...(option.searchTokens ?? []),
      ]
        .filter(Boolean)
        .map((token) => normalizeSearchValue(token ?? ""))
        .join(" ");

      return searchIndex.includes(normalizedQuery);
    });
  }, [deferredQuery, options]);

  const closeMenu = useEffectEvent(() => {
    setOpen(false);
    setQuery("");
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });

    function handlePointerDown(event: PointerEvent) {
      if (!shellRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={shellRef}
      data-open={open ? "true" : "false"}
      className="settings-select-shell group"
    >
      <p
        id={`${controlId}-label`}
        className={
          labelVisuallyHidden
            ? "sr-only"
            : "mb-2 text-sm font-semibold text-foreground transition-colors group-focus-within:text-emerald-700 dark:group-focus-within:text-emerald-200"
        }
      >
        {label}
      </p>

      {/* Settings country pickers keep their menu inside a local stacking context so the searchable panel can sit above neighboring cards without leaking a global z-index override across the protected workspace. */}
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${controlId}-listbox`}
        aria-labelledby={`${controlId}-label ${controlId}`}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={`settings-select-trigger ${open ? "settings-select-trigger--open" : ""}`}
      >
        <span className="settings-select-trigger__icon">
          <Icon className="h-4 w-4" />
        </span>

        <span className="settings-select-trigger__copy">
          <span
            className={`settings-select-trigger__label ${
              selectedOption ? "" : "settings-select-trigger__placeholder"
            }`}
          >
            {selectedOption ? (
              <span className="settings-select-inline-value">
                {selectedOption.leadingVisual ? (
                  <span
                    aria-hidden="true"
                    className="settings-select-inline-value__leading"
                  >
                    {selectedOption.leadingVisual}
                  </span>
                ) : null}
                <span>{selectedOption.label}</span>
                {selectedOption.badge ? (
                  <span className="settings-select-inline-value__badge">
                    {selectedOption.badge}
                  </span>
                ) : null}
              </span>
            ) : (
              placeholder
            )}
          </span>

          {selectedOption?.description ? (
            <span className="settings-select-trigger__description">
              {selectedOption.description}
            </span>
          ) : null}
        </span>

        <ChevronDown
          className={`settings-select-trigger__chevron h-4 w-4 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="settings-select-panel">
          <div className="settings-select-panel__search">
            <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={searchPlaceholder}
              className="settings-select-panel__search-input"
            />
          </div>

          <div
            id={`${controlId}-listbox`}
            role="listbox"
            aria-labelledby={`${controlId}-label`}
            className="settings-select-panel__list side-scrollbar"
          >
            {filteredOptions.length === 0 ? (
              <p className="settings-select-empty">{searchEmpty}</p>
            ) : (
              filteredOptions.map((option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`settings-select-option ${selected ? "settings-select-option--selected" : ""}`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setQuery("");
                      triggerRef.current?.focus();
                    }}
                  >
                    <span className="settings-select-option__copy">
                      <span className="settings-select-option__title-row">
                        {option.leadingVisual ? (
                          <span
                            aria-hidden="true"
                            className="settings-select-option__leading"
                          >
                            {option.leadingVisual}
                          </span>
                        ) : null}
                        <span className="settings-select-option__label">
                          {option.label}
                        </span>
                        {option.badge ? (
                          <span className="settings-select-option__badge">
                            {option.badge}
                          </span>
                        ) : null}
                      </span>

                      {option.description ? (
                        <span className="settings-select-option__description">
                          {option.description}
                        </span>
                      ) : null}
                    </span>

                    <span className="settings-select-option__meta">
                      {selected ? (
                        <span className="settings-select-option__check">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
