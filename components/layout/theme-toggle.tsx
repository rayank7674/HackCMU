"use client";

import { nextTheme, useTheme } from "@/lib/use-theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const label =
    theme === "system"
      ? "System theme"
      : theme === "light"
        ? "Light theme"
        : "Dark theme";

  return (
    <button
      type="button"
      className="sr-theme-toggle sr-motion-button"
      aria-label={`${label}. Switch theme`}
      title={label}
      onClick={() => setTheme(nextTheme(theme))}
    >
      <span aria-hidden="true">
        {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
      </span>
    </button>
  );
}
