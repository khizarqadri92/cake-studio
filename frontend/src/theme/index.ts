export type ThemePreference = "light" | "dark" | "system";

const media = window.matchMedia("(prefers-color-scheme: dark)");

function resolveIsDark(pref: ThemePreference | null | undefined): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return media.matches; // "system" or unset - follow the OS
}

export function applyTheme(pref: ThemePreference | null | undefined) {
  document.documentElement.classList.toggle("dark", resolveIsDark(pref));
}

export function applyPalette(paletteId: string | null | undefined) {
  if (!paletteId || paletteId === "plum") {
    delete document.documentElement.dataset.palette; // "plum" values already live in :root
  } else {
    document.documentElement.dataset.palette = paletteId;
  }
}

// Keep the page live-updating if the OS theme changes while someone is on
// "system" mode - re-checked on every call since the caller always knows
// the current preference (avoids a global mutable "current pref" here).
export function watchSystemTheme(getCurrentPref: () => ThemePreference | null | undefined) {
  const handler = () => {
    if (!getCurrentPref() || getCurrentPref() === "system") {
      applyTheme("system");
    }
  };
  media.addEventListener("change", handler);
  return () => media.removeEventListener("change", handler);
}
