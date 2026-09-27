import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { accountApi } from "../api/account";
import { useAuthStore } from "../store/authStore";
import { applyLanguage } from "../i18n";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "ur", label: "اردو" },
  { code: "ar", label: "العربية" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const setPreferredLanguage = useAuthStore((s) => s.setPreferredLanguage);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const choose = async (code: string) => {
    setOpen(false);
    setSaving(true);
    try {
      // Persist to this staff member's account only - never touches the
      // organization's default language, which stays whatever it was for
      // everyone else.
      await accountApi.setLanguage(code);
      setPreferredLanguage(code);
      applyLanguage(code);
    } finally {
      setSaving(false);
    }
  };

  const current = LANGUAGE_OPTIONS.find((l) => l.code === i18n.language) ?? LANGUAGE_OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        title={staff?.preferred_language ? "Your personal language" : "Following organization default"}
        aria-label="Language" className="h-11 flex items-center gap-1.5 px-3 rounded-xl border border-hairline bg-surface hover:bg-flour transition-colors text-sm text-ink disabled:opacity-50"
      >
        <Globe size={16} />
        <span>{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-44 bg-surface border border-hairline rounded-xl shadow-lg py-1 z-10">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              onClick={() => choose(opt.code)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-ink/80 hover:bg-flour transition-colors"
            >
              {opt.label}
              {opt.code === i18n.language && <Check size={14} className="text-plum" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
