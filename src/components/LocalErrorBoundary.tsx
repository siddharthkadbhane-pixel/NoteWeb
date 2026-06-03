import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LocalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("LocalErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0C] text-white p-6">
          <div className="max-w-md w-full bg-[#16161D] border border-rose-500/20 p-8 rounded-3xl text-center shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6 text-rose-500">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">{this.props.fallbackTitle || "Feature Render Crash"}</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              An unexpected layout rendering error was captured by the NoteWeb self-healing guard:
            </p>
            <pre className="p-4 bg-[#050508] rounded-xl text-rose-400 text-[10px] font-mono text-left overflow-x-auto border border-white/[0.05] max-h-48 scrollbar-thin">
              {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full mt-6 py-3 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
            >
              Reload NoteWeb
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
