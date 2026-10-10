import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export function NotFound() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 24px" }}>
        <div style={{ textAlign: "center", maxWidth: "480px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", backgroundColor: "var(--danger-bg)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
            <ShieldAlert size={28} />
          </div>
          <h1 style={{ fontSize: "2rem", marginBottom: "8px", color: "var(--navy-900)" }}>404 - Page Not Found</h1>
          <p style={{ color: "var(--slate-500)", marginBottom: "28px", fontSize: "0.95rem" }}>
            The requested resource or dashboard route does not exist on the decentralized credential platform.
          </p>
          <Link to="/" className="btn btn-primary">
            <ArrowLeft size={16} /> Return to Homepage
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default NotFound;
