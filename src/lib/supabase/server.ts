import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client factory.
 * Uses @supabase/ssr to manage the anonymous session via HttpOnly cookies.
 * Must be called with `await` — cookies() is async in Next.js 16 (Pitfall 3).
 */
export async function createClient() {
  const cookieStore = await cookies() // cookies() is async in Next.js 16
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookie mutations are
            // ignored outside of middleware or route handlers; this is safe.
          }
        },
      },
    }
  )
}
