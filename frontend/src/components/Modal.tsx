import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Clicking outside does NOT close the popup (it's easy to do by accident and
  // lose what was typed). It gives a small nudge instead, so it's clear the
  // popup stayed open on purpose. Close with the X, Cancel/Close, or Esc.
  // Only a CSS class is toggled - the popup itself is never rebuilt, so
  // nothing typed into it is lost.
  const [nudging, setNudging] = useState(false);
  const startNudge = () => {
    setNudging(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setNudging(true)));   // restart the animation
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="cs-modal fixed inset-0 bg-ink/45 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto"
      onMouseDown={(e) => {
        // Only a press that starts on the dark background itself (not a text
        // selection dragged out of the popup).
        if (e.target === e.currentTarget) startNudge();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface rounded-2xl shadow-xl border border-hairline w-full ${wide ? "max-w-3xl" : "max-w-lg"} my-8 ${nudging ? "cs-nudge" : ""}`}
        onAnimationEnd={() => setNudging(false)}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-hairline">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink hover:bg-flour rounded-lg p-2 -mr-2">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
