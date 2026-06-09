import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getActiveTenantName } from "../services/session";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role } = useAuth();
  const isSuper = (role || "").toLowerCase() === "super_admin";
  const shopName = getActiveTenantName();

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col">
      {/* Operator banner — only when a super-admin has entered a shop */}
      {isSuper && (
        <div className="bg-red-600 text-white text-sm px-4 py-1.5 flex items-center justify-between">
          <span>
            Operating shop{shopName ? `: ${shopName}` : ""} as operator
          </span>
          <Link to="/super" className="underline underline-offset-2 hover:text-red-100">
            ← Back to Operator Console
          </Link>
        </div>
      )}

      {/* Topbar - Full Width */}
      <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Bottom Section - Sidebar + Content */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          fixed lg:static
          top-0 left-0
          z-50 lg:z-auto
          transition-transform duration-300 ease-in-out
          h-full
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
        
        {/* Main content */}
        <div className="flex-1 overflow-y-auto h-full lg:ml-0">
          <Outlet /> {/* This is where pages will render */}
        </div>
      </div>
    </div>
  );
}