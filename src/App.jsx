import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import StaffLayout from "./layouts/StaffLayout";
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import SuperAdmin from "./pages/SuperAdmin";
import ManageItems from "./pages/ManageItems";
import Customers from "./pages/Customers";
import CustomerInvoice from "./pages/CustomerInvoice";
import PointOfSale from "./pages/PointOfSale";
import DailyRound from "./pages/DailyRound";
import TapAndGo from "./pages/TapAndGo";
import Settings from "./pages/Settings";
import BulkImport from "./pages/BulkImport";
import InvoiceManagement from "./pages/InvoiceManagement";
import AdminDashboard from "./pages/AdminDashboard";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import Login from "./pages/Login";

function RoleRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const roleLower = (role || "").toLowerCase();
  // super_admin gets the Operator Console; tenant admin/staff get the shop app.
  if (roleLower === "super_admin") return <Navigate to="/super" replace />;
  if (roleLower === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (roleLower === "staff") return <Navigate to="/staff/pos" replace />;
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Super-Admin (Operator Console) */}
          <Route
            path="/super"
            element={
              <RequireAuth allowedRoles={["super_admin"]}>
                <SuperAdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<SuperAdmin />} />
          </Route>

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <RequireAuth allowedRoles={["admin"]}>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="manage-items" element={<ManageItems />} />
            <Route path="pos" element={<PointOfSale />} />
            <Route path="customers" element={<Customers />} />
            <Route path="round" element={<DailyRound />} />
            <Route path="tap" element={<TapAndGo />} />
            <Route path="settings" element={<Settings />} />
            <Route path="import" element={<BulkImport />} />
            <Route
              path="customers/:customerId/invoice"
              element={<CustomerInvoice />}
            />
            <Route path="invoices" element={<InvoiceManagement />} />
          </Route>

          {/* Staff Routes — staff only. Shop admins use /admin/pos; super-admin → console. */}
          <Route
            path="/staff"
            element={
              <RequireAuth allowedRoles={["staff"]}>
                <StaffLayout />
              </RequireAuth>
            }
          >
            <Route path="pos" element={<PointOfSale />} />
          </Route>

          {/* Temporary Navigation Page */}
          <Route path="/switch" element={<SwitchLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// Temporary component to switch between layouts
function SwitchLayout() {
  return (
    <div className="h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-black mb-6 text-center">
          Choose Layout
        </h1>
        <div className="flex flex-wrap gap-4 justify-center">
          <a
            href="/admin/manage-items"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
          >
            Admin Panel
          </a>
          <a
            href="/staff/pos"
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
          >
            Staff POS
          </a>
          <a
            href="/admin/invoices"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
          >
            📄 Invoice Management
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
