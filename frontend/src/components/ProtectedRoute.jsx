import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";
import Alert from "./Alert";
import Navbar from "./Navbar";
import Footer from "./Footer";

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Authenticating session..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="app-container">
        <Navbar />
        <div className="container" style={{ padding: "60px 24px", maxWidth: "680px" }}>
          <Alert
            type="danger"
            title="403 - Access Denied"
            message={`Your account role (${user.role}) is not authorized to access this restricted workspace. Required role: ${allowedRoles.join(" or ")}.`}
          />
          <div style={{ marginTop: "20px" }}>
            <a href="/" className="btn btn-secondary">
              Return to Home
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;

