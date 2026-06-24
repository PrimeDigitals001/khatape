import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { superAdminAPI } from "../services/superAdminAPI";
import { setActiveTenantId } from "../services/session";
import { MODULES, optionalModules, isCoreModule } from "../lib/modules";

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null); // `${tenantId}:${moduleKey}` while toggling
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", upiId: "", gstNumber: "" });

  // Tenant logins modal
  const [loginsTenant, setLoginsTenant] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", password: "", role: "admin" });
  const [userBusy, setUserBusy] = useState(false);
  const [userErr, setUserErr] = useState(null);
  const [userMsg, setUserMsg] = useState(null);
  const [resetForId, setResetForId] = useState(null);
  const [resetPw, setResetPw] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await superAdminAPI.listTenants();
      setTenants(list);
    } catch (e) {
      setError(e.message || "Failed to load shops");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setCreating(true);
      setError(null);
      await superAdminAPI.createTenant(form);
      setForm({ name: "", phone: "", upiId: "", gstNumber: "" });
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e.message || "Failed to create shop");
    } finally {
      setCreating(false);
    }
  };

  const toggleModule = async (tenant, key, enabled) => {
    const k = `${tenant.id}:${key}`;
    try {
      setBusyKey(k);
      await superAdminAPI.setModule(tenant.id, key, enabled);
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id
            ? { ...t, modules: enabled ? [...t.modules, key] : t.modules.filter((m) => m !== key) }
            : t
        )
      );
    } catch (e) {
      setError(e.message || "Failed to update module");
    } finally {
      setBusyKey(null);
    }
  };

  const enterShop = (tenant) => {
    setActiveTenantId(tenant.id, tenant.name);
    navigate("/admin/dashboard");
  };

  // ---- Tenant logins ----
  const openLogins = async (tenant) => {
    setLoginsTenant(tenant);
    setUsers([]);
    setUserForm({ email: "", password: "", role: "admin" });
    setUserErr(null);
    setUserMsg(null);
    setResetForId(null);
    setResetPw("");
    setUsersLoading(true);
    try {
      const list = await superAdminAPI.listTenantUsers(tenant.id);
      setUsers(list);
    } catch (e) {
      setUserErr(e.message || "Failed to load logins");
    } finally {
      setUsersLoading(false);
    }
  };

  const closeLogins = () => setLoginsTenant(null);

  const createUser = async (e) => {
    e.preventDefault();
    setUserErr(null);
    setUserMsg(null);
    try {
      setUserBusy(true);
      await superAdminAPI.createTenantUser({ ...userForm, tenantId: loginsTenant.id });
      setUserMsg(`Login created: ${userForm.email}`);
      setUserForm({ email: "", password: "", role: "admin" });
      const list = await superAdminAPI.listTenantUsers(loginsTenant.id);
      setUsers(list);
    } catch (e) {
      setUserErr(e.message || "Failed to create login");
    } finally {
      setUserBusy(false);
    }
  };

  const resetPassword = async (userId) => {
    setUserErr(null);
    setUserMsg(null);
    if (resetPw.length < 6) {
      setUserErr("Password must be at least 6 characters");
      return;
    }
    try {
      setUserBusy(true);
      await superAdminAPI.resetTenantUserPassword({ userId, password: resetPw });
      setUserMsg("Password reset");
      setResetForId(null);
      setResetPw("");
    } catch (e) {
      setUserErr(e.message || "Failed to reset password");
    } finally {
      setUserBusy(false);
    }
  };

  return (
    <div>
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shops</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create shops and choose which modules each one gets. New optional modules stay off until you grant them.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          {showCreate ? "Close" : "+ New shop"}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">New shop</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Shop name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Sharma Dairy" autoFocus />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="10-digit number" />
            <Field label="UPI ID" value={form.upiId} onChange={(v) => setForm({ ...form, upiId: v })} placeholder="name@bank" />
            <Field label="GST number" value={form.gstNumber} onChange={(v) => setForm({ ...form, gstNumber: v })} placeholder="optional" />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {creating ? "Creating…" : "Create shop"}
            </button>
          </div>
        </form>
      )}

      {/* Tenant list */}
      {loading ? (
        <div className="text-slate-400 text-sm py-12 text-center">Loading shops…</div>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-600 font-medium">No shops yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first shop to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {tenants.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{t.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.phone || "no phone"} · {t.customerCount} customers · {t.itemCount} items
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => enterShop(t)}
                    className="text-sm bg-slate-900 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Enter shop →
                  </button>
                  <button
                    onClick={() => openLogins(t)}
                    className="text-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Logins
                  </button>
                </div>
              </div>

              {/* Core modules (always on) */}
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">Always on</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(MODULES).filter(isCoreModule).map((k) => (
                    <span key={k} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                      {MODULES[k].name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Optional modules (toggleable) */}
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">Optional modules</p>
                <div className="flex flex-wrap gap-1.5">
                  {optionalModules().map((k) => {
                    const on = t.modules.includes(k);
                    const busy = busyKey === `${t.id}:${k}`;
                    return (
                      <button
                        key={k}
                        onClick={() => toggleModule(t, k, !on)}
                        disabled={busy}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors disabled:opacity-50 ${
                          on
                            ? "bg-red-50 border-red-300 text-red-700"
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        {on ? "✓ " : ""}{MODULES[k].name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tenant logins modal */}
      {loginsTenant && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={closeLogins}>
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Logins · {loginsTenant.name}</h2>
            <p className="text-xs text-slate-500 mb-4">
              Passwords can't be viewed (they're encrypted) — you can create logins and reset passwords.
            </p>

            {userMsg && <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{userMsg}</div>}
            {userErr && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{userErr}</div>}

            {/* Existing logins */}
            <div className="space-y-2 mb-5">
              {usersLoading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-slate-400">No logins yet for this shop.</p>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-900">{u.email}</p>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">{u.role}</p>
                      </div>
                      <button
                        onClick={() => { setResetForId(resetForId === u.id ? null : u.id); setResetPw(""); }}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                      >
                        {resetForId === u.id ? "Cancel" : "Reset password"}
                      </button>
                    </div>
                    {resetForId === u.id && (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={resetPw}
                          onChange={(e) => setResetPw(e.target.value)}
                          placeholder="New password (min 6)"
                          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                        />
                        <button
                          onClick={() => resetPassword(u.id)}
                          disabled={userBusy}
                          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                          Set
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Create login */}
            <form onSubmit={createUser} className="border-t border-slate-200 pt-4">
              <p className="text-xs font-medium text-slate-600 mb-2">Add a login</p>
              <div className="space-y-2">
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Password (min 6)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={closeLogins} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                  Close
                </button>
                <button type="submit" disabled={userBusy} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {userBusy ? "Working…" : "Create login"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, autoFocus }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </label>
  );
}
