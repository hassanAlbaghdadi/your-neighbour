import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Anon-key client for public, RLS-readable data (products, categories,
// settings, homepage/story photos). Unlike `@/lib/supabase/server`, this
// never reads cookies(), so pages that only need these reads can still be
// statically rendered/ISR'd instead of being forced fully dynamic.
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
