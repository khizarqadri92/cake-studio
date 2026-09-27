import { ReactNode } from "react";
import { X, Phone, MapPin, Store, FileText } from "lucide-react";
import type { OrderDetail, OrderStatus } from "../api/orders";
import { fmtAmount } from "../lib/format";

export const STATUS_TONE: Record<OrderStatus, string> = {
  draft: "bg-[#F1ECE6] text-[#5E534D]",
  confirmed: "bg-[#EFE7F6] text-[#5B3A86]",
  sent_to_baker: "bg-[#FBF0DC] text-[#7A4F0F]",
  in_production: "bg-[#FBE7DE] text-[#9A3B16]",
  ready: "bg-[#E4F0E4] text-[#2F6B35]",
  rider_assigned: "bg-[#FBF0DC] text-[#7A4F0F]",
  out_for_delivery: "bg-[#E3ECF7] text-[#2B5A93]",
  delivered: "bg-[#F6E6EA] text-[#7A2438]",
  completed: "bg-[#E4F0E4] text-[#2F6B35]",
  cancelled: "bg-[#EDE9E6] text-[#5E534D]",
};

const money = (n: number) => fmtAmount(n);
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

interface Stage {
  label: string;
  at: string | null;
  detail: string;       // shown once the stage is done
  pending: string;      // shown while this is the next stage
}

/** Stages in order for this kind of order, each tied to the timestamp
 *  the backend records when that step happens. */
function stagesFor(o: OrderDetail): Stage[] {
  const baker = o.baker_name ?? "the baker";
  const rider = o.rider_name ?? "the rider";
  const stages: Stage[] = [
    { label: "Order created", at: o.created_at, detail: "Saved as a draft", pending: "" },
    { label: "Confirmed", at: o.confirmed_at, detail: "Reviewed with the customer", pending: "Review and confirm the order" },
    { label: "Sent to baker", at: o.sent_to_baker_at, detail: `Assigned to ${baker}`, pending: "Choose a baker" },
    { label: "Baker accepted", at: o.baker_accepted_at, detail: `${baker} accepted`, pending: `Waiting for ${baker} to accept` },
    { label: "Baking", at: o.production_started_at, detail: "Ingredients logged, baking started", pending: `${baker} starts baking` },
    { label: "Ready", at: o.ready_at, detail: "Marked ready", pending: `${baker} marks it ready` },
  ];
  if (o.fulfillment_type === "delivery") {
    stages.push(
      { label: "Rider assigned", at: o.assigned_rider_at, detail: `${rider} assigned`, pending: "Choose a rider" },
      { label: "Out for delivery", at: o.delivery_started_at, detail: `${rider} started the trip`, pending: `${rider} starts the trip` },
      {
        label: "Delivered",
        at: o.delivered_at,
        detail: o.rider_amount_collected != null ? `${rider} collected Rs ${money(o.rider_amount_collected)}` : "Handed to the customer",
        pending: `${rider} marks it delivered`,
      },
      {
        label: "Completed",
        at: o.handover_at,
        detail: o.amount_received != null ? `Rs ${money(o.amount_received)} received from ${rider}` : "Cash received",
        pending: "Receive the cash from the rider",
      },
    );
  } else {
    stages.push({
      label: "Picked up & paid",
      at: o.handover_at,
      detail: o.amount_received != null ? `Rs ${money(o.amount_received)} received` : "Collected by the customer",
      pending: "Customer collects and pays",
    });
  }
  return stages;
}

