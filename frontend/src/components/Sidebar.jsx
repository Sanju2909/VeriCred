import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, Award, Wallet, ShieldCheck, Activity, Search, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "./StatusBadge";

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="dashboard-sidebar">
      <div style={{ padding: "0 8px 16px 8px", marginBottom: "8px", borderBottom: "1px solid var(--slate-100)" }}>
        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--slate-400)", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "6px" }}>
          Active Workspace
        </div>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--navy-900)" }}>{user.name}</div>
        <div style={{ marginTop: "4px" }}>
          <StatusBadge status={user.role} type="role" />
        </div>
      </div>

      {user.role === "ADMIN" && (
        <>
          <Link to="/admin" className={`nav-link-item ${isActive("/admin") ? "active" : ""}`}>
            <Users size={18} />
            User & Issuer Governance
          </Link>
          <Link to="/verify" className={`nav-link-item ${isActive("/verify") ? "active" : ""}`}>
            <Search size={18} />
            Verification Portal
          </Link>
        </>
      )}

      {user.role === "ISSUER" && (
        <>
          <Link to="/issuer" className={`nav-link-item ${isActive("/issuer") ? "active" : ""}`}>
            <Award size={18} />
            Issue Credentials
          </Link>
          <Link to="/verify" className={`nav-link-item ${isActive("/verify") ? "active" : ""}`}>
            <Search size={18} />
            Verification Portal
          </Link>
        </>
      )}

      {user.role === "HOLDER" && (
        <>
          <Link to="/student" className={`nav-link-item ${isActive("/student") ? "active" : ""}`}>
            <Wallet size={18} />
            My Credential Vault
          </Link>
          <Link to="/verify" className={`nav-link-item ${isActive("/verify") ? "active" : ""}`}>
            <Search size={18} />
            Verify Portal
          </Link>
        </>
      )}

      {user.role === "VERIFIER" && (
        <>
          <Link to="/verify" className={`nav-link-item ${isActive("/verify") ? "active" : ""}`}>
            <ShieldCheck size={18} />
            Verification Engine
          </Link>
        </>
      )}

      <div style={{ marginTop: "auto", padding: "16px 8px 0 8px", borderTop: "1px solid var(--slate-100)" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--slate-400)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Activity size={12} style={{ color: "var(--success)" }} />
          <span>Local EVM Connected</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

