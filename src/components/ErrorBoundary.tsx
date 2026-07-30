import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message?: string };

/** Catches render crashes so the app does not white-screen in production. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TOUPRE ErrorBoundary]', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-14 h-14 object-contain" />
          <h1 className="text-lg font-bold text-slate-900">Yon erè rive</h1>
          <p className="text-sm text-slate-500 max-w-sm">
            Gen yon pwoblèm tanporè. Rafrechi paj la epi eseye ankò.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:scale-95 transition"
          >
            Rafrechi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
