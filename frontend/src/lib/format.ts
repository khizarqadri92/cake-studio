import { useNumberFormatStore } from "../store/numberFormatStore";

/** Separators from the Organization "Number format" sample ("1,234.56", "1.234,56", "1 234.56"). */
function separators(sample: string): { group: string; decimal: string } {
  switch (sample) {
    case "1.234,56": return { group: ".", decimal: "," };
    case "1 234.56": return { group: "\u202F", decimal: "." }; // narrow no-break space
    default: return { group: ",", decimal: "." };
  }
}

export function formatNumber(value: number | null | undefined, decimals: number, sample: string): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const { group, decimal } = separators(sample);
  const fixed = Math.abs(Number(value)).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const sign = Number(value) < 0 && Number(fixed) !== 0 ? "-" : "";
  return sign + grouped + (frac ? decimal + frac : "");
}

/** Money: 1,234.50 (no currency sign) */
export function fmtAmount(value: number | null | undefined): string {
  const s = useNumberFormatStore.getState();
  return formatNumber(value, s.amount_decimals, s.number_format);
}

/** Money with the currency prefix: Rs 1,234.50 */
export function fmtMoney(value: number | null | undefined, currency = "Rs"): string {
  const text = fmtAmount(value);
  return text === "—" ? text : `${currency} ${text}`;
}

/** Quantities: trailing zeros trimmed, so 2 kg shows "2", 0.125 kg shows "0.125" */
export function fmtQty(value: number | null | undefined): string {
  const s = useNumberFormatStore.getState();
  const text = formatNumber(value, s.quantity_decimals, s.number_format);
  if (text === "—" || s.quantity_decimals === 0) return text;
  const { decimal } = separators(s.number_format);
  return text.includes(decimal) ? text.replace(new RegExp(`\\${decimal}?0+$`), "") : text;
}

/** Step for money inputs: 0.01 for 2 decimals, 1 for 0 decimals */
export function amountStep(): string {
  const d = useNumberFormatStore.getState().amount_decimals;
  return d === 0 ? "1" : (1 / 10 ** d).toFixed(d);
}

/** Plain value for a money input box (no separators), e.g. "4500.00" */
export function amountInputValue(value: number): string {
  return Number(value).toFixed(useNumberFormatStore.getState().amount_decimals);
}


/** "14:30" -> "02:30 PM" (12-hour) or "14:30" (24-hour), per Organization > Locale.
 *  Anything that isn't a HH:MM time (e.g. old free-text "after 5") is shown as typed. */
export function fmtTime(value: string | null | undefined, pattern?: string): string {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim())) return value;
  const h = Number(m[1]), min = m[2];
  const fmt = pattern ?? useNumberFormatStore.getState().time_format ?? "hh:mm A";
  if (fmt.startsWith("HH")) return `${String(h).padStart(2, "0")}:${min}`;
  return `${String(h % 12 || 12).padStart(2, "0")}:${min} ${h < 12 ? "AM" : "PM"}`;
}
