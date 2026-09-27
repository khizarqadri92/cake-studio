import { useEffect, useMemo, useState, ReactNode } from "react";
import { ClipboardList, Wheat, ShoppingBasket, TrendingUp, Award, Wallet, Boxes, Users, UserRound, Download, Printer } from "lucide-react";
import { api } from "../../api/client";
import { fetchReport, ReportKey } from "../../api/reports";
import { Can } from "../../components/Can";
import { useAuthStore } from "../../store/authStore";
import { fmtAmount, fmtQty } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";

// ------------------------------------------------------------------ setup

const REPORTS: { key: ReportKey; label: string; hint: string; icon: typeof ClipboardList; permission: string; snapshot?: boolean }[] = [
  { key: "orders", label: "Orders", hint: "How many, how much, and their status", icon: ClipboardList, permission: "reports.orders.view" },
  { key: "profit", label: "Cake cost & profit", hint: "Sales minus ingredient cost", icon: TrendingUp, permission: "reports.profit.view" },
  { key: "ingredients-used", label: "Ingredients used", hint: "What bakers used, and what it cost", icon: Wheat, permission: "reports.inventory.view" },
  { key: "purchases", label: "Purchases", hint: "Bought from suppliers", icon: ShoppingBasket, permission: "reports.inventory.view" },
  { key: "best-sellers", label: "Best sellers", hint: "Flavours, sizes, themes and add-ons", icon: Award, permission: "reports.orders.view" },
  { key: "outstanding", label: "Money outstanding", hint: "Balances due and cash with riders", icon: Wallet, permission: "reports.orders.view", snapshot: true },
  { key: "stock", label: "Stock value & wastage", hint: "What's on the shelf, what was thrown away", icon: Boxes, permission: "reports.inventory.view" },
  { key: "staff", label: "Staff performance", hint: "Bakers and riders", icon: UserRound, permission: "reports.staff.view" },
  { key: "customers", label: "Customers", hint: "Top and new customers", icon: Users, permission: "reports.customers.view" },
];

type Preset = "today" | "week" | "month" | "year" | "all" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" }, { key: "week", label: "This week" }, { key: "month", label: "This month" },
  { key: "year", label: "This year" }, { key: "all", label: "All time" }, { key: "custom", label: "Custom dates" },
];
interface ReportContext { processing_date: string; today: string | null; days_behind: number; first_date: string; last_date: string }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

/** Whole periods (Monday-Sunday week, full month, full year) around the
 *  anchor day, so nothing dated later in the period is ever cut off. */
function presetRange(preset: Preset, anchor: string, ctx?: ReportContext | null): [string, string] {
  const d = parse(anchor);
  if (preset === "week") {
    const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // weeks start Monday
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return [iso(s), iso(e)];
  }
  if (preset === "month") return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (preset === "year") return [iso(new Date(d.getFullYear(), 0, 1)), iso(new Date(d.getFullYear(), 11, 31))];
  if (preset === "all" && ctx) return [ctx.first_date < anchor ? ctx.first_date : anchor, ctx.last_date > anchor ? ctx.last_date : anchor];
  return [anchor, anchor];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", confirmed: "Confirmed", sent_to_baker: "With baker", in_production: "Baking", ready: "Ready",
  rider_assigned: "Rider assigned", out_for_delivery: "Out for delivery", delivered: "Delivered, cash pending",
  completed: "Completed", cancelled: "Cancelled",
};

