import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  const actual = (role || "").toLowerCase();
  const allowed = (allowedRoles || []).map((r) => (r || "").toLowerCase());

  // super_admin (the operator) belongs in the console (/super) and may enter a
  // shop's ADMIN area to help — but NOT the staff POS. So it's allowed only where
  // 'super_admin' or 'admin' is permitted. Other roles must be explicitly listed.
  const ok =
    actual === "super_admin"
      ? allowed.includes("super_admin") || allowed.includes("admin")
      : allowed.length === 0 || allowed.includes(actual);
  if (!ok) {
    // Wrong role for this area → bounce to root; RoleRedirect places them correctly.
    return <Navigate to="/" replace />;
  }
  return children;
}
