import { useNumberFormatStore } from "../store/numberFormatStore";
import { fmtTime } from "../lib/format";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };
const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/**
 * Delivery-time dropdown in 30-minute steps. Times within the shop's opening
 * hours for that day come first; the rest of the day is still selectable under
 * "Outside opening hours". Saves "HH:MM"; shows 12- or 24-hour per settings.
 */
export function TimeSelect({ value, onChange, date, className, id }: {
  value: string | null | undefined;
  onChange: (value: string | undefined) => void;
  date?: string | null;              // YYYY-MM-DD, to pick that weekday's opening hours
  className?: string;
  id?: string;
}) {
  const hours = useNumberFormatStore((s) => s.business_hours);
  const timeFormat = useNumberFormatStore((s) => s.time_format);

  const all = Array.from({ length: 48 }, (_, i) => toHHMM(i * 30));
  let open: string[] = [];
  let note = "";
  if (date && hours) {
    const [y, mo, d] = date.split("-").map(Number);
    const day = hours[DAY_KEYS[new Date(y, mo - 1, d).getDay()]];
    if (day?.closed) note = "The shop is closed on this day";
    else if (day?.open && day?.close) {
      const from = toMinutes(day.open), to = toMinutes(day.close);
      open = all.filter((t) => toMinutes(t) >= from && toMinutes(t) <= to);
    }
  }
  const outside = all.filter((t) => !open.includes(t));
  // An older order may hold free text ("after 5") or an off-grid time: keep it selectable.
  const extra = value && !all.includes(value) ? value : null;
  const label = (t: string) => fmtTime(t, timeFormat);

  return (
    <select id={id} className={className} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">No specific time</option>
      {extra && <option value={extra}>{label(extra)} (as entered)</option>}
      {open.length > 0 && (
        <optgroup label="Opening hours">{open.map((t) => <option key={t} value={t}>{label(t)}</option>)}</optgroup>
      )}
      <optgroup label={open.length > 0 ? "Outside opening hours" : note || "Any time"}>
        {(open.length > 0 ? outside : all).map((t) => <option key={t} value={t}>{label(t)}</option>)}
      </optgroup>
    </select>
  );
}
