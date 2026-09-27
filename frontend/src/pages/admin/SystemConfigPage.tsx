import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { Can } from "../../components/Can";
import { formatNumber } from "../../lib/format";
import { useNumberFormatStore } from "../../store/numberFormatStore";
import { useAuthStore } from "../../store/authStore";

interface EmployeeCodeFormat {
  prefix: string;
  separator: string;
  padding: number;
  include_year: boolean;
  next_sequence: number;
  preview: string;
}

const inputClass = "border border-hairline rounded-lg px-2 py-1.5 text-sm bg-surface outline-none focus:border-plum transition-colors";

export function SystemConfigPage() {
  const { t } = useTranslation();
  const [processingDate, setProcessingDate] = useState<string>("");
  const [newDate, setNewDate] = useState<string>("");

  const [format, setFormat] = useState<EmployeeCodeFormat | null>(null);

  // Decimal places: start from what's loaded app-wide, save back to it
  const numberFormat = useNumberFormatStore();
  const [amountDecimals, setAmountDecimals] = useState(numberFormat.amount_decimals);
  const [quantityDecimals, setQuantityDecimals] = useState(numberFormat.quantity_decimals);
  const [decimalsSaving, setDecimalsSaving] = useState(false);
  const [decimalsMessage, setDecimalsMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    setAmountDecimals(numberFormat.amount_decimals);
    setQuantityDecimals(numberFormat.quantity_decimals);
  }, [numberFormat.amount_decimals, numberFormat.quantity_decimals]);
  const decimalsChanged =
    amountDecimals !== numberFormat.amount_decimals || quantityDecimals !== numberFormat.quantity_decimals;

  // --- Kitchen ticket printing ---
  type PrinterForm = { printer_mode: "browser" | "network" | "off"; printer_host: string | null; printer_port: number; printer_width: number; phone_country_code: string };
  const [printer, setPrinter] = useState<PrinterForm | null>(null);
  const [printerSaved, setPrinterSaved] = useState<PrinterForm | null>(null);
  const [printerBusy, setPrinterBusy] = useState<"save" | "test" | null>(null);
  const [printerMessage, setPrinterMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const canEditPrinter = useAuthStore((st) => st.permissions.has("system.config.field.printer.edit"));
  useEffect(() => {
    api.get("/system/printer").then((r) => { setPrinter(r.data); setPrinterSaved(r.data); }).catch(() => {});
  }, []);
  const printerChanged = !!printer && JSON.stringify(printer) !== JSON.stringify(printerSaved);
  const savePrinter = async () => {
    if (!printer) return;
    setPrinterBusy("save");
    setPrinterMessage(null);
    try {
      const r = await api.put("/system/printer", printer);
      setPrinter(r.data);
      setPrinterSaved(r.data);
      setPrinterMessage({ ok: true, text: "Printing settings saved." });
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      setPrinterMessage({ ok: false, text: Array.isArray(d) ? d.map((x: any) => x.msg).join("; ") : d ?? "Couldn't save printing settings." });
    } finally {
      setPrinterBusy(null);
    }
  };
  const testPrinter = async () => {
    setPrinterBusy("test");
    setPrinterMessage(null);
    try {
      const r = await api.post("/system/printer/test");
      setPrinterMessage({ ok: true, text: `Test ticket sent to ${r.data.printer}. Check the printer.` });
    } catch (err: any) {
      setPrinterMessage({ ok: false, text: err?.response?.data?.detail ?? "The test print failed." });
    } finally {
      setPrinterBusy(null);
    }
  };

  const canEditDecimals = useAuthStore((st) => st.permissions.has("system.config.field.decimals.edit"));

  const saveDecimals = async () => {
    setDecimalsSaving(true);
    setDecimalsMessage(null);
    try {
      const res = await api.put("/system/number-format", { amount_decimals: amountDecimals, quantity_decimals: quantityDecimals });
      numberFormat.set(res.data);
      setDecimalsMessage({ ok: true, text: "Saved. Every screen now uses these decimal places." });
    } catch (err: any) {
      setDecimalsMessage({ ok: false, text: err?.response?.data?.detail ?? "Couldn't save decimal places." });
    } finally {
      setDecimalsSaving(false);
    }
  };
  const [savingFormat, setSavingFormat] = useState(false);

  // --- Business date: system date or a processing date set by hand ---
  const [dateMode, setDateMode] = useState<"processing" | "system">("processing");
  const [dayLocked, setDayLocked] = useState(false);
  const [dateBusy, setDateBusy] = useState(false);
  const [dateMessage, setDateMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const canEditDate = useAuthStore((st) => st.permissions.has("system.config.field.processing_date.edit"));
  const prettyDate = (iso: string) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const applyDate = (d: { processing_date: string; date_mode?: "processing" | "system"; is_day_locked?: boolean }) => {
    setProcessingDate(d.processing_date);
    if (d.date_mode) setDateMode(d.date_mode);
    setDayLocked(!!d.is_day_locked);
  };
  const announceDateChange = () => window.dispatchEvent(new Event("business-date-changed"));

  const changeMode = async (mode: "processing" | "system") => {
    if (mode === dateMode) return;
    setDateBusy(true);
    setDateMessage(null);
    try {
      const res = await api.put("/system/date-mode", { date_mode: mode });
      applyDate(res.data);
      announceDateChange();
      setDateMessage({
        ok: true,
        text: mode === "system"
          ? "Now using the system date. Everything is dated with today's date automatically."
          : `Now using a processing date, starting from ${prettyDate(res.data.processing_date)}. Advance it at the end of each day.`,
      });
    } catch (err: any) {
      setDateMessage({ ok: false, text: err?.response?.data?.detail ?? "Couldn't change the date setting." });
    } finally {
      setDateBusy(false);
    }
  };

  useEffect(() => {
    api.get("/system/processing-date").then((res) => applyDate(res.data));
    api.get("/system/employee-code-format").then((res) => setFormat(res.data));
  }, []);

  const handleAdvance = async () => {
    if (!newDate) { setDateMessage({ ok: false, text: "Pick the new processing date first." }); return; }
    setDateBusy(true);
    setDateMessage(null);
    try {
      const res = await api.put("/system/processing-date", { new_date: newDate });
      setProcessingDate(res.data.processing_date);
      announceDateChange();
      setDateMessage({ ok: true, text: `Processing date set to ${prettyDate(res.data.processing_date)}.` });
    } catch (err: any) {
      setDateMessage({ ok: false, text: err?.response?.data?.detail ?? "Couldn't change the processing date." });
    } finally {
      setDateBusy(false);
    }
  };

  const saveFormat = async () => {
    if (!format) return;
    setSavingFormat(true);
    try {
      const res = await api.put("/system/employee-code-format", {
        prefix: format.prefix,
        separator: format.separator,
        padding: format.padding,
        include_year: format.include_year,
      });
      setFormat(res.data);
    } finally {
      setSavingFormat(false);
    }
  };

  return (
    <Can permission="system.config.page.view">
      <div className="p-6 max-w-2xl space-y-10">
        <h1 className="text-lg font-medium">{t("system.title")}</h1>

        <section>
          <h2>Business date</h2>
          <p className="text-sm text-muted -mt-2 mb-4">
            The date used for new orders, stock, purchases, receipts, reports and the dashboard.
          </p>

          <div className="inline-flex rounded-xl border border-hairline bg-flour p-1" role="radiogroup" aria-label="Date to use">
            {([["system", "Use system date"], ["processing", "Use processing date"]] as const).map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={dateMode === value}
                disabled={!canEditDate || dateBusy}
                onClick={() => changeMode(value)}
                className={`h-10 px-4 rounded-lg text-sm font-semibold transition-colors disabled:cursor-default ${
                  dateMode === value ? "bg-plum text-cream shadow-sm" : "text-ink/75 hover:text-ink disabled:hover:text-ink/75"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            {dateMode === "system"
              ? "Today's date from the computer (in the organisation's time zone) is used automatically. Nothing to advance."
              : "A date you set here is used, and stays the same until you advance it - even overnight. Useful for closing a day before starting the next."}
          </p>

          <div className="mt-4 rounded-xl bg-flour px-4 py-3">
            <p className="text-xs text-muted">{dateMode === "system" ? "Today's date" : t("system.processingDate")}</p>
            <p className="font-display text-xl font-semibold text-ink">{prettyDate(processingDate)}</p>
            {dateMode === "processing" && dayLocked && <p className="text-xs text-plum mt-0.5">This day is locked.</p>}
          </div>

          {dateMode === "processing" && (
            <Can permission="system.config.field.processing_date.edit">
              <div className="flex flex-wrap gap-2 mt-4">
                <input
                  type="date"
                  aria-label="New processing date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className={`${inputClass} w-auto`}
                />
                <button onClick={handleAdvance} disabled={dateBusy} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                  {t("system.advanceDate")}
                </button>
              </div>
            </Can>
          )}
          {dateMessage && <p className={`text-sm mt-3 ${dateMessage.ok ? "text-sage" : "text-plum"}`} role="status">{dateMessage.text}</p>}
        </section>

        <section>
          <h2>Decimal places</h2>
          <p className="text-sm text-muted -mt-2 mb-4">
            How many digits appear after the decimal point, everywhere in the system.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">Amounts</span>
              <select
                className={`${inputClass} w-full`}
                value={amountDecimals}
                disabled={!canEditDecimals}
                onChange={(e) => setAmountDecimals(Number(e.target.value))}
              >
                {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="block text-xs text-muted mt-1.5">Prices, totals and payments</span>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">Quantities</span>
              <select
                className={`${inputClass} w-full`}
                value={quantityDecimals}
                disabled={!canEditDecimals}
                onChange={(e) => setQuantityDecimals(Number(e.target.value))}
              >
                {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="block text-xs text-muted mt-1.5">Stock and ingredient amounts</span>
            </label>
          </div>
          <div className="mt-4 rounded-xl bg-flour px-4 py-3 text-sm">
            <p className="text-xs text-muted mb-1">Preview</p>
            <p className="text-ink">
              Order total <span className="font-mono">Rs {formatNumber(12345.678, amountDecimals, numberFormat.number_format)}</span>
              <span className="text-muted"> · </span>
              Flour used <span className="font-mono">{formatNumber(2.125, quantityDecimals, numberFormat.number_format)} kg</span>
            </p>
            <p className="text-xs text-muted mt-1">
              Separators follow Organization → Locale → Number format ({numberFormat.number_format}).
            </p>
          </div>
          <p className="text-xs text-muted mt-3">
            Amounts are rounded to this when saved. Stock is always tracked precisely and only rounded on screen.
          </p>
          {decimalsMessage && (
            <p className={`text-sm mt-3 ${decimalsMessage.ok ? "text-sage" : "text-plum"}`} role="status">{decimalsMessage.text}</p>
          )}
          <Can permission="system.config.field.decimals.edit">
            <button
              onClick={saveDecimals}
              disabled={!decimalsChanged || decimalsSaving}
              className="mt-4 bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-40"
            >
              {decimalsSaving ? "Saving…" : "Save decimal places"}
            </button>
          </Can>
        </section>

        {printer && (
          <section>
            <h2>Kitchen ticket printing</h2>
            <p className="text-sm text-muted -mt-2 mb-4">What happens when an order is confirmed.</p>
            <div className="space-y-2" role="radiogroup" aria-label="Printing mode">
              {([
                ["network", "Receipt printer on the network", "The server sends the ticket straight to a thermal (ESC/POS) printer. Nothing to click, and it prints even if no one has the page open."],
                ["browser", "Print from the browser", "The ticket opens in the print dialog on the computer that confirmed the order. Works with any printer; one click to print."],
                ["off", "Don't print automatically", "Tickets can still be printed from an order with Reprint ticket."],
              ] as const).map(([value, title, help]) => (
                <label
                  key={value}
                  className={`flex gap-3 rounded-xl border px-4 py-3 cursor-pointer ${printer.printer_mode === value ? "border-plum bg-plum/5" : "border-hairline"} ${!canEditPrinter ? "opacity-70 cursor-default" : ""}`}
                >
                  <input
                    type="radio"
                    name="printer_mode"
                    className="mt-1"
                    checked={printer.printer_mode === value}
                    disabled={!canEditPrinter}
                    onChange={() => setPrinter({ ...printer, printer_mode: value })}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="block text-xs text-muted mt-0.5">{help}</span>
                  </span>
                </label>
              ))}
            </div>

            {printer.printer_mode === "network" && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                <label className="block col-span-2">
                  <span className="block text-xs font-medium text-muted mb-1.5">Printer IP address</span>
                  <input
                    className={`${inputClass} w-full`}
                    placeholder="e.g. 192.168.1.50"
                    value={printer.printer_host ?? ""}
                    disabled={!canEditPrinter}
                    onChange={(e) => setPrinter({ ...printer, printer_host: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-muted mb-1.5">Port</span>
                  <input
                    type="number"
                    className={`${inputClass} w-full`}
                    value={printer.printer_port}
                    disabled={!canEditPrinter}
                    onChange={(e) => setPrinter({ ...printer, printer_port: Number(e.target.value) })}
                  />
                </label>
                <p className="col-span-3 text-xs text-muted -mt-2">
                  Most receipt printers print their IP address on a self-test page (hold the feed button while switching on). The port is almost always 9100.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <label className="block">
                <span className="block text-xs font-medium text-muted mb-1.5">Paper width</span>
                <select
                  className={`${inputClass} w-full`}
                  value={printer.printer_width}
                  disabled={!canEditPrinter}
                  onChange={(e) => setPrinter({ ...printer, printer_width: Number(e.target.value) })}
                >
                  <option value={48}>80 mm</option>
                  <option value={42}>76 mm</option>
                  <option value={32}>58 mm</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted mb-1.5">Country code for WhatsApp</span>
                <input
                  className={`${inputClass} w-full`}
                  value={printer.phone_country_code}
                  disabled={!canEditPrinter}
                  onChange={(e) => setPrinter({ ...printer, phone_country_code: e.target.value })}
                />
                <span className="block text-xs text-muted mt-1.5">So 0300 1234567 opens WhatsApp as +{printer.phone_country_code || "92"} 300 1234567.</span>
              </label>
            </div>

            {printerMessage && (
              <p className={`text-sm mt-3 ${printerMessage.ok ? "text-sage" : "text-plum"}`} role="status">{printerMessage.text}</p>
            )}
            <Can permission="system.config.field.printer.edit">
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={savePrinter}
                  disabled={!printerChanged || printerBusy !== null}
                  className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-40"
                >
                  {printerBusy === "save" ? "Saving…" : "Save printing settings"}
                </button>
                {printerSaved?.printer_mode === "network" && (
                  <button
                    onClick={testPrinter}
                    disabled={printerBusy !== null || printerChanged}
                    title={printerChanged ? "Save your changes first" : undefined}
                    className="border border-hairline px-4 py-2 rounded-lg text-sm font-semibold text-ink disabled:opacity-40"
                  >
                    {printerBusy === "test" ? "Sending…" : "Test print"}
                  </button>
                )}
              </div>
            </Can>
          </section>
        )}

        {format && (
          <section>
            <h2 className="text-sm font-medium text-ink mb-1">Employee code format</h2>
            <p className="text-xs text-muted mb-3">
              Controls the auto-generated code assigned to every new staff member.
            </p>

            <Can permission="system.config.field.employee_code_format.edit" fallbackDisabled>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="text-xs text-ink/70">
                  Prefix
                  <input
                    className={`${inputClass} w-full mt-1`}
                    value={format.prefix}
                    onChange={(e) => setFormat({ ...format, prefix: e.target.value })}
                  />
                </label>
                <label className="text-xs text-ink/70">
                  Separator
                  <input
                    className={`${inputClass} w-full mt-1`}
                    value={format.separator}
                    onChange={(e) => setFormat({ ...format, separator: e.target.value })}
                  />
                </label>
                <label className="text-xs text-ink/70">
                  Number padding
                  <input
                    type="number"
                    min={1}
                    max={8}
                    className={`${inputClass} w-full mt-1`}
                    value={format.padding}
                    onChange={(e) => setFormat({ ...format, padding: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs text-ink/70 flex items-center gap-1.5 mt-5">
                  <input
                    type="checkbox"
                    checked={format.include_year}
                    onChange={(e) => setFormat({ ...format, include_year: e.target.checked })}
                  />
                  Include year
                </label>
              </div>
            </Can>

            <p className="text-xs text-muted mb-3">
              Next code: <span className="font-mono text-ink">{format.preview}</span>
            </p>

            <Can permission="system.config.field.employee_code_format.edit">
              <button
                onClick={saveFormat}
                disabled={savingFormat}
                className="bg-plum text-cream px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
              >
                {savingFormat ? t("common.saving") : t("common.save")}
              </button>
            </Can>
          </section>
        )}
      </div>
    </Can>
  );
}
