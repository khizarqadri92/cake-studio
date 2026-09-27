import { useEffect, useState } from "react";
import { Printer, Download, ExternalLink } from "lucide-react";
import { Modal } from "./Modal";
import { ordersApi } from "../api/orders";
import { mediaUrl } from "../api/client";
import { printTicketInBrowser } from "../lib/printTicket";

/** The kitchen ticket that goes with a baker's request: what to bake, no prices. */
export function KitchenTicketModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<Awaited<ReturnType<typeof ordersApi.kitchenTicket>> | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let live = true;
    Promise.all([ordersApi.kitchenTicket(orderId), ordersApi.kitchenTicketPdf(orderId)])
      .then(([t, blob]) => {
        if (!live) return;
        setTicket(t);
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch((err) => live && setError(err?.response?.data?.detail ?? "Couldn't load the kitchen ticket."));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [orderId]);

  const image = ticket?.reference_image_url ? mediaUrl(ticket.reference_image_url) : null;
  const btn = "h-11 px-4 rounded-xl border border-hairline bg-surface text-sm font-semibold text-ink hover:bg-flour flex items-center gap-2 disabled:opacity-40";

  return (
    <Modal title={ticket ? `Kitchen ticket · ${ticket.order_number}` : "Kitchen ticket"} onClose={onClose}>
      <div className="space-y-4">
        {error && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-xl px-4 py-3">{error}</p>}
        {!error && (
          <div className="rounded-xl bg-flour p-4 max-h-[460px] overflow-y-auto">
            {ticket ? (
              <div className="bg-white text-black mx-auto shadow-sm px-4 py-4 font-mono text-[12px] leading-[1.45]" style={{ width: `${Math.min(ticket.ticket_width, 48) * 0.62 + 2}em`, maxWidth: "100%" }}>
                {ticket.ticket_lines.map(([style, text], i) =>
                  style === "rule" ? <hr key={i} className="border-0 border-t border-dashed border-black my-1.5" /> : (
                    <div key={i} className={`whitespace-pre-wrap ${style === "title" ? "text-center font-bold text-[14px]" : style === "big" ? "text-center font-bold text-[22px] my-1" : style === "center" ? "text-center" : style === "bold" ? "font-bold" : ""}`}>
                      {text || "\u00a0"}
                    </div>
                  ),
                )}
                {image && (
                  <>
                    <div className="font-bold mt-2">Customer's design:</div>
                    <img src={image} alt="Customer's cake design" className="w-full mt-1" />
                  </>
                )}
              </div>
            ) : (
              <div className="h-60 flex items-center justify-center text-sm text-muted">Preparing ticket…</div>
            )}
          </div>
        )}
        {ticket && (
          <div className="flex flex-wrap gap-2">
            <button
              className={btn}
              disabled={printing}
              onClick={async () => { setPrinting(true); try { await printTicketInBrowser(ticket.ticket_lines, ticket.ticket_width, image); } finally { setPrinting(false); } }}
            >
              <Printer size={16} /> {printing ? "Opening…" : "Print"}
            </button>
            {pdfUrl && (
              <a href={pdfUrl} download={`kitchen-ticket-${ticket.order_number}.pdf`} className={btn}><Download size={16} /> Save PDF</a>
            )}
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink self-center">
                <ExternalLink size={13} /> Open PDF
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
