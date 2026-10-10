import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, XCircle, AlertTriangle, CheckCircle2, Search, FileCode, Clock, Cpu, Lock, UserCheck, ShieldAlert, ArrowRight } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Alert from "../components/Alert";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";

export function VerifyPortal() {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get("id") || "";

  const [inputMode, setInputMode] = useState(initialId ? "id" : "json");
  const [credentialId, setCredentialId] = useState(initialId);
  const [jsonInput, setJsonInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState(null);

  const sampleJsonPlaceholder = `{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.org"
  ],
  "id": "urn:uuid:...",
  "type": ["VerifiableCredential", "AcademicDegreeCredential"],
  "issuer": {
    "id": "did:ethr:0x...",
    "name": "University Name",
    "ethereumAddress": "0x..."
  },
  "credentialSubject": {
    "name": "Student Name",
    "degree": "B.Sc. Computer Science"
  },
  "proof": {
    "type": "EcdsaSecp256k1Signature2019",
    "proofValue": "0x..."
  }
}`;

  const executeVerification = async (payload) => {
    setIsVerifying(true);
    setError(null);
    setVerificationResult(null);

    try {
      const res = await api.verifyCredential(payload);
      if (res.success) {
        setVerificationResult(res.data);
      } else {
        setError(res.error?.message || "Verification request failed");
      }
    } catch (err) {
      setError(err.message || "Failed to execute cryptographic verification");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyById = (e) => {
    e.preventDefault();
    if (!credentialId.trim()) {
      setError("Please enter a valid Credential ID or hash");
      return;
    }
    executeVerification(credentialId.trim());
  };

  const handleVerifyByJson = (e) => {
    e.preventDefault();
    if (!jsonInput.trim()) {
      setError("Please paste a Verifiable Credential JSON payload");
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      executeVerification(parsed);
    } catch (parseErr) {
      setError("Invalid JSON format. Please ensure the pasted payload is valid JSON.");
    }
  };

  useEffect(() => {
    if (initialId) {
      executeVerification(initialId);
    }
  }, [initialId]);

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content" style={{ padding: "48px 0", backgroundColor: "var(--slate-50)" }}>
        <div className="container" style={{ maxWidth: "860px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px auto" }}>
              <ShieldCheck size={26} />
            </div>
            <h1 style={{ fontSize: "2rem", color: "var(--navy-900)", marginBottom: "8px" }}>
              Universal Credential Verification Portal
            </h1>
            <p style={{ color: "var(--slate-500)", fontSize: "0.95rem", maxWidth: "600px", margin: "0 auto" }}>
              Verify cryptographic signature integrity, issuer accreditation on Ethereum smart contracts, and real-time revocation status.
            </p>
          </div>

          {/* Mode Tabs */}
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "24px" }}>
            <button
              className={`btn btn-sm ${inputMode === "id" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { setInputMode("id"); setError(null); }}
            >
              <Search size={15} /> Verify by Credential ID
            </button>
            <button
              className={`btn btn-sm ${inputMode === "json" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { setInputMode("json"); setError(null); }}
            >
              <FileCode size={15} /> Verify by Raw JSON Payload
            </button>
          </div>

          {/* Entry Card */}
          <div className="card" style={{ marginBottom: "32px" }}>
            {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}

            {inputMode === "id" ? (
              <form onSubmit={handleVerifyById}>
                <div className="form-group">
                  <label className="form-label" htmlFor="credIdInput">Credential ID or Fingerprint</label>
                  <input
                    id="credIdInput"
                    type="text"
                    className="form-input font-mono text-sm"
                    placeholder="e.g. urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    required
                  />
                  <div className="form-helper">Enter the unique identifier or URI embedded in the verifiable credential.</div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                  disabled={isVerifying}
                >
                  {isVerifying ? "Verifying with Blockchain..." : "Run Cryptographic & Blockchain Verification"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyByJson}>
                <div className="form-group">
                  <label className="form-label" htmlFor="jsonArea">Verifiable Credential JSON Document</label>
                  <textarea
                    id="jsonArea"
                    className="form-textarea font-mono text-xs"
                    rows={8}
                    placeholder={sampleJsonPlaceholder}
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    required
                  />
                  <div className="form-helper">Paste the complete signed W3C Verifiable Credential object including proof block.</div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                  disabled={isVerifying}
                >
                  {isVerifying ? "Verifying Signature & Hashes..." : "Verify Credential Integrity"}
                </button>
              </form>
            )}
          </div>

          {/* Verification Result Card */}
          {isVerifying && <LoadingSpinner text="Executing multi-tier verification checks..." />}

          {verificationResult && (
            <div className="card" style={{ borderTop: `4px solid ${verificationResult.isValid ? "var(--success)" : "var(--danger)"}` }}>
              {/* Verdict Banner */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingBottom: "20px", marginBottom: "20px", borderBottom: "1px solid var(--slate-100)" }}>
                <div style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  backgroundColor: verificationResult.isValid ? "var(--success-bg)" : "var(--danger-bg)",
                  color: verificationResult.isValid ? "var(--success)" : "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {verificationResult.isValid ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                </div>
                <div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: verificationResult.isValid ? "var(--success-text)" : "var(--danger-text)" }}>
                    {verificationResult.isValid ? "Credential is Authentic & Valid" : "Verification Failed"}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--slate-600)" }}>
                    {verificationResult.message}
                  </div>
                </div>
              </div>

              {/* Multi-tier Check List */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "1rem", color: "var(--navy-900)", marginBottom: "12px" }}>Cryptographic & On-Chain Audit Breakdown</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--slate-50)", borderRadius: "var(--radius-md)", border: "1px solid var(--slate-200)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Lock size={16} style={{ color: "var(--primary)" }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>ECDSA secp256k1 Signature Integrity</span>
                    </div>
                    {verificationResult.checks?.signatureValid ? (
                      <span className="badge badge-success"><CheckCircle2 size={12} /> Valid Signature</span>
                    ) : (
                      <span className="badge badge-danger"><XCircle size={12} /> Invalid / Corrupt</span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--slate-50)", borderRadius: "var(--radius-md)", border: "1px solid var(--slate-200)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Cpu size={16} style={{ color: "var(--primary)" }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Payload Canonical Hash Match (RFC 8785)</span>
                    </div>
                    {verificationResult.checks?.hashMatchesFingerprint ? (
                      <span className="badge badge-success"><CheckCircle2 size={12} /> Tamper-Proof Match</span>
                    ) : (
                      <span className="badge badge-danger"><XCircle size={12} /> Mismatch</span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--slate-50)", borderRadius: "var(--radius-md)", border: "1px solid var(--slate-200)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <UserCheck size={16} style={{ color: "var(--primary)" }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Issuer On-Chain Accreditation</span>
                    </div>
                    {verificationResult.checks?.issuerAuthorized ? (
                      <span className="badge badge-success"><CheckCircle2 size={12} /> Approved Issuer</span>
                    ) : (
                      <span className="badge badge-danger"><ShieldAlert size={12} /> Suspended / Unapproved</span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--slate-50)", borderRadius: "var(--radius-md)", border: "1px solid var(--slate-200)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Clock size={16} style={{ color: "var(--primary)" }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Revocation & Expiration Check</span>
                    </div>
                    {verificationResult.checks?.notRevoked && verificationResult.checks?.notExpired ? (
                      <span className="badge badge-success"><CheckCircle2 size={12} /> Active & Unrevoked</span>
                    ) : !verificationResult.checks?.notRevoked ? (
                      <span className="badge badge-danger"><XCircle size={12} /> Revoked</span>
                    ) : (
                      <span className="badge badge-expired"><Clock size={12} /> Expired</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata Details */}
              <div style={{ backgroundColor: "var(--slate-50)", padding: "16px", borderRadius: "var(--radius-md)", fontSize: "0.825rem", border: "1px solid var(--slate-200)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <span className="text-muted">Verified Timestamp: </span>
                    <strong>{new Date(verificationResult.verifiedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Smart Contract Status: </span>
                    <StatusBadge status={verificationResult.status} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default VerifyPortal;
