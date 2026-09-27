import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

export function ProcessingDateBadge() {
  const { t } = useTranslation();
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    api.get("/system/processing-date").then((res) => setDate(res.data.processing_date));
  }, []);

  if (!date) return null;

  return (
    <div
      className="relative -rotate-2 border-2 border-plum/70 rounded px-3 py-1 select-none"
      title={t("system.processingDate")}
    >
      <span className="font-mono text-[10px] tracking-wider text-plum/70 uppercase block leading-none mb-0.5">
        {t("system.processingDate")}
      </span>
      <span className="font-mono text-xs text-plum font-medium leading-none block">
        {date}
      </span>
    </div>
  );
}
