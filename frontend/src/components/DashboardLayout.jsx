import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Sidebar from "./Sidebar";

export function DashboardLayout({ children, title, subtitle, actions }) {
  return (
    <div className="app-container">
      <Navbar />
      <div className="dashboard-shell">
        <Sidebar />
        <main className="dashboard-main">
          <div className="container" style={{ maxWidth: "100%", padding: 0 }}>
            {(title || actions) && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
                <div>
                  {title && <h1 style={{ fontSize: "1.75rem", color: "var(--navy-900)", marginBottom: "4px" }}>{title}</h1>}
                  {subtitle && <p style={{ color: "var(--slate-500)", fontSize: "0.925rem" }}>{subtitle}</p>}
                </div>
                {actions && <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>{actions}</div>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default DashboardLayout;

