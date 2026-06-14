import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

// Page the password-reset email link lands on. The supabase client exchanges the
// recovery token in the URL for a temporary session automatically; here the user
// just picks a new password. Also doubles as a "change password" page for anyone
// already signed in.
export default function ResetPassword() {
  const [ready, setReady] = useState(false); // a (recovery) session is present
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    try {
      setBusy(true);
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      setDone(true);
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (e) {
      setError(e.message || "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-red-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm">K</div>
          <h1 className="text-2xl font-bold text-slate-900 mt-4 tracking-tight">Set a new password</h1>
        </div>

        <div className="k-card p-6 sm:p-8">
          {done ? (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-xl text-center">
              Password updated. Signing you in…
            </div>
          ) : checking ? (
            <p className="text-sm text-slate-400 text-center">Checking your link…</p>
          ) : !ready ? (
            <div className="text-sm text-slate-600 text-center space-y-3">
              <p>This reset link is invalid or expired.</p>
              <button onClick={() => navigate("/login")} className="k-btn-primary w-full py-2.5">Back to sign in</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <input type="password" className="k-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input type="password" className="k-input" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <button type="submit" className="k-btn-primary w-full py-3 mt-2" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
