/**
 * Centralized API Client Service
 * Interacts with Express Backend API endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

class ApiClient {
  /**
   * Internal request handler attaching JWT token and headers.
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem("auth_token");

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({
        success: false,
        error: { message: "Failed to parse JSON response from server", code: "PARSE_ERROR" },
      }));

      if (!response.ok) {
        // If unauthorized / token expired, handle session cleanup
        if (response.status === 401 && token) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          window.dispatchEvent(new Event("auth:session-expired"));
        }

        const errorMessage = data?.error?.message || `HTTP ${response.status}: Request failed`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.code = data?.error?.code || "API_ERROR";
        error.details = data?.error?.details || null;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        const netError = new Error("Unable to connect to backend API. Please verify the server is running on " + API_BASE_URL);
        netError.code = "NETWORK_ERROR";
        netError.status = 503;
        throw netError;
      }
      throw error;
    }
  }

  // Health
  async getHealth() {
    return this.request("/health", { method: "GET" });
  }

  // Auth
  async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async logout() {
    try {
      await this.request("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout network failure, token will be cleared locally
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }
  }

  async getMe() {
    return this.request("/auth/me", { method: "GET" });
  }

  // Users (Admin)
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users${query ? `?${query}` : ""}`, { method: "GET" });
  }

  async getUserById(id) {
    return this.request(`/users/${id}`, { method: "GET" });
  }

  async updateUserRole(id, role) {
    return this.request(`/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }

  // Credentials
  async issueCredential(credentialData) {
    return this.request("/credentials", {
      method: "POST",
      body: JSON.stringify(credentialData),
    });
  }

  async getCredentials(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/credentials${query ? `?${query}` : ""}`, { method: "GET" });
  }

  async getCredentialById(id) {
    return this.request(`/credentials/${id}`, { method: "GET" });
  }

  async verifyCredential(payload) {
    // If string ID is provided, query /credentials/:id/verify, otherwise post payload to /credentials/verify
    if (typeof payload === "string") {
      return this.request(`/credentials/${payload}/verify`, { method: "POST" });
    }
    return this.request("/credentials/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async revokeCredential(id, reason) {
    return this.request(`/credentials/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }
}

export const api = new ApiClient();
export default api;
