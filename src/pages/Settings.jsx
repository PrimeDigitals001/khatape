import { useEffect, useState } from "react";
import { adminAPI } from "../services/adminAPI";
import { supabase } from "../services/supabase";

export default function Settings() {
  // Shop profile
  const [profile, setProfile] = useState({ name: "", phone: "", upiId: "", gstNumber: "", waOnPurchase: false });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileErr, setProfileErr] = useState(null);

  // Password
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminAPI.getTenantProfile();
        setProfile({
          name: res.data.name || "",
          phone: res.data.phone || "",
          upiId: res.data.upiId || "",
          gstNumber: res.data.gstNumber || "",
          waOnPurchase: res.data.waOnPurchase || false,
        });
      } catch (e) {
        setProfileErr(e.message || "Failed to load shop profile");
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setProfileErr(null);
      setProfileMsg(null);
      await adminAPI.updateTenantProfile(profile);
      setProfileMsg("Shop profile saved");
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (e) {
      setProfileErr(e.message || "Failed to save");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (pw1.length < 6) {
      setPwErr("Password must be at least 6 characters");
      return;
    }
    if (pw1 !== pw2) {
      setPwErr("Passwords do not match");
      return;
    }
    try {
      setSavingPw(true);
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPw1("");
      setPw2("");
      setPwMsg("Password changed successfully");
      setTimeout(() => setPwMsg(null), 3000);
    } catch (e) {
      setPwErr(e.message || "Failed to change password");
    } finally {
      setSavingPw(false);
    }
  };

  const input =
    "w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E54A4A]";

  return (
    <div className="h-full bg-slate-50 p-3 sm:p-6 overflow-y-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-black mb-1">Settings</h1>
      <p className="text-xs text-gray-500 mb-6">Manage your shop details and your login.</p>

      <div className="max-w-xl space-y-6">
        {/* Shop profile */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-black mb-4">Shop profile</h2>
          {profileMsg && <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{profileMsg}</div>}
          {profileErr && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{profileErr}</div>}
          {loadingProfile ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <form onSubmit={saveProfile} className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Shop name *</span>
                <input className={input} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Phone</span>
                  <input className={input} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">UPI ID</span>
                  <input className={input} placeholder="name@bank" value={profile.upiId} onChange={(e) => setProfile({ ...profile, upiId: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">GST number</span>
                <input className={input} value={profile.gstNumber} onChange={(e) => setProfile({ ...profile, gstNumber: e.target.value })} />
              </label>
              <p className="text-xs text-gray-400">Used on invoices (name, UPI for the payment QR, GST).</p>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#E54A4A]"
                  checked={profile.waOnPurchase}
                  onChange={(e) => setProfile({ ...profile, waOnPurchase: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium text-black">Open WhatsApp after each sale</span>
                  <span className="block text-xs text-gray-500">
                    Off keeps the counter fast — staff can still send a receipt from the success screen.
                    Turn on to auto-open WhatsApp on every purchase.
                  </span>
                </span>
              </label>

              <button type="submit" disabled={savingProfile} className="bg-[#E54A4A] hover:bg-[#d63939] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </form>
          )}
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-black mb-4">Change password</h2>
          {pwMsg && <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{pwMsg}</div>}
          {pwErr && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{pwErr}</div>}
          <form onSubmit={changePassword} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">New password</span>
              <input type="password" className={input} value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="At least 6 characters" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Confirm new password</span>
              <input type="password" className={input} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </label>
            <button type="submit" disabled={savingPw} className="bg-[#E54A4A] hover:bg-[#d63939] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {savingPw ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