export function OrderJourneyPanel({
  order,
  statusLabel,
  dueLabel,
  actions,
  extras,
  onOpenDetails,
  onClose,
}: {
  order: OrderDetail;
  statusLabel: string;
  dueLabel?: string;   // e.g. "Today", matching the table
  actions?: ReactNode;
  extras?: ReactNode;  // receipt / reprint controls
  onOpenDetails: () => void;
  onClose: () => void;
}) {
  const stages = stagesFor(order);
  const cancelled = order.status === "cancelled";
  // The first stage with no timestamp is where the order is now.
  const nextIdx = cancelled ? -1 : stages.findIndex((s) => !s.at);
  const balance = Math.max(order.total - order.advance_paid, 0);
  const cake = [order.item?.cake_tier_name, order.item?.cake_flavor_name, order.item?.cake_size_name].filter(Boolean).join(", ");
  const due = new Date(`${order.delivery_date}T00:00:00`);
  const dueText = `${dueLabel ?? (isNaN(due.getTime()) ? order.delivery_date : due.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }))}${
    order.delivery_time ? `, ${order.delivery_time.slice(0, 5)}` : ""
  }`;

  return (
    <aside
      aria-label={`Order ${order.order_number}`}
      className="w-full xl:w-[400px] shrink-0 bg-surface border-l border-hairline flex flex-col xl:h-[calc(100vh-76px)] xl:sticky xl:top-0"
    >
      <div className="px-6 pt-6 pb-5 border-b border-hairline">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[13px] text-plum">{order.order_number}</p>
            <h2 className="font-display text-[26px] leading-tight font-semibold tracking-tight text-ink truncate">{order.customer_name}</h2>
            {cake && <p className="text-[13px] text-muted mt-0.5 truncate">{cake}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_TONE[order.status]}`}>{statusLabel}</span>
            <button onClick={onClose} aria-label="Close order panel" className="p-2 -mr-2 rounded-lg text-muted hover:text-ink hover:bg-flour">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <div className="rounded-xl bg-[#FBF3E4] dark:bg-honey/15 px-3.5 py-3">
            <p className="text-xs text-[#6B4E1C] dark:text-honey">Balance to collect</p>
            <p className="font-mono text-lg text-[#5A3E0E] dark:text-cream mt-0.5">Rs {money(balance)}</p>
            <p className="text-[11px] text-[#6B4E1C] dark:text-cream/70">of Rs {money(order.total)}, advance Rs {money(order.advance_paid)}</p>
          </div>
          <div className="rounded-xl bg-flour px-3.5 py-3">
            <p className="text-xs text-muted">Due</p>
            <p className="text-[15px] font-semibold text-ink mt-0.5">{dueText}</p>
            <p className="text-[11px] text-muted">{order.fulfillment_type === "pickup" ? "Self pickup" : "Home delivery"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <h3 className="text-xs font-semibold text-muted mb-4">Journey</h3>

        {cancelled && (
          <p className="text-sm rounded-xl bg-flour px-3.5 py-3 mb-4 text-ink">This order was cancelled.</p>
        )}
        {order.status === "confirmed" && order.decline_reason && (
          <div className="rounded-xl border border-plum/25 bg-plum/5 px-3.5 py-3 mb-4">
            <p className="text-xs font-semibold text-plum">Declined by {order.declined_by_name ?? "the baker"}</p>
            <p className="text-sm text-ink mt-0.5">{order.decline_reason}</p>
          </div>
        )}

        <ol className="relative">
          {stages.map((s, i) => {
            const done = !!s.at;
            const isNext = i === nextIdx;
            const last = i === stages.length - 1;
            return (
              <li key={s.label} className="flex gap-3.5">
                <div className="flex flex-col items-center w-3.5">
                  <span
                    className={`w-3.5 h-3.5 rounded-full shrink-0 box-border ${
                      done ? "bg-plum" : isNext ? "bg-surface border-[3px] border-honey" : "bg-surface border-2 border-hairline"
                    }`}
                    aria-hidden="true"
                  />
                  {!last && <span className={`w-0.5 flex-1 min-h-[18px] ${done && stages[i + 1]?.at ? "bg-plum" : "bg-hairline"}`} />}
                </div>
                <div className="pb-4 -mt-0.5 min-w-0">
                  <p className={`text-sm ${done ? "font-semibold text-ink" : isNext ? "font-bold text-[#7A4F0F] dark:text-honey" : "text-muted"}`}>
                    {s.label}
                    <span className="sr-only">{done ? " (done)" : isNext ? " (next)" : " (upcoming)"}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {done ? `${s.detail} · ${when(s.at)}` : isNext ? s.pending : "Upcoming"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-6 pt-4 pb-6 border-t border-hairline space-y-3">
        <div className="space-y-1.5 text-[13px] text-ink/80">
          <p className="flex items-center gap-2"><Phone size={15} className="text-muted shrink-0" />{order.customer_phone}</p>
          <p className="flex items-start gap-2">
            {order.fulfillment_type === "pickup" ? <Store size={15} className="text-muted shrink-0 mt-0.5" /> : <MapPin size={15} className="text-muted shrink-0 mt-0.5" />}
            <span>{order.fulfillment_type === "pickup" ? "Self pickup" : order.delivery_address || "No address entered"}</span>
          </p>
        </div>
        {actions && <div className="[&_.cs-actions]:justify-start">{actions}</div>}
        {extras}
        <button
          onClick={onOpenDetails}
          className="w-full h-11 rounded-xl border border-hairline text-sm font-semibold text-ink hover:bg-flour flex items-center justify-center gap-2"
        >
          <FileText size={16} /> Full order details
        </button>
      </div>
    </aside>
  );
}
