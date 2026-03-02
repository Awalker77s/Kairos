import { useEffect } from 'react'

type ToastProps = {
  message: string
  durationMs?: number
  onDismiss: () => void
}

export function Toast({ message, durationMs = 2000, onDismiss }: ToastProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss()
    }, durationMs)

    return () => window.clearTimeout(timeoutId)
  }, [durationMs, onDismiss])

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-lg border border-white/20 bg-charcoal px-4 py-3 text-sm text-off-white shadow-xl shadow-black/40">
      {message}
    </div>
  )
}
