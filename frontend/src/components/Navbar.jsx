import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Shield, CheckCircle2, User, LogOut, Menu, X, LayoutDashboard, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "./StatusBadge";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getDashboardPath = () => {
    if (!user) return "/login";
    switch (user.role) {
      case "ADMIN":
        return "/admin";
      case "ISSUER":
        return "/issuer";
      case "HOLDER":
        return "/student";
      case "VERIFIER":
        return "/verify";
      default:
        return "/";
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header style={{ backgroundColor: "white", borderBottom: "1px solid var(--slate-200)", position: "sticky", top: 0, zIndex: 100 }}>
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "70px" }}>
        {/* Brand Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--navy-900)", textDecoration: "none" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <Shield size={22} />
          </div>
          <div>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--navy-900)" }}>VeriCred</span>
            <span style={{ fontSize: "0.675rem", display: "block", color: "var(--slate-500)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "-3px" }}>Decentralized Identity</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav style={{ display: "flex", alignItems: "center", gap: "24px" }} className="desktop-nav">
          <Link
            to="/"
            style={{
              fontWeight: 600,
              fontSize: "0.925rem",
              color: isActive("/") ? "var(--primary)" : "var(--slate-600)",
              textDecoration: "none",
            }}
          >
            Home
          </Link>
          <Link
            to="/verify"
            style={{
              fontWeight: 600,
              fontSize: "0.925rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: isActive("/verify") ? "var(--primary)" : "var(--slate-600)",
              textDecoration: "none",
            }}
          >
            <Search size={16} />
            Verify Portal
          </Link>

          {isAuthenticated && user && (
            <Link
              to={getDashboardPath()}
              style={{
                fontWeight: 600,
                fontSize: "0.925rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: location.pathname.startsWith("/admin") || location.pathname.startsWith("/issuer") || location.pathname.startsWith("/student") ? "var(--primary)" : "var(--slate-600)",
                textDecoration: "none",
              }}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
          )}
        </nav>

        {/* Right Auth / Action Panel */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {isAuthenticated && user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--navy-900)" }}>{user.name}</div>
                <StatusBadge status={user.role} type="role" />
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                title="Log out of account"
              >
                <LogOut size={15} />
                <span className="logout-text">Logout</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Link to="/login" className="btn btn-secondary btn-sm">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
