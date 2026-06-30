'use client'

interface LoadingOverlayProps {
  show: boolean
}

export default function LoadingOverlay({ show }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm"
      aria-hidden="true"
    >
      <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="mt-3 text-xs text-muted-foreground">Working on it...</span>
    </div>
  )
}
