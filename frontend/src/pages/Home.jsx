import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Award, Lock, FileCheck, ArrowRight, Database, Search, CheckCircle2, UserCheck } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export function Home() {
  const [credentialQuery, setCredentialQuery] = useState("");
  const navigate = useNavigate();

  const handleQuickVerify = (e) => {
    e.preventDefault();
    if (credentialQuery.trim()) {
      navigate(`/verify?id=${encodeURIComponent(credentialQuery.trim())}`);
    }
  };

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        {/* Hero Section */}
        <section style={{ backgroundColor: "var(--navy-900)", color: "white", padding: "72px 0 84px 0", position: "relative" }}>
          <div className="container" style={{ maxWidth: "1000px", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "rgba(37, 99, 235, 0.2)", border: "1px solid rgba(59, 130, 246, 0.4)", padding: "6px 14px", borderRadius: "9999px", fontSize: "0.825rem", color: "#93c5fd", fontWeight: 600, marginBottom: "20px" }}>
              <ShieldCheck size={16} />
              <span>Decentralized Academic Identity Platform</span>
            </div>

            <h1 style={{ fontSize: "2.75rem", fontWeight: 800, lineHeight: 1.2, color: "white", marginBottom: "18px", letterSpacing: "-0.02em" }}>
              Trustless Digital Identity & <span style={{ color: "#60a5fa" }}>Verifiable Credentials</span>
            </h1>

            <p style={{ fontSize: "1.125rem", color: "var(--slate-300)", maxWidth: "760px", margin: "0 auto 36px auto", lineHeight: 1.6 }}>
              Eliminating credential fraud with W3C-compliant digital signatures, decentralized identifiers (DIDs), and Ethereum smart contract trust registries.
            </p>

            {/* Quick Verification Search Box */}
            <div style={{ maxWidth: "620px", margin: "0 auto 28px auto", backgroundColor: "white", borderRadius: "12px", padding: "6px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)" }}>
              <form onSubmit={handleQuickVerify} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ paddingLeft: "14px", color: "var(--slate-400)" }}>
                  <Search size={20} />
                </div>
                <input
                  type="text"
                  placeholder="Enter Credential ID or Hash (e.g. urn:uuid:...)"
                  value={credentialQuery}
                  onChange={(e) => setCredentialQuery(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", padding: "10px 8px", fontSize: "0.95rem", color: "var(--navy-900)", fontFamily: "var(--font-sans)" }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: "10px 20px", borderRadius: "8px" }}>
                  Verify Now
                </button>
              </form>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
              <Link to="/verify" className="btn btn-secondary" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", color: "white", borderColor: "rgba(255, 255, 255, 0.2)" }}>
                Open Verification Portal
              </Link>
              <Link to="/register" className="btn btn-primary">
                Create Account <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* System Pillars */}
        <section style={{ padding: "64px 0", backgroundColor: "var(--slate-50)" }}>
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <h2 style={{ fontSize: "1.85rem", marginBottom: "8px" }}>Decentralized Trust Architecture</h2>
              <p style={{ color: "var(--slate-500)", maxWidth: "600px", margin: "0 auto" }}>
                Four pillars working synchronously to guarantee authenticity, privacy, and instant verification.
              </p>
            </div>

            <div className="grid-4">
              <div className="card">
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <Award size={22} />
                </div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>W3C Verifiable Credentials</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--slate-500)", lineHeight: 1.6 }}>
                  Tamper-evident credential payloads with cryptographic proofs, canonicalized using RFC 8785 for consistent cross-platform validation.
                </p>
              </div>

              <div className="card">
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#ecfdf5", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <Lock size={22} />
                </div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>ECDSA Cryptography</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--slate-500)", lineHeight: 1.6 }}>
                  Asymmetric digital signing on curve secp256k1 binding credential payloads directly to the official Ethereum identity of the issuing university.
                </p>
              </div>

              <div className="card">
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#f0f9ff", color: "var(--info)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <ShieldCheck size={22} />
                </div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Smart Contract Registry</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--slate-500)", lineHeight: 1.6 }}>
                  Solidity smart contracts on EVM managing authorized issuer registries, credential fingerprints, expiration, and real-time revocation.
                </p>
              </div>

              <div className="card">
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#fffbeb", color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <Database size={22} />
                </div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Off-Chain Privacy</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--slate-500)", lineHeight: 1.6 }}>
                  Student Personally Identifiable Information (PII) is stored off-chain in encrypted storage. Only cryptographic integrity hashes are anchored on-chain.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stakeholder Roles Breakdown */}
        <section style={{ padding: "64px 0", backgroundColor: "white", borderTop: "1px solid var(--slate-200)" }}>
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <h2 style={{ fontSize: "1.85rem", marginBottom: "8px" }}>Platform Portals by Role</h2>
              <p style={{ color: "var(--slate-500)" }}>Explore dedicated dashboards designed for academic institutions, students, and employers.</p>
            </div>

            <div className="grid-3">
              <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <Award size={20} style={{ color: "var(--primary)" }} />
                  <h3 style={{ fontSize: "1.15rem" }}>Academic Issuers</h3>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-600)", lineHeight: 1.6, flex: 1, marginBottom: "16px" }}>
                  Accredited universities and institutes issue digitally signed certificates, anchor integrity hashes onto the blockchain, and manage lifecycle/revocations.
                </p>
                <Link to="/issuer" className="btn btn-secondary btn-sm" style={{ width: "100%" }}>
                  Issuer Workspace
                </Link>
              </div>

              <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <UserCheck size={20} style={{ color: "var(--success)" }} />
                  <h3 style={{ fontSize: "1.15rem" }}>Students & Graduates</h3>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-600)", lineHeight: 1.6, flex: 1, marginBottom: "16px" }}>
                  Students maintain custody of their educational records in a secure personal wallet, export verifiable JSON presentations, and share credentials via QR codes.
                </p>
                <Link to="/student" className="btn btn-secondary btn-sm" style={{ width: "100%" }}>
                  Student Vault
                </Link>
              </div>

              <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <FileCheck size={20} style={{ color: "var(--info)" }} />
                  <h3 style={{ fontSize: "1.15rem" }}>Verifiers & Employers</h3>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-600)", lineHeight: 1.6, flex: 1, marginBottom: "16px" }}>
                  Employers and third-party institutions verify digital signatures, check issuer accreditation on-chain, and check revocation/expiry in seconds.
                </p>
                <Link to="/verify" className="btn btn-primary btn-sm" style={{ width: "100%" }}>
                  Verification Portal
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default Home;
