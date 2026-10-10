import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("auth_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("auth_token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const res = await api.getMe();
          if (res.success && res.data) {
            setUser(res.data);
            localStorage.setItem("auth_user", JSON.stringify(res.data));
          }
        } catch (err) {
          console.warn("Session validation failed, resetting auth state:", err.message);
          logout();
        }
      }
      setIsLoading(false);
    }

    const handleSessionExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    initAuth();

    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, [token]);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    if (res.success && res.data) {
      const { user: userData, token: tokenData } = res.data;
      setUser(userData);
      setToken(tokenData);
      localStorage.setItem("auth_user", JSON.stringify(userData));
      localStorage.setItem("auth_token", tokenData);
      return userData;
    }
    throw new Error(res.error?.message || "Login failed");
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    if (res.success && res.data) {
      const { user: newUser, token: newToken } = res.data;
      setUser(newUser);
      setToken(newToken);
      localStorage.setItem("auth_user", JSON.stringify(newUser));
      localStorage.setItem("auth_token", newToken);
      return newUser;
    }
    throw new Error(res.error?.message || "Registration failed");
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
  };

  const refreshUser = async () => {
    if (!token) return null;
    try {
      const res = await api.getMe();
      if (res.success && res.data) {
        setUser(res.data);
        localStorage.setItem("auth_user", JSON.stringify(res.data));
        return res.data;
      }
    } catch {
      return null;
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
