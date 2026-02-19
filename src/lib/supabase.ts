import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Single client instance — service role bypasses RLS (server-side only)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
