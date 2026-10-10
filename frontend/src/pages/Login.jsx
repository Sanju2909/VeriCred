import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Shield, Lock, Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Alert from "../components/Alert";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login(email, password);
      // Navigate to destination or role dashboard
      if (from) {
        navigate(from, { replace: true });
      } else {
        switch (user.role) {
          case "ADMIN":
            navigate("/admin");
            break;
          case "ISSUER":
            navigate("/issuer");
            break;
          case "HOLDER":
            navigate("/student");
            break;
          case "VERIFIER":
            navigate("/verify");
            break;
          default:
            navigate("/");
        }
      }
    } catch (err) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Demo autofill helper
  const handleQuickFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ maxWidth: "440px", width: "100%" }}>
          <div className="card" style={{ padding: "36px" }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
                <Shield size={26} />
              </div>
              <h2 style={{ fontSize: "1.6rem", color: "var(--navy-900)", marginBottom: "6px" }}>Welcome Back</h2>
              <p style={{ color: "var(--slate-500)", fontSize: "0.875rem" }}>Log in to your VeriCred account</p>
            </div>

            {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}

            <form onSubmit={handleSubmit}>
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
                <label className="form-label" htmlFor="password">Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingLeft: "38px" }}
                  />
                  <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)" }} />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "10px" }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign In"} <ArrowRight size={16} />
              </button>
            </form>

            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--slate-100)", textAlign: "center", fontSize: "0.875rem", color: "var(--slate-500)" }}>
              Don't have an account?{" "}
              <Link to="/register" style={{ fontWeight: 600 }}>
                Create one now
              </Link>
            </div>
          </div>

          {/* Demo Quick Fill Box */}
          <div style={{ marginTop: "20px", backgroundColor: "white", border: "1px dashed var(--slate-300)", borderRadius: "var(--radius-md)", padding: "16px" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--slate-400)", marginBottom: "8px", letterSpacing: "0.05em" }}>
              Academic Demo Quick-Fill
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill("admin@credentialplatform.local", "AdminPass123!")}
              >
                Admin (Seeded)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill("registrar@university.edu", "Password123!")}
              >
                Issuer
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill("alice@student.test", "Password123!")}
              >
                Student
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default Login;
