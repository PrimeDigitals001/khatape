import { useEffect, useState } from "react";
import { adminAPI } from "../services/adminAPI";
import { isModuleOn } from "../services/session";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-black mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const [enabled, setEnabled] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const on = await isModuleOn("analytics");
        setEnabled(on);
        if (!on) return;
        const res = await adminAPI.getAnalytics();
        setData(res.data);
      } catch (e) {
        setError(e.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (enabled === false) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-black mb-2">Analytics is off for this shop</h2>
          <p className="text-sm text-gray-500">Enable the <span className="font-medium">Analytics</span> module from the operator console.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-full bg-slate-50 p-6 text-sm text-gray-400">Loading analytics…</div>;
  if (error) return <div className="h-full bg-slate-50 p-6"><div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div></div>;

  const maxDay = Math.max(...data.series.map((d) => d.total), 1);

  return (
    <div className="h-full bg-slate-50 p-3 sm:p-6 overflow-y-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-black mb-4">Analytics</h1>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Total sales (all time)" value={fmt(data.totalSales)} sub={`${data.orderCount} orders`} />
        <Stat label="Outstanding" value={fmt(data.outstanding)} />
        <Stat label="Customers" value={data.customerCount} />
        <Stat label="Items" value={data.itemCount} />
      </div>

      {/* Sales last 14 days */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-black mb-3">Sales — last 14 days</h2>
        <div className="flex items-end gap-1 h-32">
          {data.series.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col justify-end group relative" title={`${d.date}: ${fmt(d.total)}`}>
              <div
                className="w-full rounded-t bg-[#E54A4A]/80 hover:bg-[#E54A4A]"
                style={{ height: d.total === 0 ? "2px" : `${(d.total / maxDay) * 100}%`, minHeight: d.total === 0 ? "2px" : "4px" }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>{data.series[0]?.date.slice(5)}</span>
          <span>{data.series[data.series.length - 1]?.date.slice(5)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top customers */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-black mb-3">Top customers</h2>
          {data.topCustomers.length === 0 ? (
            <p className="text-sm text-gray-400">No sales yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{c.name} <span className="text-gray-400 text-xs">· {c.orders} orders</span></span>
                  <span className="font-medium text-black">{fmt(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-black mb-3">Top items (by revenue)</h2>
          {data.topItems.length === 0 ? (
            <p className="text-sm text-gray-400">No sales yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topItems.map((it, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{it.name} <span className="text-gray-400 text-xs">· {it.qty}</span></span>
                  <span className="font-medium text-black">{fmt(it.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
