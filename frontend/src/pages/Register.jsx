import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, User, Lock, Mail, ArrowRight, Wallet, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Alert from "../components/Alert";

export function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("HOLDER");
  const [ethereumAddress, setEthereumAddress] = useState("");
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setDetails(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name,
        email,
        password,
        role,
        ethereumAddress: ethereumAddress.trim() || undefined,
      };

      const user = await register(payload);
      if (user.role === "HOLDER") {
        navigate("/student");
      } else {
        navigate("/verify");
      }
    } catch (err) {
      setError(err.message || "Registration failed");
      setDetails(err.details || null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ maxWidth: "480px", width: "100%" }}>
          <div className="card" style={{ padding: "36px" }}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
                <Shield size={26} />
              </div>
              <h2 style={{ fontSize: "1.6rem", color: "var(--navy-900)", marginBottom: "6px" }}>Create an Account</h2>
              <p style={{ color: "var(--slate-500)", fontSize: "0.875rem" }}>Join the VeriCred decentralized credential network</p>
            </div>

            {error && <Alert type="danger" message={error} details={details} onClose={() => setError(null)} />}

            <div className="alert alert-info" style={{ fontSize: "0.8rem", padding: "10px 14px", marginBottom: "20px" }}>
              <Info size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>Security Rule:</strong> Public registration is restricted to Students (Holders) and Verifiers (Employers). Academic Issuer accounts are authorized by platform governance.
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="name">Full Name or Organization Name</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alice Sharma or Acme Corp"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ paddingLeft: "38px" }}
                  />
                  <User size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)" }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ paddingLeft: "38px" }}
                  />
                  <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)" }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="role">Account Type</label>
                <select
                  id="role"
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="HOLDER">Student / Credential Holder</option>
                  <option value="VERIFIER">Verifier / Employer</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password (min. 8 characters, letters & numbers)</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    style={{ paddingLeft: "38px" }}
                  />
                  <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)" }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ethAddress">
                  Ethereum Wallet Address <span className="text-muted text-xs">(Optional for DID anchoring)</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="ethAddress"
                    type="text"
                    className="form-input font-mono text-sm"
                    placeholder="0x..."
                    value={ethereumAddress}
                    onChange={(e) => setEthereumAddress(e.target.value)}
                    style={{ paddingLeft: "38px" }}
                  />
                  <Wallet size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)" }} />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "10px" }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Complete Registration"} <ArrowRight size={16} />
              </button>
            </form>

            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--slate-100)", textAlign: "center", fontSize: "0.875rem", color: "var(--slate-500)" }}>
              Already registered?{" "}
              <Link to="/login" style={{ fontWeight: 600 }}>
                Log in instead
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default Register;

