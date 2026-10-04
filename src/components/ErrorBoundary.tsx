import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from './ui'

/**
 * Catches an unexpected error in a page so one broken screen shows a message and a way back instead of a blank window.
 * Pass a different `resetKey` (the page address) so moving to another page clears the error.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Screen error:', error, info.componentStack) }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-muted">The rest of the dashboard still works. Try again, or go back to the dashboard. If it keeps happening, tell your platform owner what you were doing.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => this.setState({ failed: false })}>Try again</Button>
          <a href="/"><Button variant="ghost">Go to the dashboard</Button></a>
        </div>
      </Card>
    )
  }
}
