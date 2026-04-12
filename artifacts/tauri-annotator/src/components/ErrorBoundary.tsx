import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div
          className="w-full max-w-[400px] rounded-2xl px-6 py-8 text-center glass-panel"
          style={{
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.07), 0 24px 64px rgba(0,0,0,0.75)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            Something went wrong
          </p>
          <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
            {this.state.message}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="text-xs"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
