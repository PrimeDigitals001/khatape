// Tenant-aware invoice PDF generator (browser-side, jsPDF).
// Shop name + UPI come from the tenant profile — NEVER hardcoded.
// Returns a Blob so callers can download it or hand it to the user to attach
// to WhatsApp (browsers can't attach a file to wa.me programmatically).

const RED = [229, 74, 74]; // #E54A4A — app accent

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
// shop:   { name, upiId, phone }
// Returns a Blob (application/pdf).
export async function buildInvoicePdf({
  shop = {},
  customer = {},
  orders = [],
  total = 0,
  invoiceId = "",
  startDate = "",
  endDate = "",
}) {
  const [{ default: jsPDF }, autoTableModule, QRCode] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("qrcode"),
  ]);
  const autoTable = autoTableModule?.default || autoTableModule?.autoTable;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const shopName = shop.name || "Shop";

  // ---- Header ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...RED);
  doc.text(shopName, pageWidth / 2, margin, { align: "center" });
  doc.setTextColor(0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Invoice: ${invoiceId}`, pageWidth / 2, margin + 18, { align: "center" });
  if (startDate || endDate) {
    doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, margin + 34, { align: "center" });
  }

  const boxTop = margin + 52;
  const boxHeight = 70;

  // Customer box
  doc.setDrawColor(220);
  doc.setLineWidth(1);
  doc.roundedRect(margin, boxTop, contentWidth / 2 - 8, boxHeight, 6, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Customer", margin + 10, boxTop + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Name: ${customer.name || ""}`, margin + 10, boxTop + 36);
  doc.text(`Phone: ${customer.phone || "-"}`, margin + 10, boxTop + 52);
  if (customer.code) doc.text(`ID: ${customer.code}`, margin + 10, boxTop + 68);

  // Summary box
  const rightBoxX = margin + contentWidth / 2 + 8;
  doc.roundedRect(rightBoxX, boxTop, contentWidth / 2 - 8, boxHeight, 6, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", rightBoxX + 10, boxTop + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Total items: ${orders.length}`, rightBoxX + 10, boxTop + 36);
  doc.text(`Amount due: ${rs(total)}`, rightBoxX + 10, boxTop + 52);

  // ---- Items table ----
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

  const startY = boxTop + boxHeight + 24;
  autoTable(doc, {
    head: [["Item", "Date", "Qty", "Rate", "Total"]],
    body: rows,
    startY,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 10, cellPadding: 6, lineColor: 230, lineWidth: 0.5 },
    headStyles: { fillColor: RED, textColor: 255, halign: "center", fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 245, 245] },
    columnStyles: {
      0: { cellWidth: contentWidth - (90 + 40 + 90 + 90) },
      1: { cellWidth: 90, halign: "center" },
      2: { cellWidth: 40, halign: "center" },
      3: { cellWidth: 90, halign: "right" },
      4: { cellWidth: 90, halign: "right" },
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY || startY;
  let sectionY = tableEndY + 30;
  if (pageHeight - margin - sectionY < 200) {
    doc.addPage();
    sectionY = margin + 30;
  }

  // ---- Grand total ----
  doc.setDrawColor(...RED);
  doc.setLineWidth(2);
  doc.roundedRect(margin, sectionY, 250, 40, 6, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...RED);
  doc.text("Total Due:", margin + 10, sectionY + 25);
  doc.text(rs(total), margin + 240, sectionY + 25, { align: "right" });
  doc.setTextColor(0);

  // ---- UPI QR (only if the shop has a UPI id) ----
  const link = upiLink({ upiId: shop.upiId, shopName, amount: total, note: `Invoice ${invoiceId}` });
  if (link) {
    try {
      const qr = await QRCode.toDataURL(link, { width: 120, margin: 1 });
      const qrX = margin + 300;
      const qrY = sectionY - 20;
      doc.setDrawColor(...RED);
      doc.setLineWidth(2);
      doc.roundedRect(qrX, qrY, 140, 140, 6, 6);
      doc.addImage(qr, "PNG", qrX + 10, qrY + 10, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...RED);
      doc.text("Scan to pay (UPI)", qrX + 70, qrY + 158, { align: "center" });
      doc.setTextColor(0);
    } catch {
      /* QR is best-effort */
    }
  }

  // ---- Footer ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const footer = shop.phone ? `${shopName}  ·  ${shop.phone}` : shopName;
  doc.text(footer, pageWidth / 2, pageHeight - 24, { align: "center" });
  doc.setTextColor(0);

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
