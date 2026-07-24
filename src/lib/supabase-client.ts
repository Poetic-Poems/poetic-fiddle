import { createClient } from "@supabase/supabase-js";
import { MISSING_SUPABASE_ENV_MESSAGE } from "@/lib/env-errors";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(MISSING_SUPABASE_ENV_MESSAGE);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
