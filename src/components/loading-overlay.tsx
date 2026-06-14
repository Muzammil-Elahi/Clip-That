'use client'

import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  show: boolean
}

/**
 * LoadingOverlay — covers the form card while a Server Action is pending.
 *
 * Renders absolutely over its nearest `relative`-positioned ancestor.
 * Uses bg-background/85 (shadcn CSS variable, near-black at 85% opacity)
 * per UI-SPEC Loading Overlay.
 *
 * Security (T-02-02): All text is hardcoded — no user input reflected here.
 */
export default function LoadingOverlay({ show }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-background/85"
      aria-hidden="true"
    >
      <Loader2 className="animate-spin h-6 w-6 text-foreground" />
      <span className="mt-2 text-base text-foreground">Submitting...</span>
    </div>
  )
}
