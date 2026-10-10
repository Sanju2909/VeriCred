import React, { useState, useEffect } from "react";
import { Award, Plus, FileCheck, RefreshCw, XCircle, Eye, ShieldCheck, CheckCircle2 } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";
import Modal from "../components/Modal";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";

export function IssuerDashboard() {
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // New Credential Form State
  const [title, setTitle] = useState("Bachelor of Science in Computer Science");
  const [holderName, setHolderName] = useState("");
  const [holderEmail, setHolderEmail] = useState("");
  const [major, setMajor] = useState("Computer Science & Engineering");
  const [gpa, setGpa] = useState("3.85");
  const [graduationYear, setGraduationYear] = useState("2026");
  const [expirationDate, setExpirationDate] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);

  // Revoke Modal State
  const [revokingCredential, setRevokingCredential] = useState(null);
  const [revocationReason, setRevocationReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  // View JSON Modal
  const [viewingCredential, setViewingCredential] = useState(null);

  const fetchIssuedCredentials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getCredentials({ limit: 50 });
      if (res.success) {
        setCredentials(res.data.credentials || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load issued credentials");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssuedCredentials();
  }, []);

  const handleIssueCredential = async (e) => {
    e.preventDefault();
    setIsIssuing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        title,
        holderName,
        holderEmail: holderEmail.trim() || undefined,
        expirationDate: expirationDate || undefined,
        claims: {
          degree: title,
          major,
          gpa,
          graduationYear,
        },
      };

      const res = await api.issueCredential(payload);
      if (res.success) {
        setSuccessMsg(`Successfully issued and signed credential for ${holderName}!`);
        // Reset form
        setHolderName("");
        setHolderEmail("");
        fetchIssuedCredentials();
      }
    } catch (err) {
      setError(err.message || "Failed to issue credential");
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRevokeSubmit = async (e) => {
    e.preventDefault();
    if (!revokingCredential || !revocationReason.trim()) return;

    setIsRevoking(true);
    setError(null);
    try {
      const res = await api.revokeCredential(revokingCredential.credentialId, revocationReason);
      if (res.success) {
        setSuccessMsg(`Credential ${revokingCredential.credentialId} has been revoked.`);
        setRevokingCredential(null);
        setRevocationReason("");
        fetchIssuedCredentials();
      }
    } catch (err) {
      setError(err.message || "Failed to revoke credential");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <DashboardLayout
      title="Academic Credential Issuance Workspace"
      subtitle="Issue tamper-proof W3C Verifiable Credentials with ECDSA digital signatures and EVM anchoring"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={fetchIssuedCredentials} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      }
    >
      {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}
      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      <div className="grid-2" style={{ marginBottom: "32px", alignItems: "flex-start" }}>
        {/* Issuance Form */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: "1.25rem", color: "var(--navy-900)" }}>Issue New Credential</h2>
              <p style={{ fontSize: "0.825rem", color: "var(--slate-500)" }}>Sign with institutional key and anchor hash on-chain</p>
            </div>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={20} />
            </div>
          </div>

          <form onSubmit={handleIssueCredential}>
            <div className="form-group">
              <label className="form-label" htmlFor="credTitle">Credential / Degree Title</label>
              <input
                id="credTitle"
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="studentName">Student Full Name</label>
                <input
                  id="studentName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Alice Sharma"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="studentEmail">Student Email</label>
                <input
                  id="studentEmail"
                  type="email"
                  className="form-input"
                  placeholder="student@example.com"
                  value={holderEmail}
                  onChange={(e) => setHolderEmail(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="majorField">Major / Discipline</label>
                <input
                  id="majorField"
                  type="text"
                  className="form-input text-sm"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="gpaField">GPA / Grade</label>
                <input
                  id="gpaField"
                  type="text"
                  className="form-input text-sm"
                  value={gpa}
                  onChange={(e) => setGpa(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="gradYear">Graduation Year</label>
                <input
                  id="gradYear"
                  type="text"
                  className="form-input text-sm"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="expiry">Expiration Date (Optional)</label>
              <input
                id="expiry"
                type="date"
                className="form-input"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
              <div className="form-helper">Leave blank for non-expiring lifetime degrees.</div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "10px" }}
              disabled={isIssuing}
            >
              {isIssuing ? "Signing and Anchoring..." : "Issue & Digitally Sign Credential"}
            </button>
          </form>
        </div>

        {/* Issuance Information Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card" style={{ backgroundColor: "var(--navy-900)", color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <ShieldCheck size={22} style={{ color: "#60a5fa" }} />
              <h3 style={{ color: "white", fontSize: "1.1rem" }}>Cryptographic Signing Pipeline</h3>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--slate-300)", lineHeight: 1.6, marginBottom: "16px" }}>
              When you submit a credential:
            </p>
            <ol style={{ paddingLeft: "20px", fontSize: "0.825rem", color: "var(--slate-300)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Payload is canonicalized per <strong>RFC 8785</strong>.</li>
              <li>A digital signature is generated using your <strong>ECDSA secp256k1</strong> key.</li>
              <li>The <strong>Keccak-256 integrity hash</strong> is anchored to the <code>CredentialRegistry</code> contract.</li>
              <li>The student receives immediate custody in their vault.</li>
            </ol>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "1rem", marginBottom: "8px" }}>Total Issued Credentials</h3>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>{credentials.length}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--slate-500)", marginTop: "4px" }}>
              Active on decentralized trust registry
            </div>
          </div>
        </div>
      </div>

      {/* Issued Credentials Registry */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: "1.25rem", color: "var(--navy-900)" }}>Issued Credentials Registry</h2>
            <p style={{ fontSize: "0.825rem", color: "var(--slate-500)" }}>Manage, inspect, and revoke credentials anchored by your institution</p>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner text="Loading issued credentials..." />
        ) : credentials.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--slate-400)" }}>
            No credentials issued yet. Use the form above to issue your first credential.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title & Recipient</th>
                  <th>Credential ID</th>
                  <th>Status</th>
                  <th>Issued Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => (
                  <tr key={cred._id || cred.credentialId}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{cred.title}</div>
                      <div className="text-sm text-muted">{cred.holderName} {cred.holderEmail && `(${cred.holderEmail})`}</div>
                    </td>
                    <td className="font-mono text-xs text-muted" style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cred.credentialId}
                    </td>
                    <td>
                      <StatusBadge status={cred.status} />
                    </td>
                    <td className="text-sm text-muted">
                      {new Date(cred.issuanceDate).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setViewingCredential(cred)}
                          title="View Verifiable Credential JSON"
                        >
                          <Eye size={13} /> JSON
                        </button>

                        {!cred.isRevoked && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setRevokingCredential(cred)}
                            title="Revoke Credential on-chain"
                          >
                            <XCircle size={13} /> Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revocation Confirmation Modal */}
      <Modal
        isOpen={!!revokingCredential}
        onClose={() => setRevokingCredential(null)}
        title="Confirm Credential Revocation"
        maxWidth="500px"
      >
        {revokingCredential && (
          <form onSubmit={handleRevokeSubmit}>
            <div className="alert alert-danger" style={{ marginBottom: "16px" }}>
              <div>
                <strong>Warning:</strong> Revoking a credential is a permanent action recorded on the Ethereum smart contract registry. Verifiers will immediately see this credential as <strong>REVOKED</strong>.
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--slate-500)" }}>Credential:</div>
              <div style={{ fontWeight: 700 }}>{revokingCredential.title} - {revokingCredential.holderName}</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reasonInput">Reason for Revocation</label>
              <textarea
                id="reasonInput"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Certificate issued with clerical error in major; reissued under new ID"
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                required
                minLength={3}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRevokingCredential(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger btn-sm"
                disabled={isRevoking || !revocationReason.trim()}
              >
                {isRevoking ? "Revoking on Blockchain..." : "Confirm & Revoke"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* View JSON Modal */}
      <Modal
        isOpen={!!viewingCredential}
        onClose={() => setViewingCredential(null)}
        title="Verifiable Credential Payload"
        maxWidth="680px"
      >
        {viewingCredential && (
          <div>
            <pre className="font-mono" style={{ backgroundColor: "var(--navy-900)", color: "#93c5fd", padding: "16px", borderRadius: "var(--radius-md)", fontSize: "0.8rem", maxHeight: "400px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(
                {
                  "@context": viewingCredential.credentialType ? ["https://www.w3.org/2018/credentials/v1", "https://schema.org"] : undefined,
                  id: viewingCredential.credentialId,
                  type: viewingCredential.credentialType,
                  issuer: {
                    id: viewingCredential.issuerDid,
                    ethereumAddress: viewingCredential.issuerAddress,
                  },
                  issuanceDate: viewingCredential.issuanceDate,
                  expirationDate: viewingCredential.expirationDate,
                  credentialSubject: viewingCredential.claims,
                  proof: viewingCredential.proof,
                },
                null,
                2
              )}
            </pre>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewingCredential(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

export default IssuerDashboard;
