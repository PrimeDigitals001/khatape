import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../services/supabase";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Public, no-login page a customer opens via their private link (/c/<token>).
export default function CustomerView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: res, error: fnErr } = await supabase.functions.invoke("customer-view", {
          body: { token },
        });
        if (fnErr) throw new Error("Could not load — link may be invalid.");
        if (res?.error) throw new Error(res.error);
        setData(res);
      } catch (e) {
        setError(e.message || "Could not load your khaata.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 text-sm">Loading…</div>;
  }
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center max-w-sm">
          <p className="text-slate-700 font-medium">{error}</p>
          <p className="text-slate-400 text-sm mt-1">Ask the shop for a fresh link.</p>
        </div>
      </div>
    );
  }

  const upiLink =
    data.shopUpi && data.outstanding > 0
      ? `upi://pay?pa=${encodeURIComponent(data.shopUpi)}&pn=${encodeURIComponent(data.shop)}&am=${data.outstanding}&cu=INR`
      : null;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Shop header */}
        <div className="text-center pt-6 pb-4">
          <div className="h-12 w-12 rounded-2xl bg-red-600 text-white text-xl font-bold flex items-center justify-center mx-auto">K</div>
          <h1 className="text-lg font-bold text-slate-900 mt-2">{data.shop}</h1>
          <p className="text-xs text-slate-400">Khaata for {data.name}{data.code ? ` · ${data.code}` : ""}</p>
        </div>

        {/* Balance card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center mb-4">
          {data.outstanding > 0 ? (
            <>
              <p className="text-xs uppercase tracking-wider text-slate-400">You owe</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{fmt(data.outstanding)}</p>
              {upiLink && (
                <a href={upiLink} className="inline-block mt-4 bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm">
                  Pay via UPI
                </a>
              )}
            </>
          ) : data.advance > 0 ? (
            <>
              <p className="text-xs uppercase tracking-wider text-slate-400">Advance balance</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{fmt(data.advance)}</p>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wider text-slate-400">Balance</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">All clear 🎉</p>
            </>
          )}
        </div>

        {/* Recent purchases */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3 text-sm">Recent purchases</h2>
          {data.recent.length === 0 ? (
            <p className="text-sm text-slate-400">No purchases yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recent.map((t, i) => (
                <div key={i} className="py-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t.date}</span>
                    <span className="font-medium text-slate-900">{fmt(t.total)}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {t.items.map((it) => `${it.name}${it.qty ? ` ×${it.qty}` : ""}`).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          {data.shopPhone ? `Questions? Call ${data.shopPhone} · ` : ""}Powered by Khatape
        </p>
      </div>
    </div>
  );
}
