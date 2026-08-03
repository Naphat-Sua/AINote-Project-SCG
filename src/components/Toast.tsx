import { useEffect } from 'react'

interface ToastProps {
  message: string
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
  /** Auto-dismiss delay. Long enough to react to an accidental delete. */
  durationMs?: number
}

export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 9000,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(timer)
  }, [onDismiss, durationMs, message])

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-message">{message}</span>
      {actionLabel && onAction && (
        <button className="toast-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      <button className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss notification">
        ✕
      </button>
    </div>
  )
}
