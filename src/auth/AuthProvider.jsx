import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { clearSessionCache, getActiveTenantId } from "../services/session";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [collectionId, setCollectionId] = useState(null); // = active tenant id (compat shim)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    // Loads role + tenant for the current auth user (or clears it on sign-out).
    const loadProfile = async (currentUser) => {
      if (!currentUser) {
        clearSessionCache();
        if (!active) return;
        setRole(null);
        setCollectionId(null);
        setLoading(false);
        return;
      }
      try {
        clearSessionCache();
        const { data, error: profErr } = await supabase
          .from("app_users")
          .select("role, tenant_id")
          .eq("id", currentUser.id)
          .single();
        if (profErr) throw profErr;
        if (!active) return;
        setRole(data?.role ?? null);
        // super_admin has no fixed tenant — resolve an active one for the data layer.
        let tenantId = data?.tenant_id ?? null;
        if (!tenantId) {
          try {
            tenantId = await getActiveTenantId();
          } catch {
            tenantId = null;
          }
        }
        if (!active) return;
        setCollectionId(tenantId);
      } catch (e) {
        if (!active) return;
        setError(e);
        setRole(null);
        setCollectionId(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    // Prime from any persisted session, then subscribe to changes.
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data?.session?.user ?? null;
      setUser(sessionUser);
      loadProfile(sessionUser);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setLoading(true);
      loadProfile(sessionUser);
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setError(null);
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) throw signInErr;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    clearSessionCache();
  };

  const value = useMemo(
    () => ({ user, role, collectionId, loading, error, login, logout }),
    [user, role, collectionId, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
