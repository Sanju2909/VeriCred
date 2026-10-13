import React from "react";
import { CheckCircle2, XCircle, AlertCircle, Clock, ShieldCheck, UserCheck, ShieldAlert } from "lucide-react";

export function StatusBadge({ status, type = "status" }) {
  if (!status) return null;

  const normalized = status.toUpperCase();

  // Role badges
  if (type === "role") {
    const roleStyles = {
      ADMIN: { class: "badge badge-danger", icon: <ShieldAlert size={12} />, label: "Platform Admin" },
      ISSUER: { class: "badge badge-info", icon: <ShieldCheck size={12} />, label: "Academic Issuer" },
      HOLDER: { class: "badge badge-success", icon: <UserCheck size={12} />, label: "Student / Holder" },
      VERIFIER: { class: "badge badge-warning", icon: <ShieldCheck size={12} />, label: "Verifier / Employer" },
    };
    const style = roleStyles[normalized] || { class: "badge badge-info", icon: null, label: status };
    return (
      <span className={style.class}>
        {style.icon}
        {style.label}
      </span>
    );
  }

  // Status badges
  if (normalized === "VALID" || normalized === "ISSUED" || normalized === "ACTIVE" || normalized === "SUCCESS") {
    return (
      <span className="badge badge-success">
        <CheckCircle2 size={12} />
        {normalized === "ISSUED" ? "Active / Issued" : status}
      </span>
    );
  }

  if (normalized === "REVOKED" || normalized === "CREDENTIAL_REVOKED" || normalized === "INVALID" || normalized === "FAILURE") {
    return (
      <span className="badge badge-danger">
        <XCircle size={12} />
        {normalized === "CREDENTIAL_REVOKED" ? "Revoked" : status}
      </span>
    );
  }

  if (normalized === "EXPIRED" || normalized === "CREDENTIAL_EXPIRED") {
    return (
      <span className="badge badge-expired">
        <Clock size={12} />
        Expired
      </span>
    );
  }

  if (normalized === "ISSUER_SUSPENDED") {
    return (
      <span className="badge badge-danger">
        <AlertCircle size={12} />
        Issuer Suspended
      </span>
    );
  }

  if (normalized === "PENDING" || normalized === "DEGRADED") {
    return (
      <span className="badge badge-warning">
        <AlertCircle size={12} />
        {status}
      </span>
    );
  }

  return (
    <span className="badge badge-info">
      {status}
    </span>
  );
}

export default StatusBadge;

