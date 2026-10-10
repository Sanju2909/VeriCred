import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingSpinner({ size = 24, text = "Loading...", fullScreen = false }) {
  const content = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px" }}>
      <Loader2 size={size} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
      {text && <span style={{ fontSize: "0.875rem", color: "var(--slate-500)", fontWeight: 500 }}>{text}</span>}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--slate-50)" }}>
        {content}
      </div>
    );
  }

  return content;
}

export default LoadingSpinner;
