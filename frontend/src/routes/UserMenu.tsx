import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Deterministic accent pick from name, so the same person always gets the same color.
const AVATAR_COLORS = ["bg-plum", "bg-honey", "bg-sage"];
function colorFor(name: string) {
  const sum = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function UserMenu() {
  const { t } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!staff) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-ink/5 transition-colors"
        aria-expanded={open}
      >
        <div
          className={`w-10 h-10 rounded-full ${colorFor(staff.full_name)} flex items-center justify-center text-cream text-sm font-bold`}
        >
          {initialsOf(staff.full_name)}
        </div>
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm text-ink font-semibold">{staff.full_name}</span>
          {staff.role_names && staff.role_names.length > 0 && (
            <span className="text-xs text-muted">{staff.role_names.join(", ")}</span>
          )}
        </span>
        <ChevronDown size={15} className="text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-52 bg-surface border border-hairline rounded-xl shadow-lg py-1.5 z-20">
          <Link
            to="/admin/security"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink/80 hover:bg-flour transition-colors"
          >
            <ShieldCheck size={15} />
            {t("nav.securitySettings")}
          </Link>
          <button
            onClick={clearSession}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink/80 hover:bg-flour transition-colors"
          >
            <LogOut size={15} />
            {t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
