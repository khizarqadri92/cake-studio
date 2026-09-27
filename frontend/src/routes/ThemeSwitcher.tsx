import { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor, Check, Palette as PaletteIcon } from "lucide-react";
import { accountApi } from "../api/account";
import { useAuthStore } from "../store/authStore";
import { applyTheme, applyPalette, ThemePreference } from "../theme";
import { PALETTES, DEFAULT_PALETTE_ID } from "../theme/palettes";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSwitcher() {
  const staff = useAuthStore((s) => s.staff);
  const setPreferredTheme = useAuthStore((s) => s.setPreferredTheme);
  const setColorPalette = useAuthStore((s) => s.setColorPalette);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentTheme = (staff?.theme_preference as ThemePreference) ?? "system";
  const currentPalette = staff?.color_palette ?? DEFAULT_PALETTE_ID;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const chooseTheme = async (value: ThemePreference) => {
    await accountApi.setTheme(value);
    setPreferredTheme(value);
    applyTheme(value);
  };

  const choosePalette = async (id: string) => {
    await accountApi.setPalette(id);
    setColorPalette(id);
    applyPalette(id);
  };

  const CurrentIcon = THEME_OPTIONS.find((o) => o.value === currentTheme)?.icon ?? Monitor;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Appearance"
        aria-label="Appearance" className="h-11 w-11 flex items-center justify-center rounded-xl border border-hairline bg-surface hover:bg-flour transition-colors text-ink"
      >
        <CurrentIcon size={16} />
      </button>

      {open && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-56 bg-surface border border-hairline rounded-xl shadow-lg py-2 z-10">
          <p className="px-3 pb-1 text-[10px] font-medium text-muted">Mode</p>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => chooseTheme(value)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-ink/80 hover:bg-flour transition-colors"
            >
              <span className="flex items-center gap-2">
                <Icon size={14} />
                {label}
              </span>
              {value === currentTheme && <Check size={14} className="text-plum" />}
            </button>
          ))}

          <div className="border-t border-hairline my-2" />

          <p className="px-3 pb-1.5 text-[10px] font-medium text-muted flex items-center gap-1">
            <PaletteIcon size={11} /> Color
          </p>
          <div className="px-3 grid grid-cols-5 gap-2 pb-1">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                onClick={() => choosePalette(p.id)}
                title={p.label}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: p.plum }}
              >
                {p.id === currentPalette && <Check size={13} color="white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
