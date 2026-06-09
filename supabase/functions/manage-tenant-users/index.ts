// Khatape — manage-tenant-users Edge Function
// Lets a SUPER-ADMIN create tenant logins, list them, and reset passwords.
// Uses the service-role key (server-side only) via Supabase's Admin API.
// Passwords are never returned/readable — only set/reset.
//
// Deploy: Supabase dashboard → Edge Functions → create "manage-tenant-users",
// paste this file, deploy. (SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the caller from their JWT.
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await caller.auth.getUser();
    if (userErr || !user) return json(401, { error: "Not authenticated" });

    // Privileged client (service role) — never exposed to the browser.
    const admin = createClient(url, serviceKey);

    // Caller must be a super-admin.
    const { data: appUser } = await admin
      .from("app_users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!appUser || appUser.role !== "super_admin") {
      return json(403, { error: "Super-admin only" });
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "list") {
      if (!body.tenantId) return json(400, { error: "tenantId required" });
      const { data, error } = await admin
        .from("app_users")
        .select("id, email, role")
        .eq("tenant_id", body.tenantId)
        .order("role", { ascending: true });
      if (error) throw error;
      return json(200, { users: data || [] });
    }

    if (action === "create") {
      const { email, password, tenantId } = body;
      const role = body.role === "staff" ? "staff" : "admin";
      if (!email || !password || !tenantId) {
        return json(400, { error: "email, password and tenantId are required" });
      }
      if (String(password).length < 6) {
        return json(400, { error: "Password must be at least 6 characters" });
      }
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) throw createErr;

      // Assign the new user to the tenant + role (overrides the default staff row
      // the signup trigger may have created).
      const { error: upsertErr } = await admin
        .from("app_users")
        .upsert({ id: created.user.id, email, tenant_id: tenantId, role }, { onConflict: "id" });
      if (upsertErr) throw upsertErr;

      return json(200, { user: { id: created.user.id, email, role } });
    }

    if (action === "reset_password") {
      const { userId, password } = body;
      if (!userId || !password) return json(400, { error: "userId and password required" });
      if (String(password).length < 6) {
        return json(400, { error: "Password must be at least 6 characters" });
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    return json(500, { error: (e as Error).message || "Server error" });
  }
});
