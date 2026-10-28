import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Which part of the app this guards, shown in the fallback. */
  name: string;
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Resets the boundary when any of these change. */
  resetKeys?: unknown[];
}

interface State {
  error: Error | null;
}

/** Contains a failure to the panel it happened in. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKeys?.some((k, i) => k !== this.props.resetKeys?.[i])) this.reset();
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="error-fallback" role="alert">
        <TriangleAlert size={18} />
        <span>
          {this.props.name} stopped working
          <small>{error.message}</small>
        </span>
        <button className="icon-btn" onClick={this.reset} aria-label="Retry" title="Retry">
          <RotateCcw size={16} />
        </button>
      </div>
    );
  }
}
