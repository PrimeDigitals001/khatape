import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiTrendingUp,
  FiShoppingBag,
  FiAlertCircle,
  FiCalendar,
  FiRefreshCw,
  FiClock,
  FiBarChart2,
} from "react-icons/fi";
import { adminAPI } from "../services/adminAPI";

const formatINR = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const formatTime = (d) =>
  d
    ? d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

function StatCard({ icon: Icon, label, value, subtitle, loading, error, accent }) {
  return (
    <div className="k-card p-5 flex flex-col gap-3 min-h-[140px]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div
          className={`p-2 rounded-lg ${accent || "bg-red-50 text-red-600"}`}
        >
          <Icon size={18} />
        </div>
      </div>

      {loading ? (
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
      ) : error ? (
        <div className="text-sm text-red-600">Failed to load</div>
      ) : (
        <div className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
          {value}
        </div>
      )}

      {subtitle && !loading && !error && (
        <div className="text-xs text-gray-500">{subtitle}</div>
      )}
    </div>
  );
}

const toMs = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === "function") return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  if (typeof createdAt === "string") return new Date(createdAt).getTime();
  return 0;
};

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [todayStats, setTodayStats] = useState(null);
  const [monthStats, setMonthStats] = useState(null);
  const [outstanding, setOutstanding] = useState(null);

  const [loading, setLoading] = useState({
    today: true,
    month: true,
    outstanding: true,
  });
  const [errors, setErrors] = useState({
    today: null,
    month: null,
    outstanding: null,
  });
  const [lastFetched, setLastFetched] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading({ today: true, month: true, outstanding: true });
    setErrors({ today: null, month: null, outstanding: null });

    const [todayRes, monthRes, outRes] = await Promise.allSettled([
      adminAPI.getTodayStats(),
      adminAPI.getMonthStats(),
      adminAPI.getOutstandingTotal(),
    ]);

    if (todayRes.status === "fulfilled") {
      setTodayStats(todayRes.value.data);
    } else {
      setErrors((e) => ({ ...e, today: todayRes.reason?.message || "Error" }));
    }

    if (monthRes.status === "fulfilled") {
      setMonthStats(monthRes.value.data);
    } else {
      setErrors((e) => ({ ...e, month: monthRes.reason?.message || "Error" }));
    }

    if (outRes.status === "fulfilled") {
      setOutstanding(outRes.value.data);
    } else {
      setErrors((e) => ({
        ...e,
        outstanding: outRes.reason?.message || "Error",
      }));
    }

    setLoading({ today: false, month: false, outstanding: false });
    setLastFetched(new Date());
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll, location.key]);

  const isRefreshing =
    loading.today || loading.month || loading.outstanding;

  const monthLabel = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const todayTransactions = todayStats?.transactions || [];

  const recentOrders = useMemo(() => {
    return [...todayTransactions]
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .slice(0, 10);
  }, [todayTransactions]);

  const hourlyBuckets = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => 0);
    todayTransactions.forEach((t) => {
      const ms = toMs(t.createdAt);
      if (!ms) return;
      const hour = new Date(ms).getHours();
      buckets[hour] += t.total || 0;
    });
    return buckets;
  }, [todayTransactions]);

  const maxHourly = Math.max(...hourlyBuckets, 1);
  const peakHour = hourlyBuckets.indexOf(Math.max(...hourlyBuckets));
  const formatHour = (h) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${ampm}`;
  };

  const handleOrderClick = (txn) => {
    if (!txn.customerId) return;
    navigate(`/admin/customers/${txn.customerId}/invoice`);
  };

  return (
    <div className="h-full bg-slate-50 p-3 sm:p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Dashboard
          </h1>
          {lastFetched && (
            <p className="text-xs text-gray-500 mt-1">
              Last updated at {formatTime(lastFetched)}
            </p>
          )}
        </div>
        <button
          onClick={loadAll}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 shadow-sm"
        >
          <FiRefreshCw
            size={16}
            className={isRefreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FiTrendingUp}
          label="Today's Sales"
          value={formatINR(todayStats?.sales)}
          subtitle={
            todayStats
              ? `${todayStats.orderCount} order${
                  todayStats.orderCount === 1 ? "" : "s"
                } today`
              : null
          }
          loading={loading.today}
          error={errors.today}
          accent="bg-green-50 text-green-600"
        />

        <StatCard
          icon={FiShoppingBag}
          label="Today's Orders"
          value={todayStats?.orderCount ?? 0}
          subtitle={todayStats ? `for ${todayStats.date}` : null}
          loading={loading.today}
          error={errors.today}
          accent="bg-blue-50 text-blue-600"
        />

        <StatCard
          icon={FiAlertCircle}
          label="Outstanding Unpaid"
          value={formatINR(outstanding?.total)}
          subtitle={
            outstanding
              ? `${outstanding.unpaidInvoiceCount} invoice${
                  outstanding.unpaidInvoiceCount === 1 ? "" : "s"
                } pending`
              : null
          }
          loading={loading.outstanding}
          error={errors.outstanding}
          accent="bg-red-50 text-red-600"
        />

        <StatCard
          icon={FiCalendar}
          label="This Month's Sales"
          value={formatINR(monthStats?.sales)}
          subtitle={
            monthStats
              ? `${monthStats.orderCount} order${
                  monthStats.orderCount === 1 ? "" : "s"
                } in ${monthLabel}`
              : null
          }
          loading={loading.month}
          error={errors.month}
          accent="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
        {/* Recent Orders */}
        <div className="k-card lg:col-span-3 flex flex-col">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
            <FiClock size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">
              Recent Orders (Today)
            </h2>
          </div>
          {loading.today ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-100 rounded animate-pulse"
                />
              ))}
            </div>
          ) : errors.today ? (
            <div className="p-5 text-sm text-red-600">
              Failed to load orders
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="p-5 text-sm text-gray-500">
              No orders yet today.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">
                      Customer
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Items</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-right font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((txn) => {
                    const itemsCount = Array.isArray(txn.items)
                      ? txn.items.reduce(
                          (sum, it) => sum + (it.quantity || 1),
                          0
                        )
                      : 0;
                    const ms = toMs(txn.createdAt);
                    return (
                      <tr
                        key={txn.id}
                        onClick={() => handleOrderClick(txn)}
                        className="border-t border-slate-100 hover:bg-red-50/60 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {txn.customerName || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {itemsCount} item{itemsCount === 1 ? "" : "s"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                          {formatINR(txn.total)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">
                          {ms ? formatTime(new Date(ms)) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Hourly Sales Chart */}
        <div className="k-card lg:col-span-2 flex flex-col">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
            <FiBarChart2 size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">Hourly Sales (Today)</h2>
          </div>
          {loading.today ? (
            <div className="p-5">
              <div className="h-40 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : errors.today ? (
            <div className="p-5 text-sm text-red-600">
              Failed to load chart
            </div>
          ) : todayTransactions.length === 0 ? (
            <div className="p-5 text-sm text-gray-500">
              No sales yet today.
            </div>
          ) : (
            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-end gap-1 h-40">
                {hourlyBuckets.map((value, h) => {
                  const heightPct = (value / maxHourly) * 100;
                  const isPeak = value > 0 && h === peakHour;
                  return (
                    <div
                      key={h}
                      className="flex-1 flex flex-col justify-end group relative"
                      title={`${formatHour(h)}: ${formatINR(value)}`}
                    >
                      <div
                        className={`w-full rounded-t transition-colors ${
                          value === 0
                            ? "bg-slate-100"
                            : isPeak
                            ? "bg-red-600"
                            : "bg-red-400 group-hover:bg-red-500"
                        }`}
                        style={{
                          height: value === 0 ? "2px" : `${heightPct}%`,
                          minHeight: value === 0 ? "2px" : "4px",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
              {peakHour >= 0 && hourlyBuckets[peakHour] > 0 && (
                <div className="text-xs text-gray-600 text-center">
                  Peak hour:{" "}
                  <span className="font-semibold text-gray-900">
                    {formatHour(peakHour)}
                  </span>{" "}
                  ({formatINR(hourlyBuckets[peakHour])})
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
