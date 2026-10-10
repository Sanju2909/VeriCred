import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export function Alert({ type = "info", title, message, details, onClose }) {
  const icons = {
    success: <CheckCircle2 size={18} style={{ color: "var(--success)", flexShrink: 0 }} />,
    warning: <AlertTriangle size={18} style={{ color: "var(--warning)", flexShrink: 0 }} />,
    danger: <XCircle size={18} style={{ color: "var(--danger)", flexShrink: 0 }} />,
    error: <XCircle size={18} style={{ color: "var(--danger)", flexShrink: 0 }} />,
    info: <Info size={18} style={{ color: "var(--info)", flexShrink: 0 }} />,
  };

  const alertClass = type === "error" ? "alert alert-danger" : `alert alert-${type}`;

  return (
    <div className={alertClass}>
      {icons[type] || icons.info}
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: "2px" }}>{title}</div>}
        <div>{message}</div>
        {details && Array.isArray(details) && details.length > 0 && (
          <ul style={{ marginTop: "6px", paddingLeft: "18px", fontSize: "0.825rem" }}>
            {details.map((d, i) => (
              <li key={i}>{typeof d === "object" ? `${d.field ? d.field + ": " : ""}${d.message}` : d}</li>
            ))}
          </ul>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.7, padding: "2px" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default Alert;
