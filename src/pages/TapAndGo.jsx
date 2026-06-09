import { useEffect, useRef, useState } from "react";
import { staffAPI } from "../services/staffAPI";
import { adminAPI } from "../services/adminAPI";
import { isModuleOn } from "../services/session";
import { computeLineTotal } from "../lib/pricing";
import { rupeesToPaise, paiseToRupees } from "../lib/money";

// Total (rupees) for one standing line.
const lineTotal = (line) => {
  const q = Number(line.quantity);
  if (!q || q <= 0) return 0;
  if (line.pricingMode === "loose") {
    try {
      return paiseToRupees(
        computeLineTotal(
          { pricingMode: "loose", ratePaise: rupeesToPaise(Number(line.price)), rateUnit: line.rateUnit },
          q,
          line.saleUnit || line.rateUnit
        )
      );
    } catch {
      return 0;
    }
  }
  return Number(line.price) * q;
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Build delivery items + total from a customer's standing-order rows.
const buildLines = (standingOrders, itemMap) => {
  const lines = (standingOrders || []).map((s) => {
    const item = itemMap[s.item_id];
    return {
      itemId: s.item_id,
      itemName: s.item_name || item?.name || "Item",
      quantity: Number(s.quantity),
      saleUnit: s.sale_unit,
      pricingMode: item?.pricingMode || "packaged",
      rateUnit: item?.rateUnit || "piece",
      price: item ? Number(item.price) : 0,
    };
  });
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  return { lines, total };
};

export default function TapAndGo() {
  const [enabled, setEnabled] = useState(null);
  const [rfid, setRfid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [done, setDone] = useState(null); // { name, total }
  const [dup, setDup] = useState(null); // { customer, lines, total } when already delivered today

  const itemMapRef = useRef({});
  const inputRef = useRef(null);
  const busyRef = useRef(false); // prevents a fast double-tap from double-posting

  useEffect(() => {
    (async () => {
      try {
        const on = await isModuleOn("standing_orders");
        setEnabled(on);
        if (!on) return;
        const itemsRes = await staffAPI.getAllItems();
        const map = {};
        (itemsRes.data || []).forEach((i) => { map[i.id] = i; });
        itemMapRef.current = map;
      } catch (e) {
        setError(e.message || "Failed to load");
      }
    })();
  }, []);

  // Keep the scanner focused while idle.
  useEffect(() => {
    if (enabled && !done && !dup && inputRef.current) {
      const id = setInterval(() => {
        if (document.activeElement !== inputRef.current) inputRef.current?.focus({ preventScroll: true });
      }, 500);
      return () => clearInterval(id);
    }
  }, [enabled, done, dup, loading]);

  const record = async (customer, lines, total) => {
    const items = lines
      .filter((l) => Number(l.quantity) > 0)
      .map((l) => ({
        itemId: l.itemId,
        itemName: l.pricingMode === "loose" ? `${l.itemName} (${l.quantity} ${l.saleUnit})` : l.itemName,
        quantity: Number(l.quantity),
        unitPrice: Number(l.price),
        total: lineTotal(l),
        pricingMode: l.pricingMode,
        saleUnit: l.pricingMode === "loose" ? l.saleUnit : "piece",
      }));
    await adminAPI.recordDelivery({ customerId: customer.id, customerName: customer.name, items, total });
    setDone({ name: customer.name, total });
    setDup(null);
  };

  const handleScan = async (value) => {
    const code = (value ?? rfid).trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await staffAPI.getCustomerByRfid(code);
      const customer = res.data;

      const soRes = await adminAPI.getCustomerStandingOrders(customer.id);
      const { lines, total } = buildLines(soRes.data.standingOrders, itemMapRef.current);
      if (lines.length === 0) {
        setInfo(`${customer.name} has no standing order. Set one from Customers → Standing.`);
        return;
      }

      // Guard accidental double-tap: if already delivered today, ask before repeating.
      const already = await adminAPI.wasDeliveredToday(customer.id);
      if (already) {
        setDup({ customer, lines, total });
        return;
      }

      await record(customer, lines, total); // straight onto their account — no cart
    } catch (e) {
      setError("Customer not found for this card.");
    } finally {
      setLoading(false);
      setRfid("");
      busyRef.current = false;
    }
  };

  const onInput = (e) => {
    const v = e.target.value.replace(/[^0-9]/g, "");
    setRfid(v);
    if (v.length === 10) setTimeout(() => handleScan(v), 100);
  };

  const reset = () => {
    setDone(null);
    setDup(null);
    setError(null);
    setInfo(null);
    setRfid("");
  };

  if (enabled === false) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-black mb-2">Tap &amp; Go is off for this shop</h2>
          <p className="text-sm text-gray-500">
            Enable the <span className="font-medium">Daily standing orders</span> module from the operator console.
          </p>
        </div>
      </div>
    );
  }

  // Already-delivered-today confirmation
  if (dup) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-8 text-center max-w-sm w-full">
          <h2 className="text-lg font-semibold text-black">Already delivered today</h2>
          <p className="text-sm text-gray-500 mt-1">
            {dup.customer.name} already has a delivery today. Deliver again for {fmt(dup.total)}?
          </p>
          <div className="flex gap-3 mt-5">
            <button onClick={reset} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200">
              Cancel
            </button>
            <button
              onClick={() => record(dup.customer, dup.lines, dup.total)}
              className="flex-1 bg-[#E54A4A] hover:bg-[#d63939] text-white py-3 rounded-lg font-semibold"
            >
              Deliver again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success splash
  if (done) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-black">Delivered to {done.name}</h2>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt(done.total)}</p>
          <p className="text-xs text-gray-500 mt-1">Added to their account (khaata)</p>
          <button onClick={reset} className="mt-5 w-full bg-[#E54A4A] hover:bg-[#d63939] text-white py-3 rounded-lg font-semibold">
            Tap next card
          </button>
        </div>
      </div>
    );
  }

  // Idle: waiting for a tap
  return (
    <div className="h-full bg-slate-50 p-3 sm:p-6 overflow-y-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-black mb-1">Tap &amp; Go</h1>
      <p className="text-xs text-gray-500 mb-4">
        Tap a card — the customer's standing order is added straight to their account. No cart, no clicks.
      </p>

      {error && <div className="mb-4 max-w-md mx-auto rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      {info && <div className="mb-4 max-w-md mx-auto rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">{info}</div>}

      <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-8 text-center mt-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
          {loading ? (
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E54A4A]" />
          ) : (
            <svg className="w-10 h-10 text-[#E54A4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-black mb-1">{loading ? "Recording…" : "Tap RFID Card"}</h3>
        <p className="text-sm text-gray-500 mb-5">Standing order goes straight onto their khaata</p>
        <form onSubmit={(e) => { e.preventDefault(); handleScan(); }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoFocus
            value={rfid}
            onChange={onInput}
            placeholder="RFID will appear here…"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#E54A4A]"
          />
          <p className="text-xs text-gray-400 mt-2">Try: 1234567890</p>
        </form>
      </div>
    </div>
  );
}
