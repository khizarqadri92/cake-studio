import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

/** The business (processing) date, shown at the foot of the sidebar.
 *  Every transaction is booked against this date, not the computer clock. */
export function ProcessingDateCard() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<{ processing_date: string; is_day_locked?: boolean; date_mode?: "processing" | "system" } | null>(null);

  useEffect(() => {
    const load = () => api.get("/system/processing-date").then((res) => setInfo(res.data)).catch(() => setInfo(null));
    load();
    // System setup announces date / date-mode changes so this card never goes stale
    window.addEventListener("business-date-changed", load);
    return () => window.removeEventListener("business-date-changed", load);
  }, []);

  if (!info) return null;
  const system = info.date_mode === "system";
  const d = new Date(`${info.processing_date}T00:00:00`);
  const pretty = isNaN(d.getTime())
    ? info.processing_date
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="rounded-xl bg-plum/60 px-4 py-3.5" title={system ? t("system.systemDate") : t("system.processingDate")}>
      <p className="text-[11px] text-cream/75">{system ? t("system.systemDate") : t("system.processingDate")}</p>
      <p className="font-display text-[22px] leading-tight text-cream mt-0.5">{pretty}</p>
      <p className="text-xs text-cream/75 mt-0.5">{system ? t("system.dateAutomatic") : info.is_day_locked ? t("system.dayLocked") : t("system.dayOpen")}</p>
    </div>
  );
}
