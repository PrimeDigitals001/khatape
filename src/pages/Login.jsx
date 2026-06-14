import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../services/supabase";

export default function Login() {
  const { login, loading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("signin"); // 'signin' | 'forgot'
  const [resetSent, setResetSent] = useState(false);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [loading, user, from, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message ?? "Failed to sign in");
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError("Enter your email first.");
    try {
      setSending(true);
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      setResetSent(true);
    } catch (e) {
      setError(e.message ?? "Could not send reset email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-red-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
            K
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-4 tracking-tight">Khatape</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="k-card p-6 sm:p-8">
          {error && (
            <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">
              {error}
            </div>
          )}

          {mode === "forgot" ? (
            resetSent ? (
              <div className="space-y-4">
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-xl">
                  If an account exists for <span className="font-medium">{email.trim()}</span>, a password-reset
                  link is on its way. Open it and choose a new password.
                </div>
                <button
                  onClick={() => { setMode("signin"); setResetSent(false); setError(null); }}
                  className="k-btn-primary w-full py-3"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-slate-500">Enter your account email and we'll send a reset link.</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    className="k-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="k-btn-primary w-full py-3 mt-2" disabled={sending}>
                  {sending ? "Sending…" : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(null); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  className="k-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(null); }}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  className="k-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="k-btn-primary w-full py-3 mt-2" disabled={loading}>
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Khatape · POS &amp; Khaata</p>
      </div>
    </div>
  );
}
