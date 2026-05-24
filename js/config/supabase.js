import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://avocwsvplaqnvrqwayqg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2b2N3c3ZwbGFxbnZycXdheXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDMyNDYsImV4cCI6MjA5NTIxOTI0Nn0.Ksnsxgz_3yeOAS_sFM_6B1I9I5RszoddmElOOb-n75M";

const isPlaceholder = (value) => value.startsWith("COLE_AQUI");

export const isSupabaseConfigured = !isPlaceholder(SUPABASE_URL) && !isPlaceholder(SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

export { SUPABASE_URL, SUPABASE_ANON_KEY };
