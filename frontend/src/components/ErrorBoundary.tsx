import { Component, ErrorInfo, ReactNode } from "react";

/** Last line of defence: if a screen ever crashes, show what happened and a
 *  way back, instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center bg-flour p-6">
        <div className="max-w-md w-full bg-surface border border-hairline rounded-2xl p-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">Something went wrong on this screen</h1>
          <p className="text-sm text-muted mt-2">Nothing was lost. Reload to carry on. If it keeps happening, note what you clicked and the message below.</p>
          <p className="mt-4 text-xs font-mono text-muted bg-flour rounded-lg px-3 py-2 break-words">{this.state.error.message}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => window.location.reload()} className="h-11 px-5 rounded-xl bg-plum text-cream text-sm font-bold">Reload</button>
            <button onClick={() => { this.setState({ error: null }); window.history.back(); }} className="h-11 px-5 rounded-xl border border-hairline text-sm font-semibold text-ink">Go back</button>
          </div>
        </div>
      </div>
    );
  }
}
