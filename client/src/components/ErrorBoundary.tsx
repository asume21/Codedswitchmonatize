import { Component, ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  /** React's component stack — names the component that actually threw. */
  componentStack?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ componentStack: errorInfo?.componentStack ?? undefined });
  }

  render() {
    if (this.state.hasError) {
      // In DEV, say WHAT broke. The app-level fallback in App.tsx renders a
      // styled "System Fault / A component crashed" card with no error text and
      // no component name, so a crash gave nothing to act on — the message was
      // only in the console, which meant asking the user to go find it.
      // Shown as a fixed banner so it cannot be hidden by a full-screen
      // fallback, and only in DEV so users never see a stack trace.
      const devDetails = import.meta.env.DEV && this.state.error ? (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
            maxHeight: '45vh', overflow: 'auto',
            background: '#2b0b0b', color: '#ffd7d7',
            borderBottom: '2px solid #ff5f5f',
            font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
            padding: '10px 14px', whiteSpace: 'pre-wrap',
          }}
        >
          <strong style={{ color: '#ff9f9f' }}>
            {this.state.error.name}: {this.state.error.message}
          </strong>
          {this.state.componentStack ? (
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              {this.state.componentStack.trim().split(String.fromCharCode(10)).slice(0, 8).join(String.fromCharCode(10))}
            </div>
          ) : null}
        </div>
      ) : null;

      return (
        <>
        {devDetails}
        {this.props.fallback || (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center max-w-md">
              <div className="text-red-500 text-5xl mb-4">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
              <p className="text-gray-400 mb-4">
                This component encountered an error. Try refreshing the page or switching to another tab.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )}
        </>
      );
    }

    return this.props.children;
  }
}
