// Tenant-aware invoice PDF generator (browser-side, jsPDF).
// Shop name + UPI come from the tenant profile — NEVER hardcoded.
// Returns a Blob so callers can download it or hand it to the user to attach
// to WhatsApp (browsers can't attach a file to wa.me programmatically).

const RED = [229, 74, 74]; // #E54A4A — app accent
const INK = [17, 24, 39]; // slate-900
const MUTE = [107, 114, 128]; // slate-500

const rs = (n) => `Rs ${Number(n || 0).toFixed(2)}`;

// Build a UPI deep-link string (used for the QR + a tappable link in WhatsApp).
export function upiLink({ upiId, shopName, amount, note }) {
  if (!upiId) return null;
  const params = new URLSearchParams({
    pa: upiId,
    pn: shopName || "Shop",
    am: Number(amount || 0).toFixed(2),
    cu: "INR",
  });
  if (note) params.set("tn", note);
  return `upi://pay?${params.toString()}`;
}

// orders: [{ itemName, date, quantity, unitPrice, total }]
// shop:   { name, upiId, phone, gstNumber }
// customer: { name, phone, code }
// Returns a Blob (application/pdf).
export async function buildInvoicePdf({
  shop = {},
  customer = {},
  orders = [],
  total = 0,
  invoiceId = "",
  startDate = "",
  endDate = "",
  date = "",
}) {
  const [{ default: jsPDF }, autoTableModule, QRCode] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("qrcode"),
  ]);
  const autoTable = autoTableModule?.default || autoTableModule?.autoTable;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const shopName = shop.name || "Shop";

  // ---- Header band ----------------------------------------------------------
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(shopName, margin, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const sub = [shop.phone, shop.gstNumber ? `GST: ${shop.gstNumber}` : null].filter(Boolean).join("   ");
  if (sub) doc.text(sub, margin, 60);
  // "INVOICE" on the right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("INVOICE", pageWidth - margin, 46, { align: "right" });
  doc.setTextColor(...INK);

  // ---- Meta: invoice no + dates (right) / Bill To (left) --------------------
  const metaY = 120;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTE);
  doc.text("BILL TO", margin, metaY);
  doc.setTextColor(...INK);
  doc.setFontSize(13);
  doc.text(customer.name || "Customer", margin, metaY + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTE);
  let by = metaY + 34;
  if (customer.code) { doc.text(`ID: ${customer.code}`, margin, by); by += 14; }
  if (customer.phone) { doc.text(customer.phone, margin, by); by += 14; }

  // right-aligned meta block
  const rx = pageWidth - margin;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTE);
  doc.text("Invoice No.", rx - 150, metaY, { align: "left" });
  doc.setTextColor(...INK);
  doc.text(String(invoiceId || "-"), rx, metaY, { align: "right" });
  if (date) {
    doc.setTextColor(...MUTE);
    doc.text("Date", rx - 150, metaY + 16, { align: "left" });
    doc.setTextColor(...INK);
    doc.text(String(date), rx, metaY + 16, { align: "right" });
  }
  if (startDate || endDate) {
    doc.setTextColor(...MUTE);
    doc.text("Period", rx - 150, metaY + 32, { align: "left" });
    doc.setTextColor(...INK);
    doc.text(`${startDate || ""} - ${endDate || ""}`, rx, metaY + 32, { align: "right" });
  }

  // ---- Items table ----------------------------------------------------------
  const rows = orders.map((o) => {
    const unit = typeof o.unitPrice === "string" ? parseFloat(o.unitPrice) : o.unitPrice;
    const tot = typeof o.total === "string" ? parseFloat(o.total) : o.total;
    return [
      String(o.itemName || o.name || ""),
      String(o.date || ""),
      String(o.quantity ?? ""),
      rs(isNaN(unit) ? 0 : unit),
      rs(isNaN(tot) ? 0 : tot),
    ];
  });

  const startY = metaY + 64;
  autoTable(doc, {
    head: [["Item", "Date", "Qty", "Rate", "Amount"]],
    body: rows,
    startY,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 10, cellPadding: 7, lineColor: [235, 235, 235], lineWidth: 0.5, textColor: INK },
    headStyles: { fillColor: INK, textColor: 255, halign: "left", fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [250, 250, 251] },
    columnStyles: {
      0: { cellWidth: contentWidth - (80 + 40 + 85 + 90) },
      1: { cellWidth: 80, halign: "center", textColor: MUTE },
      2: { cellWidth: 40, halign: "center" },
      3: { cellWidth: 85, halign: "right" },
      4: { cellWidth: 90, halign: "right" },
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY || startY;
  let sectionY = tableEndY + 24;
  if (pageHeight - margin - sectionY < 170) {
    doc.addPage();
    sectionY = margin + 24;
  }

  // ---- Total due box (right) ------------------------------------------------
  const boxW = 230;
  const boxX = pageWidth - margin - boxW;
  doc.setFillColor(...RED);
  doc.roundedRect(boxX, sectionY, boxW, 46, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL DUE", boxX + 14, sectionY + 28);
  doc.setFontSize(16);
  doc.text(rs(total), boxX + boxW - 14, sectionY + 29, { align: "right" });
  doc.setTextColor(...INK);

  // ---- UPI QR (left, only if the shop has a UPI id) -------------------------
  const link = upiLink({ upiId: shop.upiId, shopName, amount: total, note: `Invoice ${invoiceId}` });
  if (link) {
    try {
      const qr = await QRCode.toDataURL(link, { width: 130, margin: 1 });
      doc.addImage(qr, "PNG", margin, sectionY, 92, 92);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text("Scan to pay (UPI)", margin + 102, sectionY + 38);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTE);
      doc.text(shop.upiId, margin + 102, sectionY + 54);
      doc.setTextColor(...INK);
    } catch {
      /* QR is best-effort */
    }
  }

  // ---- Footer ---------------------------------------------------------------
  doc.setDrawColor(235, 235, 235);
  doc.setLineWidth(1);
  doc.line(margin, pageHeight - 46, pageWidth - margin, pageHeight - 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTE);
  doc.text("Thank you for your business!", margin, pageHeight - 28);
  doc.text(`${shopName} · Powered by Khatape`, pageWidth - margin, pageHeight - 28, { align: "right" });
  doc.setTextColor(...INK);

  return doc.output("blob");
}

// Trigger a browser download of a Blob.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
