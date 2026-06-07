"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  chartTitle?: string;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, error: err.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center p-4">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-sm font-medium text-gray-500">Could not render chart</p>
          <p className="text-xs text-gray-400 font-mono max-w-[200px] truncate">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
