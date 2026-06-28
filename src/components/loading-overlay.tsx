'use client'

interface LoadingOverlayProps {
  show: boolean
}

export default function LoadingOverlay({ show }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-sm bg-background/88 backdrop-blur-sm"
      aria-hidden="true"
    >
      {/* CSS amber spinner — no external icon dependency */}
      <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="mt-3 text-xs text-muted-foreground tracking-widest uppercase">
        Working on it...
      </span>
    </div>
  )
}
