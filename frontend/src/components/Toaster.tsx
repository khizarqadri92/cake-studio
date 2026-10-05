import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore } from "../store/toastStore";

/** Shows confirmation messages. Screen readers announce them (role=status). */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="fixed bottom-5 right-5 rtl:right-auto rtl:left-5 z-[100] flex flex-col gap-2 w-[min(24rem,calc(100vw-2.5rem))]" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? AlertTriangle : Info;
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg bg-surface text-sm text-ink ${
              t.tone === "success" ? "border-sage/50" : t.tone === "error" ? "border-plum/40" : "border-hairline"
            }`}
          >
            <Icon size={18} className={`shrink-0 mt-0.5 ${t.tone === "success" ? "text-sage" : t.tone === "error" ? "text-plum" : "text-muted"}`} />
            <p className="flex-1">{t.text}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-ink"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}
