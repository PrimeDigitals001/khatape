import { useEffect, useState } from "react";
import { adminAPI } from "../services/adminAPI";
import { isModuleOn } from "../services/session";
import { whatsappService } from "../services/whatsappService";
import { buildInvoicePdf, downloadBlob } from "../services/invoicePdf";

const monthBounds = (ym) => {
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const end = new Date(y, m, 0).toISOString().split("T")[0]; // last day of month
  return { start, end };
};

const thisMonth = () => new Date().toISOString().slice(0, 7);
const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function BulkInvoice() {
  const [enabled, setEnabled] = useState(null);
  const [month, setMonth] = useState(thisMonth());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [shop, setShop] = useState(null);
  const [sent, setSent] = useState({}); // invoiceId -> true
  const [working, setWorking] = useState(null); // invoiceId currently being processed

  useEffect(() => {
    isModuleOn("bulk_invoice").then(setEnabled).catch(() => setEnabled(false));
    adminAPI
      .getTenantProfile()
      .then((r) => setShop(r.data))
      .catch(() => setShop(null));
  }, []);

  const generate = async () => {
    try {
      setBusy(true);
      setError(null);
      setResult(null);
      setSent({});
      const { start, end } = monthBounds(month);
      const res = await adminAPI.bulkGenerateInvoices(start, end);
      setResult(res.data);
    } catch (e) {
      setError(e.message || "Failed to generate invoices");
    } finally {
      setBusy(false);
    }
  };

  // Download the tenant-branded PDF for one invoice. Returns nothing.
  const downloadPdf = async (inv) => {
    const blob = await buildInvoicePdf({
      shop: shop || {},
      customer: { name: inv.name, phone: inv.phone, code: inv.code },
      orders: inv.orders || [],
      total: inv.total,
      invoiceId: inv.invoiceId,
      startDate: inv.startDate,
      endDate: inv.endDate,
    });
    downloadBlob(blob, `Invoice-${inv.invoiceId}.pdf`);
  };

  // Hand one invoice to the customer: download its PDF, then open WhatsApp with
  // a pre-filled message. The shopkeeper attaches the downloaded PDF in the chat.
  const sendOne = async (inv) => {
    try {
      setWorking(inv.invoiceId);
      setError(null);
      await downloadPdf(inv);
      if (inv.phone) {
        whatsappService.sendInvoiceReceipt(inv.phone, {
          customer: { name: inv.name, phone: inv.phone },
          invoiceId: inv.invoiceId,
          startDate: inv.startDate,
          endDate: inv.endDate,
          orders: inv.orders || [],
          totalAmount: Number(inv.total || 0),
          paidAmount: 0,
          remainingAmount: Number(inv.total || 0),
          paymentStatus: "unpaid",
          storeName: shop?.name || "Shop",
        });
      }
      setSent((s) => ({ ...s, [inv.invoiceId]: true }));
    } catch (e) {
      setError(e.message || "Could not prepare this invoice");
    } finally {
      setWorking(null);
    }
  };

  const invoices = result?.invoices || [];
  const sentCount = invoices.filter((i) => sent[i.invoiceId]).length;
  const nextUnsent = invoices.find((i) => !sent[i.invoiceId]);

  if (enabled === false) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-black mb-2">Bulk invoicing is off for this shop</h2>
          <p className="text-sm text-gray-500">Enable the <span className="font-medium">Bulk invoicing</span> module from the operator console.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 p-3 sm:p-6 overflow-y-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-black mb-1">Bulk Invoicing</h1>
      <p className="text-xs text-gray-500 mb-6">Generate a monthly invoice for every customer who bought during the month, then send each one on WhatsApp with its PDF.</p>

      <div className="max-w-md bg-white rounded-2xl border border-gray-200 p-5">
        {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        <label className="block mb-4">
          <span className="text-xs font-medium text-gray-600">Month to invoice</span>
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setResult(null); setSent({}); }}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E54A4A]"
          />
        </label>

        <button
          onClick={generate}
          disabled={busy || !month}
          className="w-full bg-[#E54A4A] hover:bg-[#d63939] text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate invoices for this month"}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <p className="font-semibold">{result.count} invoice{result.count === 1 ? "" : "s"} generated · {fmt(result.total)} total.</p>
            <p className="text-xs mt-1 text-green-700">
              These now show as Outstanding on each customer. Re-running this month won't create duplicates.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">
          Tip: invoices are one per customer per month, summing all their purchases in that month.
        </p>
      </div>

      {/* Send list — appears after generating */}
      {result && invoices.length > 0 && (
        <div className="max-w-2xl bg-white rounded-2xl border border-gray-200 p-5 mt-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-black">Send to customers</h2>
            <span className="text-xs text-gray-500">{sentCount} / {invoices.length} done</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Each tap downloads that customer's PDF and opens their WhatsApp with the bill pre-filled — attach the PDF
            and hit send. (Browsers can't auto-send to everyone at once, so it's one tap per customer.)
          </p>

          {nextUnsent && (
            <button
              onClick={() => sendOne(nextUnsent)}
              disabled={!!working}
              className="w-full mb-4 bg-[#E54A4A] hover:bg-[#d63939] text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {working ? "Preparing…" : `Send next → ${nextUnsent.name || "Customer"}  ·  ${fmt(nextUnsent.total)}`}
            </button>
          )}
          {!nextUnsent && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm font-medium text-center">
              All {invoices.length} invoices sent 🎉
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {invoices.map((inv) => {
              const isSent = !!sent[inv.invoiceId];
              const isWorking = working === inv.invoiceId;
              return (
                <div key={inv.invoiceId} className="py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-black truncate">
                      {inv.name || "Customer"}
                      {isSent && <span className="ml-2 text-green-600 text-xs font-semibold">✓ sent</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {fmt(inv.total)}{inv.phone ? ` · ${inv.phone}` : " · no phone"}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadPdf(inv)}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                    title="Download PDF only"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => sendOne(inv)}
                    disabled={isWorking}
                    className={`text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-50 ${
                      isSent
                        ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        : "bg-[#E54A4A] text-white hover:bg-[#d63939]"
                    }`}
                    title={inv.phone ? "Download PDF + open WhatsApp" : "No phone — downloads PDF only"}
                  >
                    {isWorking ? "…" : isSent ? "Resend" : inv.phone ? "WhatsApp" : "PDF"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
