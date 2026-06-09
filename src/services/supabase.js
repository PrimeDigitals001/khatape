import { createClient } from "@supabase/supabase-js";

// Read from .env.local (gitignored). See .env.local.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Fail loud and early — a misconfigured client otherwise produces confusing
  // "Failed to fetch" errors deep inside the app.
  throw new Error(
    "Missing Supabase env vars. Copy .env.local.example to .env.local and set " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
