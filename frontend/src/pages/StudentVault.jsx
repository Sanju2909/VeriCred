import React, { useState, useEffect } from "react";
import { Wallet, Award, QrCode, Download, Eye, ExternalLink, RefreshCw, CheckCircle2, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import DashboardLayout from "../components/DashboardLayout";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";
import Modal from "../components/Modal";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";

export function StudentVault() {
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // QR Modal
  const [qrCredential, setQrCredential] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // JSON / Details Modal
  const [inspectCredential, setInspectCredential] = useState(null);

  const fetchMyCredentials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getCredentials();
      if (res.success) {
        setCredentials(res.data.credentials || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load credentials");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyCredentials();
  }, []);

  const handleDownloadJson = (cred) => {
    const payload = {
      "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org"],
      id: cred.credentialId,
      type: cred.credentialType,
      issuer: {
        id: cred.issuerDid,
        ethereumAddress: cred.issuerAddress,
      },
      issuanceDate: cred.issuanceDate,
      expirationDate: cred.expirationDate,
      credentialSubject: cred.claims,
      proof: cred.proof,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${cred.title.replace(/\s+/g, "_")}_credential.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getVerificationUrl = (credentialId) => {
    return `${window.location.origin}/verify?id=${encodeURIComponent(credentialId)}`;
  };

  const handleCopyLink = (credentialId) => {
    const url = getVerificationUrl(credentialId);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <DashboardLayout
      title="Student Credential Vault"
      subtitle="Self-sovereign digital wallet for your academic degrees, certificates, and verifiable credentials"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={fetchMyCredentials} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      }
    >
      {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}

      {isLoading ? (
        <LoadingSpinner text="Accessing your cryptographic vault..." />
      ) : credentials.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", backgroundColor: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
            <Wallet size={28} />
          </div>
          <h2 style={{ fontSize: "1.35rem", marginBottom: "8px" }}>No Credentials in Your Vault</h2>
          <p style={{ color: "var(--slate-500)", maxWidth: "480px", margin: "0 auto 24px auto", fontSize: "0.9rem" }}>
            When an authorized academic institution issues a degree or certificate linked to your identity or email, it will appear here instantly.
          </p>
          <a href="/verify" className="btn btn-secondary btn-sm">
            Go to Verification Portal
          </a>
        </div>
      ) : (
        <div className="grid-2" style={{ alignItems: "stretch" }}>
          {credentials.map((cred) => (
            <div key={cred._id || cred.credentialId} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Award size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "1.15rem", color: "var(--navy-900)" }}>{cred.title}</h3>
                      <div style={{ fontSize: "0.8rem", color: "var(--slate-500)" }}>Issued to: {cred.holderName}</div>
                    </div>
                  </div>
                  <StatusBadge status={cred.status} />
                </div>

                <div style={{ backgroundColor: "var(--slate-50)", padding: "14px", borderRadius: "var(--radius-md)", marginBottom: "16px", border: "1px solid var(--slate-200)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.825rem" }}>
                    <div>
                      <span className="text-muted">Issued Date: </span>
                      <strong>{new Date(cred.issuanceDate).toLocaleDateString()}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Expiration: </span>
                      <strong>{cred.expirationDate ? new Date(cred.expirationDate).toLocaleDateString() : "Lifetime (Never)"}</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "0.775rem" }} className="font-mono text-muted">
                    ID: {cred.credentialId}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "12px", borderTop: "1px solid var(--slate-100)" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQrCredential(cred)}
                  title="Generate shareable QR code"
                >
                  <QrCode size={14} /> Share QR
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownloadJson(cred)}
                  title="Download verifiable JSON document"
                >
                  <Download size={14} /> Export JSON
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setInspectCredential(cred)}
                  title="View cryptographic details"
                >
                  <Eye size={14} /> Inspect
                </button>

                <a
                  href={`/verify?id=${encodeURIComponent(cred.credentialId)}`}
                  className="btn btn-primary btn-sm"
                  style={{ marginLeft: "auto" }}
                  target="_blank"
                  rel="noreferrer"
                >
                  Verify <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share QR Modal */}
      <Modal
        isOpen={!!qrCredential}
        onClose={() => setQrCredential(null)}
        title="Share Verifiable Credential QR"
        maxWidth="460px"
      >
        {qrCredential && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", marginBottom: "20px" }}>
              Employers or verifiers can scan this QR code to instantly verify authenticity, cryptographic signature, and on-chain validity.
            </p>

            <div style={{ display: "inline-block", padding: "16px", backgroundColor: "white", borderRadius: "12px", border: "1px solid var(--slate-200)", boxShadow: "var(--shadow-sm)", marginBottom: "20px" }}>
              <QRCodeSVG
                value={getVerificationUrl(qrCredential.credentialId)}
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>

            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "4px" }}>{qrCredential.title}</div>
            <div style={{ fontSize: "0.825rem", color: "var(--slate-500)", marginBottom: "18px" }}>{qrCredential.holderName}</div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopyLink(qrCredential.credentialId)}
              >
                {copiedLink ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} /> : <Copy size={14} />}
                {copiedLink ? "Link Copied!" : "Copy Verification URL"}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setQrCredential(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Inspect Credential Modal */}
      <Modal
        isOpen={!!inspectCredential}
        onClose={() => setInspectCredential(null)}
        title="Verifiable Credential Claims & Proof"
        maxWidth="640px"
      >
        {inspectCredential && (
          <div>
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "0.9rem", textTransform: "uppercase", color: "var(--slate-400)", marginBottom: "8px" }}>Subject Claims</h4>
              <pre className="font-mono text-xs" style={{ backgroundColor: "var(--slate-100)", padding: "12px", borderRadius: "var(--radius-md)", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(inspectCredential.claims, null, 2)}
              </pre>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "0.9rem", textTransform: "uppercase", color: "var(--slate-400)", marginBottom: "8px" }}>Cryptographic Proof (ECDSA secp256k1)</h4>
              <pre className="font-mono text-xs" style={{ backgroundColor: "var(--navy-900)", color: "#93c5fd", padding: "12px", borderRadius: "var(--radius-md)", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(inspectCredential.proof, null, 2)}
              </pre>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setInspectCredential(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

export default StudentVault;
