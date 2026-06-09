import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Operator Console shell — deliberately distinct from the shop (admin/staff) UI:
// dark slate top bar, emerald accent, spacious light canvas.
export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-500 flex items-center justify-center font-bold text-slate-900">K</div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Khatape</div>
              <div className="text-[11px] text-red-300 uppercase tracking-wider">Operator Console</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-slate-300">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
