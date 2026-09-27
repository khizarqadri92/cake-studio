import { useEffect, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChefHat, Bike, ClipboardCheck, Wallet, PackageOpen, CalendarClock } from "lucide-react";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { fmtAmount, fmtQty } from "../../lib/format";
import { TrendChart, MonthColumns, Donut, RankBars } from "../../components/Charts";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", confirmed: "Confirmed", sent_to_baker: "With baker", in_production: "Baking", ready: "Ready",
  rider_assigned: "Rider assigned", out_for_delivery: "Out for delivery", delivered: "Cash pending", completed: "Completed",
};
const WORK_ICON: Record<string, typeof ChefHat> = { baker: ChefHat, rider: Bike, desk: ClipboardCheck, due: CalendarClock };

function Panel({ title, note, children, className = "" }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-hairline rounded-2xl p-5 min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warn" }) {
  return (
    <div className="bg-surface border border-hairline rounded-2xl px-5 py-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`font-display text-[28px] leading-tight font-semibold mt-0.5 ${tone === "warn" ? "text-plum" : "text-ink"}`}>{value}</p>
      {note && <p className="text-xs text-muted mt-0.5">{note}</p>}
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function DashboardPage() {
  const permissions = useAuthStore((st) => st.permissions);
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => api.get("/dashboard").then((r) => setD(r.data)).catch(() => setError("Couldn't load the dashboard."));
    load();
    const t = setInterval(load, 60000); // keep the work cards current
    return () => clearInterval(t);
  }, []);

  if (error) return <div className="p-6"><p className="text-sm text-plum">{error}</p></div>;
  if (!d) return <div className="p-6"><p className="text-sm text-muted">Loading dashboard…</p></div>;

  const first = (d.name as string).split(" ")[0];
  const sales = d.sales, profit = d.profit, inv = d.inventory;
  const openCount = sales ? sales.status_now.reduce((a: number, s: any) => a + s.count, 0) : 0;
  const pretty = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-6 max-w-none space-y-6">
      <div>
        <h1>{greeting()}, {first}</h1>
        <p className="text-[15px] text-muted mt-1.5">Processing date: {pretty(d.processing_date)}</p>
      </div>

      {d.days_behind > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-honey/50 bg-[#FBF3E4] dark:bg-honey/15 px-5 py-4 text-sm text-[#5A3E0E] dark:text-cream" role="alert">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">The processing date is {d.days_behind} day{d.days_behind === 1 ? "" : "s"} behind today ({pretty(d.today)}).</p>
            <p className="mt-0.5">New orders are being dated {pretty(d.processing_date)}, which makes day-by-day reports misleading.
              {permissions.has("system.config.field.processing_date.edit")
                ? <> Advance it in <Link to="/admin/system" className="underline font-semibold">System setup</Link>.</>
                : " Ask an administrator to advance it in System setup."}</p>
          </div>
        </div>
      )}

      {d.work.length > 0 && (
        <div>
          <h2 className="font-display text-xl font-semibold text-ink mb-3">Your work</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {d.work.map((w: any) => {
              const Icon = WORK_ICON[w.key.split("_")[0]] ?? (w.key.includes("cash") ? Wallet : ClipboardCheck);
              const hot = w.tone === "attention" && w.count > 0;
              return (
                <Link key={w.key} to="/admin/orders"
                  className={`block rounded-2xl border px-5 py-4 transition-colors ${hot ? "border-plum/40 bg-plum/5 hover:bg-plum/10" : "border-hairline bg-surface hover:bg-flour"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-muted">{w.label}</p>
                    <Icon size={18} className={hot ? "text-plum" : "text-muted"} />
                  </div>
                  <p className={`font-display text-[32px] leading-tight font-semibold mt-0.5 ${w.count ? "text-ink" : "text-muted"}`}>{w.count}</p>
                  <p className="text-xs text-muted mt-0.5">{w.amount ? `Rs ${fmtAmount(w.amount)} · ` : ""}{w.hint}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {sales && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Today's orders" value={String(sales.kpis.today_orders)} note={`Rs ${fmtAmount(sales.kpis.today_value)}`} />
            <Kpi label="This month" value={`Rs ${fmtAmount(sales.kpis.month_value)}`} note={`${sales.kpis.month_orders} orders`} />
            <Kpi label="Average order" value={`Rs ${fmtAmount(sales.kpis.avg_order_30)}`} note={`Last 30 days, ${sales.kpis.completed_30} completed`} />
            <Kpi label="Still to collect" value={`Rs ${fmtAmount(sales.kpis.balance_due + sales.kpis.cash_with_riders)}`}
              note={`Rs ${fmtAmount(sales.kpis.cash_with_riders)} with riders`} tone={sales.kpis.balance_due + sales.kpis.cash_with_riders > 0 ? "warn" : undefined} />
          </div>

          <div className="grid xl:grid-cols-3 gap-5">
            <Panel title="Sales, last 30 days" note="By order date" className="xl:col-span-2">
              <TrendChart points={sales.trend} valueKey="value" countKey="orders" label="Sales over the last 30 days" />
            </Panel>
            <Panel title="Open orders" note="Right now">
              {openCount ? (
                <Donut centerLabel="open" slices={sales.status_now.map((s: any) => ({ label: STATUS_LABEL[s.status] ?? s.status, value: s.count }))} />
              ) : <p className="text-sm text-muted py-6">No open orders.</p>}
            </Panel>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Panel title="Top flavours" note="Last 30 days">
              <RankBars rows={sales.top_flavours.map((f: any) => ({ ...f, label: f.name }))} value="orders" format={(r) => `${r.orders} · Rs ${fmtAmount(r.revenue)}`} />
            </Panel>
            <Panel title="Busiest days" note="Orders, last 90 days">
              <RankBars rows={sales.weekday.map((w: any) => ({ ...w, label: w.day }))} value="orders" highlightMax />
            </Panel>
            <Panel title="Delivery or pickup" note="Last 30 days">
              <Donut centerLabel="orders" slices={sales.fulfillment.map((f: any) => ({ label: f.name, value: f.orders }))} />
            </Panel>
          </div>
        </>
      )}

      {profit && (
        <div className="grid xl:grid-cols-3 gap-5">
          <Panel title="Sales, cost and profit" note="Last 6 months, ingredient cost only" className="xl:col-span-2">
            <MonthColumns months={profit.months} series={[
              { key: "sales", label: "Sales", className: "bg-plum" },
              { key: "cost", label: "Ingredient cost", className: "bg-honey" },
              { key: "profit", label: "Gross profit", className: "bg-sage" },
            ]} />
          </Panel>
          <div className="grid gap-3 content-start">
            <Kpi label="Gross profit this month" value={`Rs ${fmtAmount(profit.month_profit)}`} note={`Margin ${profit.month_margin.toFixed(1)}%`} />
            {profit.missing_cost > 0 && (
              <p className="rounded-2xl border border-honey/40 bg-[#FBF3E4] dark:bg-honey/15 px-4 py-3 text-sm text-[#5A3E0E] dark:text-cream">
                {profit.missing_cost} order{profit.missing_cost === 1 ? " has" : "s have"} incomplete cost this month, so profit reads a little high. See Reports → Cake cost &amp; profit.
              </p>
            )}
          </div>
        </div>
      )}

      {inv && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="grid gap-3 content-start">
            <Kpi label="Stock value" value={`Rs ${fmtAmount(inv.stock_value)}`} note="At average purchase price" />
            <Kpi label="Ingredients used, 30 days" value={`Rs ${fmtAmount(inv.used_30)}`} note={`Bought: Rs ${fmtAmount(inv.bought_30)}`} />
          </div>
          <Panel title="Top ingredients used" note="By cost, last 30 days">
            <RankBars rows={inv.top_used.map((i: any) => ({ ...i, label: i.name }))} value="cost" format={(r) => `${fmtQty(r.quantity)} ${r.unit} · Rs ${fmtAmount(r.cost)}`} />
          </Panel>
          <Panel title="Low stock" note={`${inv.low_count} to reorder`}>
            {inv.low_stock.length ? (
              <ul className="divide-y divide-hairline">
                {inv.low_stock.map((i: any) => (
                  <li key={i.item} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-2 text-ink"><PackageOpen size={15} className="text-plum" />{i.item}</span>
                    <span className="font-mono text-[13px] text-plum">{fmtQty(i.on_hand)} / {fmtQty(i.reorder_at)} {i.unit}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted py-4">Everything is above its reorder level.</p>}
          </Panel>
        </div>
      )}

      {!sales && !profit && !inv && d.work.length === 0 && (
        <p className="text-sm text-muted">Nothing to show yet. Your administrator can give you access to reports.</p>
      )}
    </div>
  );
}
