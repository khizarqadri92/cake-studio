import { BusinessHours } from "../api/organization";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export function BusinessHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: BusinessHours;
  onChange: (next: BusinessHours) => void;
  disabled?: boolean;
}) {
  const updateDay = (day: string, field: "open" | "close" | "closed", val: string | boolean) => {
    onChange({ ...value, [day]: { ...value[day], [field]: val } });
  };

  return (
    <div className="space-y-1.5">
      {DAYS.map(({ key, label }) => {
        const day = value[key] ?? { open: "09:00", close: "18:00", closed: false };
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-24 text-ink/70">{label}</span>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={day.closed}
                disabled={disabled}
                onChange={(e) => updateDay(key, "closed", e.target.checked)}
              />
              Closed
            </label>
            {!day.closed && (
              <>
                <input
                  type="time"
                  value={day.open}
                  disabled={disabled}
                  onChange={(e) => updateDay(key, "open", e.target.value)}
                  className="border border-hairline rounded px-2 py-1 text-xs"
                />
                <span className="text-muted">to</span>
                <input
                  type="time"
                  value={day.close}
                  disabled={disabled}
                  onChange={(e) => updateDay(key, "close", e.target.value)}
                  className="border border-hairline rounded px-2 py-1 text-xs"
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