const showDate = (s: string) => (s ? parse(s.slice(0, 10)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
const pct = (n: number) => `${(n ?? 0).toFixed(1)}%`;
const mins = (n: number | null) => (n == null ? "—" : n >= 90 ? `${(n / 60).toFixed(1)} h` : `${Math.round(n)} min`);

// ------------------------------------------------------------------ building blocks

function Tiles({ items }: { items: { label: string; value: string; note?: string; tone?: "warn" }[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((t) => (
        <div key={t.label} className="bg-surface border border-hairline rounded-2xl px-5 py-4">
          <p className="text-[13px] text-muted">{t.label}</p>
          <p className={`font-display text-[28px] leading-tight font-semibold mt-0.5 ${t.tone === "warn" ? "text-plum" : "text-ink"}`}>{t.value}</p>
          {t.note && <p className="text-xs text-muted mt-0.5">{t.note}</p>}
        </div>
      ))}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-honey/40 bg-[#FBF3E4] dark:bg-honey/15 px-4 py-3 text-sm text-[#5A3E0E] dark:text-cream">{children}</p>;
}

/** Simple bar chart: one or two measures per period. */
function Bars({ series, bucket, measures }: {
  series: Record<string, any>[]; bucket: "day" | "month";
  measures: { key: string; label: string; className: string }[];
}) {
  const max = Math.max(1, ...series.flatMap((p) => measures.map((m) => Math.abs(p[m.key] ?? 0))));
  const every = Math.ceil(series.length / 12);
  const label = (k: string) => bucket === "month"
    ? parse(`${k}-01`).toLocaleDateString(undefined, { month: "short" })
    : parse(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const axisLabel = (k: string, i: number) => {
    if (bucket === "month") return label(k);
    const d = parse(k);
    return i === 0 || d.getDate() === 1 ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : String(d.getDate());
  };
  if (series.length <= 1) return null;
  return (
    <div className="bg-surface border border-hairline rounded-2xl p-5">
      <div className="flex flex-wrap gap-4 text-xs text-muted mb-3">
        {measures.map((m) => <span key={m.key} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-sm ${m.className}`} />{m.label}</span>)}
        <span className="ml-auto">{bucket === "day" ? "By day" : "By month"}</span>
      </div>
      <div className="flex items-end gap-[3px] h-44" role="img" aria-label={`${measures.map((m) => m.label).join(" and ")} ${bucket === "day" ? "by day" : "by month"}`}>
        {series.map((p) => (
          <div key={p.key} className="flex-1 h-full flex items-end gap-[1px] group relative">
            {measures.map((m) => (
              <div key={m.key} className={`flex-1 rounded-t-sm ${m.className}`} style={{ height: `${(Math.max(p[m.key] ?? 0, 0) / max) * 100}%`, minHeight: p[m.key] ? 2 : 0 }} />
            ))}
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded-lg bg-ink text-cream text-xs px-2 py-1 z-10">
              {label(p.key)}: {measures.map((m) => `${m.label} ${m.key === "orders" ? p[m.key] : fmtAmount(p[m.key])}`).join(", ")}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {series.map((p, i) => <div key={p.key} className="flex-1 text-[10px] text-muted text-center whitespace-nowrap overflow-visible">{i % every === 0 ? axisLabel(p.key, i) : ""}</div>)}
      </div>
    </div>
  );
}

type Col = { key: string; label: string; align?: "right"; render?: (row: any) => ReactNode; csv?: (row: any) => unknown };

function Table({ title, columns, rows, fileName, empty = "Nothing in this period." }: {
  title: string; columns: Col[]; rows: any[]; fileName: string; empty?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  rows = rows ?? [];
  const shown = showAll ? rows : rows.slice(0, 50);
  return (
    <div className="bg-surface border border-hairline rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-hairline">
        <h3 className="font-semibold text-ink">{title} <span className="text-muted font-normal">({rows.length})</span></h3>
        {rows.length > 0 && (
          <button
            onClick={() => downloadCsv(fileName, columns.map((c) => ({ key: c.key, label: c.label })),
              rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, c.csv ? c.csv(r) : r[c.key]]))))}
            className="no-print h-9 px-3 rounded-xl border border-hairline text-sm font-semibold text-ink hover:bg-flour flex items-center gap-1.5"
          >
            <Download size={15} /> CSV
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted text-center">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="cs-plain w-full text-sm">
            <thead><tr>{columns.map((c) => <th key={c.key} className={`px-4 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>)}</tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className="border-t border-hairline/70">
                  {columns.map((c) => <td key={c.key} className={`px-4 whitespace-nowrap ${c.align === "right" ? "text-right font-mono text-[13px]" : ""}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 50 && (
        <button onClick={() => setShowAll((v) => !v)} className="no-print w-full py-3 text-sm font-semibold text-plum border-t border-hairline hover:bg-flour">
          {showAll ? "Show first 50" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

const money = (key: string, label: string): Col => ({ key, label, align: "right", render: (r) => (r[key] == null ? "—" : fmtAmount(r[key])), csv: (r) => r[key] });
const qty = (key: string, label: string): Col => ({ key, label, align: "right", render: (r) => `${fmtQty(r[key])} ${r.unit ?? ""}`, csv: (r) => r[key] });
const dateCol = (key: string, label: string): Col => ({ key, label, render: (r) => showDate(r[key]), csv: (r) => r[key] });
const statusCol: Col = { key: "status", label: "Status", render: (r) => STATUS_LABEL[r.status] ?? r.status, csv: (r) => STATUS_LABEL[r.status] ?? r.status };

// ------------------------------------------------------------------ the reports

function OrdersReport({ d, tag }: { d: any; tag: string }) {
  const s = d.summary;
  return (
    <>
      <Tiles items={[
        { label: "Orders", value: String(s.orders), note: `${s.delivery} delivery, ${s.pickup} pickup` },
        { label: "Order value", value: fmtAmount(s.value), note: `Average ${fmtAmount(s.average)}` },
        { label: "Collected", value: fmtAmount(s.collected), note: "Advances and payments received" },
        { label: "Still to collect", value: fmtAmount(s.outstanding), tone: s.outstanding > 0 ? "warn" : undefined, note: `${s.drafts} ${s.drafts === 1 ? "draft" : "drafts"} and ${s.cancelled} cancelled not counted` },
      ]} />
      <Bars series={d.series} bucket={d.bucket} measures={[{ key: "value", label: "Order value", className: "bg-plum" }]} />
      <Table title="By status" fileName={`orders-by-status-${tag}.csv`} rows={d.by_status}
        columns={[{ ...statusCol }, { key: "count", label: "Orders", align: "right" }]} />
      <Table title="Orders" fileName={`orders-${tag}.csv`} rows={d.rows} columns={[
        { key: "order_number", label: "Order" }, dateCol("date", "Taken"), dateCol("due", "Due"), dateCol("completed", "Completed"), { key: "customer", label: "Customer" },
        statusCol, { key: "fulfillment", label: "Fulfilment", render: (r) => (r.fulfillment === "pickup" ? "Pickup" : "Delivery"), csv: (r) => (r.fulfillment === "pickup" ? "Pickup" : "Delivery") },
        money("total", "Total"), money("paid", "Paid"), money("balance", "Balance"),
      ]} />
    </>
  );
}

function ProfitReport({ d, tag }: { d: any; tag: string }) {
  const s = d.summary;
  return (
    <>
      <Tiles items={[
        { label: "Sales", value: fmtAmount(s.sales), note: `${s.orders} orders` },
        { label: "Ingredient cost", value: fmtAmount(s.ingredient_cost), note: "Logged by bakers, at average purchase price" },
        { label: "Gross profit", value: fmtAmount(s.gross_profit), note: `Margin ${pct(s.margin)}` },
        { label: "Margin on fully costed orders", value: pct(s.margin_full_cost_orders), note: `${s.orders_with_full_cost} of ${s.orders} orders` },
      ]} />
      {s.orders_missing_cost > 0 && (
        <Notice>
          {s.orders_missing_cost} {s.orders_missing_cost === 1 ? "order has" : "orders have"} incomplete cost: either the baker hasn't logged ingredients yet,
          or an ingredient has never been bought through Purchases so its price is unknown. Their profit is shown too high until that's fixed.
        </Notice>
      )}
      <Bars series={d.series} bucket={d.bucket} measures={[
        { key: "sales", label: "Sales", className: "bg-plum" }, { key: "cost", label: "Ingredient cost", className: "bg-honey" },
      ]} />
      <Table title="Profit per order" fileName={`profit-${tag}.csv`} rows={d.rows} columns={[
        { key: "order_number", label: "Order" }, dateCol("date", "Date"), { key: "customer", label: "Customer" },
        money("sales", "Sales"), money("cost", "Ingredient cost"), money("profit", "Profit"),
        { key: "margin", label: "Margin", align: "right", render: (r) => pct(r.margin), csv: (r) => r.margin.toFixed(1) },
        { key: "note", label: "Cost note", render: (r) => (r.note ? <span className="text-plum">{r.note}</span> : <span className="text-muted">Complete</span>) },
      ]} />
    </>
  );
}

function IngredientsReport({ d, tag }: { d: any; tag: string }) {
  const s = d.summary;
  return (
    <>
      <Tiles items={[
        { label: "Ingredient cost", value: fmtAmount(s.cost), note: "At average purchase price" },
        { label: "Cakes", value: String(s.orders), note: "Orders with ingredients logged" },
        { label: "Ingredients", value: String(s.ingredients), note: `${s.entries} entries` },
        { label: "Without a price", value: String(s.items_without_cost), tone: s.items_without_cost ? "warn" : undefined, note: "Never bought through Purchases" },
      ]} />
      <Table title="By ingredient" fileName={`ingredients-used-summary-${tag}.csv`} rows={d.items} columns={[
        { key: "item", label: "Ingredient" }, qty("quantity", "Used"), { key: "orders", label: "Cakes", align: "right" },
        { key: "cost", label: "Cost", align: "right", render: (r) => (r.cost_known ? fmtAmount(r.cost) : <span className="text-plum font-sans">No price</span>), csv: (r) => (r.cost_known ? r.cost : "") },
      ]} />
      <Table title="Every entry" fileName={`ingredients-used-${tag}.csv`} rows={d.rows} columns={[
        dateCol("date", "Date"), { key: "order_number", label: "Order" }, { key: "item", label: "Ingredient" },
        qty("quantity", "Quantity"), { key: "entered", label: "Entered as" }, money("cost", "Cost"), { key: "baker", label: "Baker" },
      ]} />
    </>
  );
}

function PurchasesReport({ d, tag }: { d: any; tag: string }) {
  const s = d.summary;
  return (
    <>
      <Tiles items={[
        { label: "Spent", value: fmtAmount(s.amount), note: `${s.purchases} purchases` },
        { label: "Average purchase", value: fmtAmount(s.average) },
        { label: "Suppliers", value: String(s.suppliers) },
        { label: "Ingredients bought", value: String(s.ingredients) },
      ]} />
      <Table title="By ingredient" fileName={`purchases-by-ingredient-${tag}.csv`} rows={d.items} columns={[
        { key: "item", label: "Ingredient" }, qty("quantity", "Bought"), money("average_price", "Average price"), money("amount", "Spent"),
        { key: "purchases", label: "Purchases", align: "right" },
      ]} />
      <Table title="By supplier" fileName={`purchases-by-supplier-${tag}.csv`} rows={d.suppliers} columns={[
        { key: "supplier", label: "Supplier" }, { key: "purchases", label: "Purchases", align: "right" }, money("amount", "Spent"),
      ]} />
      <Table title="Every purchase" fileName={`purchases-${tag}.csv`} rows={d.rows} columns={[
        dateCol("date", "Date"), { key: "supplier", label: "Supplier" }, { key: "invoice", label: "Invoice" },
        { key: "lines", label: "Items", align: "right" }, money("amount", "Amount"),
      ]} />
    </>
  );
}

function BestSellersReport({ d, tag }: { d: any; tag: string }) {
  const block = (title: string, key: string, rows: any[]) => (
    <Table key={key} title={title} fileName={`best-sellers-${key}-${tag}.csv`} rows={rows} empty="None chosen in this period." columns={[
      { key: "name", label: "Name" }, { key: "orders", label: "Orders", align: "right" },
      ...(key === "addons" ? [{ key: "quantity", label: "Quantity", align: "right" as const }] : []),
      money("revenue", key === "addons" ? "Add-on revenue" : "Order value"),
    ]} />
  );
  return (
    <>
      <Tiles items={[{ label: "Orders", value: String(d.orders) }, ...d.fulfillment.map((f: any) => ({ label: f.name, value: String(f.orders) }))]} />
      <div className="grid xl:grid-cols-2 gap-4">
        {block("Flavours", "flavours", d.flavours)}{block("Sizes", "sizes", d.sizes)}
        {block("Themes / occasions", "themes", d.themes)}{block("Tiers", "tiers", d.tiers)}
      </div>
      {block("Add-ons", "addons", d.addons)}
    </>
  );
}

function OutstandingReport({ d }: { d: any }) {
  const s = d.summary;
  return (
    <>
      <Tiles items={[
        { label: "Balance still due", value: fmtAmount(s.balance_due), note: `${s.orders_with_balance} orders`, tone: s.balance_due ? "warn" : undefined },
        { label: "Cash with riders", value: fmtAmount(s.cash_with_riders), note: `${s.orders_with_riders} orders to close`, tone: s.cash_with_riders ? "warn" : undefined },
      ]} />
      <Table title="Cash each rider is holding" fileName="cash-with-riders.csv" rows={d.by_rider} empty="No rider is holding cash."
        columns={[{ key: "rider", label: "Rider" }, money("amount", "Amount")]} />
      <Table title="Delivered, cash not yet handed in" fileName="delivered-cash-pending.csv" rows={d.with_riders} empty="Nothing waiting."
        columns={[{ key: "order_number", label: "Order" }, { key: "customer", label: "Customer" }, { key: "rider", label: "Rider" }, money("collected", "Collected"), dateCol("delivered", "Delivered")]} />
      <Table title="Orders with a balance due" fileName="balances-due.csv" rows={d.due} empty="No balances due."
        columns={[{ key: "order_number", label: "Order" }, { key: "customer", label: "Customer" }, { key: "phone", label: "Phone" }, dateCol("due", "Due"), statusCol,
          money("total", "Total"), money("advance", "Advance"), money("balance", "Balance")]} />
    </>
  );
}

function StockReport({ d, tag }: { d: any; tag: string }) {
  const s = d.summary;
  return (
    <>
      <Tiles items={[
        { label: "Stock value", value: fmtAmount(s.stock_value), note: `${s.items} ingredients at average cost` },
        { label: "Low stock", value: String(s.low_stock), tone: s.low_stock ? "warn" : undefined, note: "At or below reorder level" },
        { label: "Wastage cost", value: fmtAmount(s.wastage_cost), note: "In this period" },
        { label: "Without a price", value: String(s.items_without_cost), note: "Not valued - never purchased" },
      ]} />
      <Table title="Stock on hand (now)" fileName={`stock-${tag}.csv`} rows={d.items} columns={[
        { key: "item", label: "Ingredient" },
        qty("on_hand", "On hand"), qty("reorder_at", "Reorder at"),
        { key: "low", label: "Stock level", render: (r) => (r.low ? <span className="text-xs font-semibold text-plum">Low - reorder</span> : <span className="text-xs text-muted">OK</span>), csv: (r) => (r.low ? "Low" : "OK") },
        money("average_cost", "Average cost"), money("value", "Value"),
      ]} />
      <Table title="Wastage and adjustments" fileName={`wastage-${tag}.csv`} rows={d.wastage} empty="No wastage or adjustments recorded in this period." columns={[
        dateCol("date", "Date"), { key: "item", label: "Ingredient" }, qty("quantity", "Change"),
        { key: "reason", label: "Reason", render: (r) => (r.reason === "wastage" ? "Wastage" : "Adjustment"), csv: (r) => (r.reason === "wastage" ? "Wastage" : "Adjustment") }, money("cost", "Cost"),
      ]} />
    </>
  );
}

function StaffReport({ d, tag }: { d: any; tag: string }) {
  return (
    <>
      <Table title="Bakers" fileName={`bakers-${tag}.csv`} rows={d.bakers} empty="No cakes finished in this period." columns={[
        { key: "name", label: "Baker" }, { key: "cakes", label: "Cakes made ready", align: "right" },
        { key: "avg_bake_minutes", label: "Average baking time", align: "right", render: (r) => mins(r.avg_bake_minutes), csv: (r) => r.avg_bake_minutes?.toFixed(0) ?? "" },
        { key: "declined", label: "Requests declined", align: "right" },
      ]} />
      <Table title="Riders" fileName={`riders-${tag}.csv`} rows={d.riders} empty="No deliveries in this period." columns={[
        { key: "name", label: "Rider" }, { key: "deliveries", label: "Deliveries", align: "right" }, money("collected", "Cash collected"),
        { key: "avg_trip_minutes", label: "Average trip", align: "right", render: (r) => mins(r.avg_trip_minutes), csv: (r) => r.avg_trip_minutes?.toFixed(0) ?? "" },
      ]} />
    </>
  );
}

function CustomersReport({ d, tag }: { d: any; tag: string }) {
  const s = d.summary;
  return (
    <>
      <Tiles items={[
        { label: "Customers who ordered", value: String(s.customers) },
        { label: "New customers", value: String(s.new_customers), note: "First order in this period" },
        { label: "Returning", value: String(s.returning_customers) },
        { label: "Average spend", value: fmtAmount(s.average_spend) },
      ]} />
      <Table title="Customers by spend" fileName={`customers-${tag}.csv`} rows={d.rows} columns={[
        { key: "customer", label: "Customer", render: (r) => <>{r.customer}{r.new && <span className="ml-2 text-xs font-semibold text-sage">New</span>}</>, csv: (r) => r.customer },
        { key: "phone", label: "Phone" }, { key: "orders", label: "Orders", align: "right" }, money("spent", "Spent"), dateCol("last_order", "Last order"),
      ]} />
    </>
  );
}

// ------------------------------------------------------------------ page

export function ReportsPage() {
  const permissions = useAuthStore((st) => st.permissions);
  const available = REPORTS.filter((r) => permissions.has(r.permission));
  const [report, setReport] = useState<ReportKey | null>(available[0]?.key ?? null);
  const [business, setBusiness] = useState<string | null>(null); // anchor day for the presets
  const [ctx, setCtx] = useState<ReportContext | null>(null);
  const [basis, setBasis] = useState<"taken" | "completed">("taken");
  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState<[string, string] | null>(null);
  // Each result remembers which report and period it's for, so a report is
  // never drawn with another report's data while the new one loads.
  const [result, setResult] = useState<{ key: string; data: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ReportContext>("/reports/context").then((r) => {
      // Anchor on whichever is later - the processing date or today's date - so a
      // processing date that hasn't been advanced can't hide recent orders.
      const anchor = r.data.today && r.data.today > r.data.processing_date ? r.data.today : r.data.processing_date;
      setCtx(r.data);
      setBusiness(anchor);
      setRange(presetRange("today", anchor, r.data));
    }).catch(() => api.get("/system/processing-date").then((r) => {
      setBusiness(r.data.processing_date);
      setRange(presetRange("today", r.data.processing_date));
    }));
  }, []);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom" && business) setRange(presetRange(p, business, ctx));
  };

  const current = REPORTS.find((r) => r.key === report);
  useEffect(() => {
    if (!report || !range) return;
    if (range[0] > range[1]) { setError("The start date must be on or before the end date."); setResult(null); return; }
    let live = true;
    const key = `${report}|${range[0]}|${range[1]}|${basis}`;
    setLoading(true);
    setError(null);
    fetchReport(report, range[0], range[1], basis)
      .then((d) => live && setResult({ key, data: d }))
      .catch((err) => live && setError(err?.response?.data?.detail ?? "Couldn't load this report."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [report, range, basis]);

  const tag = range ? (range[0] === range[1] ? range[0] : `${range[0]}_to_${range[1]}`) : "";
  const periodText = useMemo(() => {
    if (!range) return "";
    return range[0] === range[1] ? showDate(range[0]) : `${showDate(range[0])} – ${showDate(range[1])}`;
  }, [range]);

  const resultReport = result?.key.split("|")[0];
  const data = result && resultReport === report ? result.data : null;
  const body = (() => {
    if (!data || !report) return null;
    switch (report) {
      case "orders": return <OrdersReport d={data} tag={tag} />;
      case "profit": return <ProfitReport d={data} tag={tag} />;
      case "ingredients-used": return <IngredientsReport d={data} tag={tag} />;
      case "purchases": return <PurchasesReport d={data} tag={tag} />;
      case "best-sellers": return <BestSellersReport d={data} tag={tag} />;
      case "outstanding": return <OutstandingReport d={data} />;
      case "stock": return <StockReport d={data} tag={tag} />;
      case "staff": return <StaffReport d={data} tag={tag} />;
      case "customers": return <CustomersReport d={data} tag={tag} />;
    }
  })();

  return (
    <Can permission="reports.page.view">
      <div className="p-6 max-w-none">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1>Reports</h1>
            <p className="text-[15px] text-muted mt-1.5">Counted by business date, so they match your processing days.</p>
          </div>
          {data && (
            <button onClick={() => window.print()} className="no-print h-11 px-4 rounded-xl border border-hairline bg-surface text-sm font-semibold text-ink hover:bg-flour flex items-center gap-2">
              <Printer size={16} /> Print
            </button>
          )}
        </div>

        {available.length === 0 ? (
          <p className="text-sm text-muted">You don't have access to any reports. Ask an administrator to grant report permissions.</p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <nav aria-label="Reports" className="no-print w-full lg:w-64 shrink-0 bg-surface border border-hairline rounded-2xl p-2">
              {available.map((r) => {
                const Icon = r.icon;
                const on = r.key === report;
                return (
                  <button
                    key={r.key}
                    onClick={() => setReport(r.key)}
                    aria-current={on ? "page" : undefined}
                    className={`w-full text-left rtl:text-right flex gap-3 px-3 py-2.5 rounded-xl ${on ? "bg-plum/10" : "hover:bg-flour"}`}
                  >
                    <Icon size={18} className={`shrink-0 mt-0.5 ${on ? "text-plum" : "text-muted"}`} />
                    <span>
                      <span className={`block text-sm ${on ? "font-bold text-ink" : "font-semibold text-ink/85"}`}>{r.label}</span>
                      <span className="block text-xs text-muted">{r.hint}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 min-w-0 space-y-4 w-full">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-semibold text-ink">
                  {current?.label}
                  <span className="block text-sm font-sans font-normal text-muted mt-0.5">{current?.snapshot ? "As of now" : periodText}</span>
                </h2>
                {!current?.snapshot && (
                  <div className="no-print flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Period">
                      {PRESETS.map((p) => (
                        <button
                          key={p.key}
                          role="radio"
                          aria-checked={preset === p.key}
                          onClick={() => choosePreset(p.key)}
                          className={`h-9 px-3.5 rounded-full text-[13px] border ${preset === p.key ? "bg-plum border-plum text-cream font-semibold" : "bg-surface border-hairline text-ink/80 hover:bg-flour"}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    {preset === "custom" && range && (
                      <div className="flex items-center gap-2">
                        <input type="date" aria-label="From" value={range[0]}
                          onChange={(e) => e.target.value && setRange([e.target.value, range[1]])}
                          className="h-9 border border-hairline rounded-xl px-2 text-sm bg-surface" />
                        <span className="text-muted text-sm">to</span>
                        <input type="date" aria-label="To" value={range[1]}
                          onChange={(e) => e.target.value && setRange([range[0], e.target.value])}
                          className="h-9 border border-hairline rounded-xl px-2 text-sm bg-surface" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {ctx && ctx.days_behind > 0 && (
                <Notice>
                  The processing date ({showDate(ctx.processing_date)}) is {ctx.days_behind} day{ctx.days_behind === 1 ? "" : "s"} behind today.
                  New orders are dated {showDate(ctx.processing_date)}, so day-by-day figures can look wrong until it's advanced in System setup.
                  Periods here include today, and <b>All time</b> shows everything.
                </Notice>
              )}
              {(report === "orders" || report === "profit") && (
                <div className="no-print flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">Count orders by</span>
                  {([["taken", "the day they were taken"], ["completed", "the day they were completed"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setBasis(k)} aria-pressed={basis === k}
                      className={`h-8 px-3 rounded-full border text-[13px] ${basis === k ? "bg-ink border-ink text-cream font-semibold" : "bg-surface border-hairline text-ink/80 hover:bg-flour"}`}>
                      {l}
                    </button>
                  ))}
                  {basis === "completed" && <span className="text-xs text-muted">Only completed orders, by when they were handed over and paid.</span>}
                </div>
              )}
              {error && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-xl px-4 py-3">{error}</p>}
              {loading && !data && <p className="text-sm text-muted py-10 text-center">Loading report…</p>}
              <div className={loading ? "opacity-60 transition-opacity" : ""}>
                <div className="space-y-4">{body}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Can>
  );
}
