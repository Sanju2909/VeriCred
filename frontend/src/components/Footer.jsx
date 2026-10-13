import React from "react";
import { ShieldCheck, Cpu, Database, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer style={{ backgroundColor: "white", borderTop: "1px solid var(--slate-200)", padding: "36px 0 24px 0", marginTop: "auto" }}>
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "24px", marginBottom: "24px" }}>
          <div style={{ maxWidth: "420px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--navy-900)", marginBottom: "8px" }}>
              <ShieldCheck size={20} style={{ color: "var(--primary)" }} />
              <span>VeriCred Platform</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--slate-500)", lineHeight: 1.6 }}>
              Decentralized Digital Identity and Verifiable Credentials Platform using Ethereum Smart Contracts, W3C standards, and ECDSA cryptography. Built for academic credential verification.
            </p>
          </div>

          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--navy-900)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Architecture</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.825rem", color: "var(--slate-600)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Cpu size={14} /> EVM Smart Contracts (Hardhat / Solidity 0.8.24)</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Lock size={14} /> ECDSA secp256k1 & RFC 8785 Canonicalization</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Database size={14} /> Off-chain MongoDB Atlas Privacy Storage</div>
            </div>
          </div>
        </div>

        <div style={{ paddingTop: "18px", borderTop: "1px solid var(--slate-100)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", fontSize: "0.775rem", color: "var(--slate-400)" }}>
          <div>© 2026 Decentralized Credential Platform. Academic Capstone Project.</div>
          <div style={{ display: "flex", gap: "16px" }}>
            <span>EVM ChainId: 31337</span>
            <span>W3C VC v1.1 Compatible</span>
            <span>Zero PII on-chain</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

