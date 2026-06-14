import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client factory.
 * Creates a singleton-like client for use in Client Components ('use client').
 * The @supabase/ssr package manages cookie sync with the server client automatically.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
