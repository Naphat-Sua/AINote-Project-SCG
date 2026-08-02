import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time crashes so a single bad note or malformed content
 * cannot white-screen the app. Notes are already persisted in localStorage,
 * so reloading recovers the session.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AINote crashed while rendering:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="crash-screen" role="alert">
        <p className="crash-icon" aria-hidden="true">😵</p>
        <h1>Something broke</h1>
        <p>
          The app hit an unexpected error while rendering. Your notes are saved in this
          browser and were not affected.
        </p>
        <pre className="crash-detail">{error.message}</pre>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload AINote
        </button>
      </div>
    )
  }
}
