/** Print a kitchen ticket through the browser's print dialog.
 *  Rendered in a hidden iframe at receipt-paper width, so only the ticket
 *  prints - not the page behind it. */
export function printTicketInBrowser(lines: [string, string][], widthChars: number, imageUrl?: string | null): Promise<void> {
  const mm = widthChars <= 32 ? 58 : widthChars <= 42 ? 76 : 80;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = lines
    .map(([style, text]) => {
      if (style === "rule") return `<hr>`;
      const cls = { title: "title", big: "big", bold: "bold", center: "center" }[style] ?? "";
      return `<div class="${cls}">${esc(text) || "&nbsp;"}</div>`;
    })
    .join("") + (imageUrl ? `<div class="bold" style="margin-top:6px">Customer's design:</div><img src="${imageUrl}" style="width:100%;margin-top:3px">` : "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Kitchen ticket</title><style>
    @page { size: ${mm}mm auto; margin: 3mm; }
    body { margin: 0; font: 12px/1.35 "Courier New", monospace; color: #000; width: ${mm - 6}mm; }
    .center, .title, .big { text-align: center; }
    .title { font-weight: 700; font-size: 15px; letter-spacing: 1px; }
    .big { font-weight: 700; font-size: 22px; margin: 2px 0; }
    .bold { font-weight: 700; }
    hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
    div { white-space: pre-wrap; }
  </style></head><body>${body}</body></html>`;

  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const done = () => { setTimeout(() => frame.remove(), 500); resolve(); };
    frame.onload = async () => {
      const w = frame.contentWindow!;
      // wait for the design photo so it isn't missing from the print
      await Promise.all(Array.from(w.document.images).map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
      w.onafterprint = done;
      w.focus();
      w.print();
      setTimeout(done, 60000); // safety net if afterprint never fires
    };
    frame.srcdoc = html;
  });
}
