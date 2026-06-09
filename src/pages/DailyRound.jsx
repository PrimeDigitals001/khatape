import { useEffect, useState } from "react";
import { adminAPI } from "../services/adminAPI";
import { isModuleOn } from "../services/session";
import { computeLineTotal } from "../lib/pricing";
import { rupeesToPaise, paiseToRupees } from "../lib/money";

// Total (in rupees) for one delivery line at a given quantity.
const lineTotal = (line, qty) => {
  const q = parseFloat(qty);
  if (!q || q <= 0) return 0;
  if (line.pricingMode === "loose") {
    try {
      const paise = computeLineTotal(
        { pricingMode: "loose", ratePaise: rupeesToPaise(Number(line.price)), rateUnit: line.rateUnit },
        q,
        line.saleUnit || line.rateUnit
      );
      return paiseToRupees(paise);
    } catch {
      return 0;
    }
  }
  return Number(line.price) * q;
};

export default function DailyRound() {
  const [enabled, setEnabled] = useState(null); // null = checking
  const [round, setRound] = useState([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [skipped, setSkipped] = useState({}); // customerId -> true (local only)

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const on = await isModuleOn("standing_orders");
      setEnabled(on);
      if (!on) return;
      const res = await adminAPI.getTodayRound();
      // attach an editable `qty` to each line (defaults to standing quantity)
      const withQty = res.data.round.map((c) => ({
        ...c,
        lines: c.lines.map((l) => ({ ...l, qty: l.quantity })),
      }));
      setRound(withQty);
      setDate(res.data.date);
    } catch (e) {
      setError(e.message || "Failed to load the round");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setLineQty = (customerId, idx, value) => {
    setRound((prev) =>
      prev.map((c) =>
        c.customerId === customerId
          ? { ...c, lines: c.lines.map((l, i) => (i === idx ? { ...l, qty: value } : l)) }
          : c
      )
    );
  };

  const customerTotal = (c) => c.lines.reduce((sum, l) => sum + lineTotal(l, l.qty), 0);

  const markDelivered = async (c) => {
    const items = c.lines
      .filter((l) => parseFloat(l.qty) > 0)
      .map((l) => ({
        itemId: l.itemId,
        itemName: l.pricingMode === "loose" ? `${l.itemName} (${l.qty} ${l.saleUnit})` : l.itemName,
        quantity: parseFloat(l.qty),
        unitPrice: Number(l.price),
        total: lineTotal(l, l.qty),
        pricingMode: l.pricingMode,
        saleUnit: l.pricingMode === "loose" ? l.saleUnit : "piece",
      }));
    if (items.length === 0) {
      setError("Nothing to deliver — set a quantity above 0 or Skip.");
      return;
    }
    try {
      setBusyId(c.customerId);
      setError(null);
      await adminAPI.recordDelivery({
        customerId: c.customerId,
        customerName: c.name,
        items,
        total: customerTotal(c),
      });
      setRound((prev) =>
        prev.map((x) => (x.customerId === c.customerId ? { ...x, deliveredToday: true } : x))
      );
    } catch (e) {
      setError(e.message || "Failed to record delivery");
    } finally {
      setBusyId(null);
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  // ---- gating / states ----
  if (enabled === false) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-black mb-2">Daily Round is off for this shop</h2>
          <p className="text-sm text-gray-500">
            The <span className="font-medium">Daily standing orders</span> module isn't enabled.
            Ask the operator to grant it from the console.
          </p>
        </div>
      </div>
    );
  }

  const doneCount = round.filter((c) => c.deliveredToday).length;

  return (
    <div className="h-full bg-slate-50 p-3 sm:p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-black">Today's Round</h1>
          <p className="text-xs text-gray-500 mt-1">
            {date} · {doneCount}/{round.length} delivered
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-12 text-center">Loading round…</div>
      ) : round.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-600 font-medium">No standing orders yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Set a customer's daily order from Customers → Standing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {round.map((c) => {
            const isSkipped = skipped[c.customerId];
            return (
              <div
                key={c.customerId}
                className={`bg-white rounded-xl border p-4 ${
                  c.deliveredToday ? "border-green-300 bg-green-50/40" : isSkipped ? "border-gray-200 opacity-60" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-black">{c.name}</h3>
                    <p className="text-xs text-gray-400">{c.code || c.phone}</p>
                  </div>
                  {c.deliveredToday && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      ✓ Delivered
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {c.lines.map((l, i) => (
                    <div key={l.standingId} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700 truncate">
                        {l.itemName}
                        {l.missing && <span className="text-red-500 text-xs ml-1">(item deleted)</span>}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={l.qty}
                        disabled={c.deliveredToday}
                        onChange={(e) => setLineQty(c.customerId, i, e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right disabled:bg-gray-100"
                      />
                      <span className="text-xs text-gray-400 w-8">{l.pricingMode === "loose" ? l.saleUnit : "pc"}</span>
                      <span className="text-sm font-medium text-black w-16 text-right">
                        {fmt(lineTotal(l, l.qty))}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-sm font-semibold text-black">{fmt(customerTotal(c))}</span>
                  {!c.deliveredToday && !isSkipped && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSkipped((s) => ({ ...s, [c.customerId]: true }))}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => markDelivered(c)}
                        disabled={busyId === c.customerId}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#E54A4A] text-white hover:bg-[#d63939] disabled:opacity-50"
                      >
                        {busyId === c.customerId ? "Saving…" : "Delivered"}
                      </button>
                    </div>
                  )}
                  {isSkipped && (
                    <button
                      onClick={() => setSkipped((s) => ({ ...s, [c.customerId]: false }))}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      Undo skip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
