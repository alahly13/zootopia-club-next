"use client";

import { ENV_KEYS } from "@zootopia/shared-config";
import type { ThemeMode } from "@zootopia/shared-types";
import { Monitor, MoonStar, SunMedium } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type ThemeToggleProps = {
  value: ThemeMode;
  label: string;
  labels: Record<ThemeMode, string>;
  variant?: "default" | "compact" | "toolbar" | "cycle-icon";
  modes?: readonly ThemeMode[];
};

const THEME_ORDER: ThemeMode[] = ["light", "dark", "system"];
const THEME_ICONS = {
  light: SunMedium,
  dark: MoonStar,
  system: Monitor,
} satisfies Record<ThemeMode, typeof SunMedium>;

function writeCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax${secure}`;
}

export function ThemeToggle({
  value,
  label,
  labels,
  variant = "default",
  modes,
}: ThemeToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const compact = variant === "compact";
  const toolbar = variant === "toolbar";
  const cycleIcon = variant === "cycle-icon";
  const availableModes = modes?.length ? [...new Set(modes)] : THEME_ORDER;
  /* The protected sidebar now exposes only light/dark while older cookies may still carry
     "system". Resolve the visible selection from the active media preference so the relocated
     shell control stays truthful without reintroducing a third visible option. */
  const displayedTheme =
    availableModes.includes(value)
      ? value
      : typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: light)").matches &&
          availableModes.includes("light")
        ? "light"
        : availableModes.includes("dark")
          ? "dark"
          : availableModes[0]!;

  function applyTheme(nextTheme: ThemeMode) {
    writeCookie(ENV_KEYS.themeCookie, nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    startTransition(() => {
      router.refresh();
    });
  }

  if (cycleIcon) {
    const ActiveThemeIcon = THEME_ICONS[displayedTheme];
    const nextTheme =
      availableModes[(availableModes.indexOf(displayedTheme) + 1) % availableModes.length];

    return (
      <div className="toggle-group toggle-group--cycle-icon">
        <p className="sr-only">{label}</p>
        <div className="toggle-shell">
          <button
            type="button"
            aria-label={`${label}: ${labels[displayedTheme]}`}
            title={`${label}: ${labels[displayedTheme]}`}
            disabled={isPending}
            onClick={() => applyTheme(nextTheme)}
            className="toggle-button toggle-button--idle"
          >
            <ActiveThemeIcon className="h-4 w-4" />
            <span className="sr-only">{labels[displayedTheme]}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`toggle-group${compact ? " toggle-group--compact" : ""}${
        toolbar ? " toggle-group--toolbar" : ""
      }`}
    >
      <p className={toolbar ? "sr-only" : "toggle-label"}>{label}</p>
      <div className="toggle-shell">
        {availableModes.map((theme) => {
          const selected = displayedTheme === theme;
          return (
            <button
              key={theme}
              type="button"
              aria-pressed={selected}
              aria-label={`${label}: ${labels[theme]}`}
              disabled={isPending}
              onClick={() => applyTheme(theme)}
              className={`toggle-button ${
                selected
                  ? "toggle-button--selected"
                  : "toggle-button--idle"
              }`}
            >
              {labels[theme]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
