import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Share2, MessageCircle, Copy, Check, ExternalLink } from "lucide-react";
import { Modal } from "./Modal";
import { ordersApi, ReceiptResponse } from "../api/orders";
import { failureReason } from "../api/client";

/** Customer receipt: preview the real PDF, then save, print or share it. */
export type ReceiptContext = "saved" | "rider" | "paid" | null;

/** Why the receipt opened by itself, so the popup can say what to do with it */
const CONTEXT_TEXT: Record<Exclude<ReceiptContext, null>, (name: string, rider?: string) => [string, string]> = {
  saved: (n) => ["Order saved as a draft.", `Send this receipt to ${n} to check. Once they agree, confirm the order and the kitchen ticket prints.`],
  rider: (n, rider) => ["Handed to the rider.", `Print this delivery receipt for ${rider ?? "the rider"} to give ${n} with the cake. It shows what to collect on delivery.`],
  paid: (n) => ["Payment received.", `Give ${n} this payment receipt: print it, or send it on WhatsApp.`],
};

export function ReceiptModal({ orderId, context = null, riderName, onClose }: { orderId: string; context?: ReceiptContext; riderName?: string; onClose: () => void }) {
  const [data, setData] = useState<ReceiptResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let live = true;
    Promise.all([ordersApi.receipt(orderId), ordersApi.receiptPdf(orderId)])
      .then(([r, blob]) => {
        if (!live) return;
        setData(r);
        setPdfBlob(blob);
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch(async (err) => {
        if (!live) return;
        if (err?.response?.status === 403) { setError("You don't have access to this order's receipt."); return; }
        // Say why, so a problem can be found quickly (the server log has the full details).
        setError(`Couldn't prepare the receipt: ${await failureReason(err)}. If this keeps happening, send the file C:\\ProgramData\\CakeStudio\\logs\\server.log to support.`);
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [orderId]);

  const fileName = data ? `receipt-${data.receipt.order_number}.pdf` : "receipt.pdf";
  const pdfFile = useMemo(() => (pdfBlob ? new File([pdfBlob], fileName, { type: "application/pdf" }) : null), [pdfBlob, fileName]);
  const canShareFile = !!pdfFile && typeof navigator.canShare === "function" && navigator.canShare({ files: [pdfFile] });

  const download = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName;
    a.click();
  };

  const print = () => {
    // Opening the PDF in its own tab gives the browser's full PDF print options
    if (pdfUrl) window.open(pdfUrl, "_blank", "noopener");
  };

  const share = async () => {
    if (!pdfFile || !data) return;
    setShareError(null);
    try {
      await navigator.share({ files: [pdfFile], title: `Order ${data.receipt.order_number}`, text: data.share_text });
    } catch (err: any) {
      if (err?.name !== "AbortError") setShareError("Sharing didn't work on this device. Download the PDF and attach it instead.");
    }
  };

  const whatsappHref = data
    ? `https://wa.me/${data.whatsapp_phone ?? ""}?text=${encodeURIComponent(data.share_text)}`
    : "#";

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.share_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError("Couldn't copy. Select the text in the preview instead.");
    }
  };

  const btn = "h-11 px-4 rounded-xl border border-hairline bg-surface text-sm font-semibold text-ink hover:bg-flour flex items-center gap-2 disabled:opacity-40";

  return (
    <Modal title={data ? `${(data.receipt as any).title ?? "Receipt"} · ${data.receipt.order_number}` : "Receipt"} onClose={onClose} wide>
      <div className="space-y-4">
        {context && data && (() => {
          const [head, body] = CONTEXT_TEXT[context](data.receipt.customer_name, riderName);
          return (
            <div className={`rounded-xl px-4 py-3 text-sm ${context === "paid" ? "bg-sage/10 border border-sage/30 text-ink" : "bg-[#FBF3E4] dark:bg-honey/15 text-[#5A3E0E] dark:text-cream"}`}>
              <p className="font-semibold">{head}</p>
              <p className="mt-0.5">{body}</p>
            </div>
          );
        })()}
        {error && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-xl px-4 py-3">{error}</p>}

        {!error && (
          <div className="rounded-xl border border-hairline bg-flour p-3 sm:p-5 max-h-[440px] overflow-y-auto">
            {data ? <ReceiptPreview r={data.receipt as unknown as ReceiptFields} /> : (
              <div className="h-60 flex items-center justify-center text-sm text-muted">Preparing receipt…</div>
            )}
          </div>
        )}

        {data && pdfUrl && (
          <>
            <div className="flex flex-wrap gap-2">
              <button onClick={download} className={btn}><Download size={16} /> Download PDF</button>
              <button onClick={print} className={btn}><Printer size={16} /> Print</button>
              {canShareFile && <button onClick={share} className={btn}><Share2 size={16} /> Share</button>}
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={btn}>
                <MessageCircle size={16} /> WhatsApp {data.receipt.customer_name.split(" ")[0]}
              </a>
              <button onClick={copy} className={btn}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy summary"}</button>
            </div>
            <p className="text-xs text-muted">
              WhatsApp opens a chat with {data.receipt.customer_phone} and the order summary typed in.
              {canShareFile ? " Share sends the PDF itself through WhatsApp, email or any app on this device." : " To send the PDF itself, download it and attach it in the chat."}
            </p>
            {shareError && <p className="text-sm text-plum">{shareError}</p>}
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
              <ExternalLink size={13} /> Open the PDF in a new tab
            </a>
          </>
        )}
      </div>
    </Modal>
  );
}


interface ReceiptFields {
  company: string; address: string; phones: string; email: string; tax_number: string; currency: string;
  order_number: string; is_draft: boolean; issued: string; due: string; fulfillment: string; delivery_address: string;
  customer_name: string; customer_phone: string;
  cake_lines: [string, string][]; lines: { label: string; detail: string; qty: string; amount: string }[];
  message_on_cake: string; special_instructions: string; customer_design: boolean;
  subtotal: string; delivery_charge: string; discount: string; total: string; advance_paid: string; balance_due: string;
  has_discount: boolean; has_delivery: boolean; advance_paid_zero: boolean;
  kind: "order" | "delivery" | "payment"; title: string; status_text: string; status_tone: "pending" | "ok" | "due";
  payment_label: string; payment_amount: string; balance_label: string; paid_date: string; note: string;
}

/** On-screen copy of the PDF, drawn from the same data (PDF previews don't
 *  display inside pages on many phones). Always light, like the paper. */
function ReceiptPreview({ r }: { r: ReceiptFields }) {
  const fact = (k: string, v: string) => (
    <div className="flex gap-3"><dt className="w-20 shrink-0 text-[11px] font-semibold text-[#6B5E58]">{k}</dt><dd className="text-[13px]">{v || "-"}</dd></div>
  );
  const total = (k: string, v: string, strong = false) => (
    <div className={`flex justify-between gap-6 py-0.5 ${strong ? "font-bold border-t border-[#E7DFD5] pt-1.5 mt-1" : ""}`}><span>{k}</span><span className="font-mono">{v}</span></div>
  );
  return (
    <article className="bg-white text-[#2A1F1D] rounded-lg shadow-sm mx-auto max-w-[520px] px-6 sm:px-8 py-7" aria-label="Receipt preview">
      <header className="flex justify-between gap-4">
        <p className="font-display text-lg font-semibold text-[#6E2437]">{r.company}</p>
        <p className="text-[11px] text-[#6B5E58] text-right leading-relaxed">
          {[r.address, r.phones, r.email, r.tax_number ? `Tax no. ${r.tax_number}` : ""].filter(Boolean).map((x) => <span key={x} className="block">{x}</span>)}
        </p>
      </header>
      <h3 className="font-display text-2xl font-semibold mt-6 flex items-center gap-3">
        {r.title}
        {r.kind === "payment" && r.status_tone === "ok" && (
          <span className="font-sans text-xs font-bold tracking-wide text-[#2F6B35] border-2 border-[#2F6B35] rounded px-1.5 py-0.5 -rotate-3">PAID</span>
        )}
      </h3>
      <p className="text-[13px]">
        <b className={{ pending: "text-[#8A5A12]", ok: "text-[#2F6B35]", due: "text-[#9A3B16]" }[r.status_tone]}>{r.status_text}</b>
        {r.paid_date && <span className="text-[#6B5E58]"> on {r.paid_date}</span>}
      </p>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-5">
        {fact("Order", r.order_number)}{fact("Customer", r.customer_name)}
        {fact("Issued", r.issued)}{fact("Phone", r.customer_phone)}
        {fact("Due", r.due)}{fact("Fulfilment", r.fulfillment)}
        {r.fulfillment === "Home delivery" && r.delivery_address && <div className="sm:col-span-2">{fact("Deliver to", r.delivery_address)}</div>}
      </dl>

      <div className="text-[12px] text-[#6B5E58] mt-4 space-y-0.5">
        {r.cake_lines.length > 0 && <p>{r.cake_lines.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
        {r.message_on_cake && <p><b>Message on cake:</b> {r.message_on_cake}</p>}
        {r.special_instructions && <p><b>Instructions:</b> {r.special_instructions}</p>}
        {r.customer_design && <p><b>Design:</b> customer's own design (reference image on file)</p>}
      </div>

      <table className="cs-plain w-full text-[13px] mt-4">
        <thead><tr className="text-[11px] text-[#6B5E58] border-b border-[#E7DFD5]"><th className="text-left py-1.5 font-semibold">Item</th><th className="text-right font-semibold">Qty</th><th className="text-right font-semibold">Amount ({r.currency})</th></tr></thead>
        <tbody>
          {r.lines.map((ln, i) => (
            <tr key={i} className="border-b border-[#E7DFD5] align-top">
              <td className="py-2"><b>{ln.label}</b>{ln.detail && <span className="block text-[#6B5E58]">{ln.detail}</span>}</td>
              <td className="py-2 text-right">{ln.qty}</td>
              <td className="py-2 text-right font-mono">{ln.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-full sm:w-64 text-[13px] mt-3">
        {total("Subtotal", r.subtotal)}
        {r.has_delivery && total("Delivery", r.delivery_charge)}
        {r.has_discount && total("Discount", `-${r.discount}`)}
        {total("Total", `${r.currency} ${r.total}`, true)}
        {total("Advance paid", r.advance_paid_zero ? r.advance_paid : `-${r.advance_paid}`)}
        {r.kind === "payment" && total(r.payment_label, `-${r.payment_amount}`)}
        <div className="flex justify-between items-center rounded-md bg-[#FBF3E4] text-[#5A3E0E] px-3 py-2 mt-2 font-bold">
          <span>{r.balance_label}</span><span className="font-mono text-[15px]">{r.currency} {r.balance_due}</span>
        </div>
      </div>
      <p className="text-[12px] text-[#6B5E58] mt-6">{r.note}</p>
    </article>
  );
}
