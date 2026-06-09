import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { FiPackage, FiUsers, FiX, FiHome, FiShoppingCart, FiTruck, FiZap, FiSettings, FiUpload } from "react-icons/fi";
import { getActiveTenantName, getEnabledModules } from "../services/session";

// `module` (optional) gates the item behind an enabled module key.
const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: FiHome },
  { to: "/admin/manage-items", label: "Items", icon: FiPackage },
  { to: "/admin/pos", label: "Point of Sale", icon: FiShoppingCart },
  { to: "/admin/round", label: "Daily Round", icon: FiTruck, module: "standing_orders" },
  { to: "/admin/tap", label: "Tap & Go", icon: FiZap, module: "standing_orders" },
  { to: "/admin/customers", label: "Customers", icon: FiUsers },
  { to: "/admin/import", label: "Import / Export", icon: FiUpload, module: "bulk_import" },
  { to: "/admin/settings", label: "Settings", icon: FiSettings },
];

export default function Sidebar({ onClose }) {
  const shopName = getActiveTenantName();
  const [modules, setModules] = useState(null); // Set of enabled keys (null = loading)

  useEffect(() => {
    let active = true;
    getEnabledModules()
      .then((keys) => active && setModules(keys))
      .catch(() => active && setModules(new Set()));
    return () => { active = false; };
  }, []);

  const visibleItems = navItems.filter(
    (it) => !it.module || (modules && modules.has(it.module))
  );

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-full p-4 flex flex-col">
      {/* Mobile Close Button */}
      <div className="flex justify-end mb-2 lg:hidden">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <FiX size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <div className="h-9 w-9 rounded-xl bg-red-600 flex items-center justify-center font-bold text-white">
          K
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-semibold text-slate-900 tracking-tight">Khatape</div>
          <div className="text-[11px] text-slate-400 truncate">
            {shopName || "Shop"}
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-red-50 text-red-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 pt-4">
        <p className="text-[11px] text-slate-400">Khatape POS · v0.1</p>
      </div>
    </div>
  );
}
