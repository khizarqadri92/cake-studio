import { useState } from "react";
import { fmtAmount } from "../lib/format";

const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const dayLabel = (k: string) => parse(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const monthLabel = (k: string) => parse(`${k}-01`).toLocaleDateString(undefined, { month: "short" });

/** Area + line for a daily trend, with a hover readout. */
export function TrendChart({ points, valueKey, countKey, label }: {
  points: { key: string; [k: string]: any }[]; valueKey: string; countKey?: string; label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 200, P = { l: 8, r: 8, t: 12, b: 24 };
  const max = Math.max(1, ...points.map((p) => p[valueKey] ?? 0));
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(points.length - 1, 1);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[valueKey] ?? 0).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
  const h = hover !== null ? points[hover] : null;
  const total = points.reduce((a, p) => a + (p[valueKey] ?? 0), 0);
  return (
    <figure className="m-0">
      <div className="h-6 text-sm text-ink" aria-live="polite">
        {h ? (
          <><b>{dayLabel(h.key)}</b>: Rs {fmtAmount(h[valueKey])}{countKey ? `, ${h[countKey]} order${h[countKey] === 1 ? "" : "s"}` : ""}</>
        ) : <span className="text-muted">Hover the chart for a day's figures</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${label}: total Rs ${fmtAmount(total)} over ${points.length} days`}
        onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P.l} x2={W - P.r} y1={P.t + f * (H - P.t - P.b)} y2={P.t + f * (H - P.t - P.b)} className="stroke-hairline" strokeDasharray="3 4" />)}
        <path d={area} className="fill-plum/10" />
        <path d={line} className="stroke-plum" fill="none" strokeWidth={2.2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.key}>
            <rect x={x(i) - (W / points.length) / 2} y={0} width={W / points.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
            {hover === i && <><line x1={x(i)} x2={x(i)} y1={P.t} y2={H - P.b} className="stroke-muted" strokeDasharray="2 3" /><circle cx={x(i)} cy={y(p[valueKey] ?? 0)} r={4.5} className="fill-plum stroke-surface" strokeWidth={2} /></>}
          </g>
        ))}
        {points.map((p, i) => (i % Math.ceil(points.length / 7) === 0 || i === points.length - 1) && (
          <text key={p.key} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-muted" fontSize={11}>{dayLabel(p.key)}</text>
        ))}
      </svg>
    </figure>
  );
}

/** Grouped columns per month, e.g. sales / cost / profit. */
export function MonthColumns({ months, series }: {
  months: { key: string; [k: string]: any }[]; series: { key: string; label: string; className: string }[];
}) {
  const max = Math.max(1, ...months.flatMap((m) => series.map((s) => Math.max(m[s.key] ?? 0, 0))));
  return (
    <figure className="m-0">
      <div className="flex flex-wrap gap-4 text-xs text-muted mb-3">
        {series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-sm ${s.className}`} />{s.label}</span>)}
      </div>
      <div className="flex items-end gap-3 h-48" role="img" aria-label={months.map((m) => `${monthLabel(m.key)}: ${series.map((s) => `${s.label} Rs ${fmtAmount(m[s.key])}`).join(", ")}`).join("; ")}>
        {months.map((m) => (
          <div key={m.key} className="flex-1 h-full flex flex-col">
            <div className="flex-1 flex items-end justify-center gap-1">
              {series.map((s) => (
                <div key={s.key} title={`${monthLabel(m.key)} ${s.label}: Rs ${fmtAmount(m[s.key])}`}
                  className={`w-full max-w-[18px] rounded-t ${s.className}`} style={{ height: `${(Math.max(m[s.key] ?? 0, 0) / max) * 100}%`, minHeight: m[s.key] ? 2 : 0 }} />
              ))}
            </div>
            <div className="text-[11px] text-muted text-center mt-1.5">{monthLabel(m.key)}</div>
          </div>
        ))}
      </div>
    </figure>
  );
}

const DONUT_COLORS = ["#6E2437", "#B8862B", "#2B5A93", "#2F6B35", "#9A3B16", "#5B3A86", "#7A2438", "#8A847B", "#3F7F7A", "#A56B2A"];

/** Donut with a legend - for shares like status or delivery vs pickup. */
export function Donut({ slices, centerLabel }: { slices: { label: string; value: number }[]; centerLabel: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0" role="img" aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        <circle cx={70} cy={70} r={R} fill="none" className="stroke-hairline" strokeWidth={18} />
        {total > 0 && slices.map((s, i) => {
          const len = (s.value / total) * C;
          const el = <circle key={s.label} cx={70} cy={70} r={R} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={18}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)"><title>{`${s.label}: ${s.value}`}</title></circle>;
          offset += len;
          return el;
        })}
        <text x={70} y={68} textAnchor="middle" className="fill-ink" fontSize={24} fontWeight={700}>{total}</text>
        <text x={70} y={86} textAnchor="middle" className="fill-muted" fontSize={10}>{centerLabel}</text>
      </svg>
      <ul className="text-sm space-y-1.5 min-w-0">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="truncate text-ink/85">{s.label}</span>
            <span className="ml-auto pl-3 font-mono text-[13px] text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars for rankings - top flavours, busiest weekdays, top ingredients. */
export function RankBars({ rows, value, format, highlightMax = false }: {
  rows: { label: string; [k: string]: any }[]; value: string; format?: (r: any) => string; highlightMax?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r[value] ?? 0));
  if (!rows.length) return <p className="text-sm text-muted py-4">Nothing yet.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const top = highlightMax && r[value] === max && max > 0;
        return (
          <li key={r.label}>
            <div className="flex justify-between gap-3 text-sm mb-1">
              <span className={`truncate ${top ? "font-semibold text-ink" : "text-ink/85"}`}>{r.label}</span>
              <span className="font-mono text-[13px] text-ink shrink-0">{format ? format(r) : r[value]}</span>
            </div>
            <div className="h-2 rounded-full bg-hairline/70 overflow-hidden">
              <div className={`h-full rounded-full ${top ? "bg-honey" : "bg-plum"}`} style={{ width: `${((r[value] ?? 0) / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
