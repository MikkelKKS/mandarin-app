/**
 * Catches a crash in any screen so the app shows what went wrong (and a way
 * back) instead of an empty page. Resets when the route changes.
 */
import { Component, type ReactNode } from 'react';
import { go } from '../lib/router';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.reset);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.reset);
  }

  reset = () => {
    if (this.state.error) this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 py-10">
        <p className="han text-5xl text-cinnabar" lang="zh-CN">
          哎呀
        </p>
        <h1 className="text-xl font-semibold">This screen stopped working</h1>
        <p className="text-muted">Your progress is safe. Go back and try again. If it keeps happening, send a screenshot of the line below.</p>
        <p className="break-words rounded-xl bg-sunk p-3 font-mono text-xs text-muted">{String(error.message || error).slice(0, 300)}</p>
        <button
          onClick={() => {
            this.setState({ error: null });
            go('');
          }}
          className="h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink"
        >
          Back to the path
        </button>
        <button onClick={() => location.reload()} className="h-12 rounded-2xl border border-line font-medium">
          Reload the app
        </button>
      </div>
    );
  }
}
