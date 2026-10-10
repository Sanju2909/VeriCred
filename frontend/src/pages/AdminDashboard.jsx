import React, { useState, useEffect } from "react";
import { Users, Shield, Server, Activity, RefreshCw, Check, Edit2, AlertCircle } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";
import Modal from "../components/Modal";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";

export function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("");
  const [healthData, setHealthData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Edit Role Modal
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState("HOLDER");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const fetchDashboardData = async (roleFilter = selectedRoleFilter, page = pagination.page) => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, healthRes] = await Promise.all([
        api.getUsers({ role: roleFilter || undefined, page, limit: 15 }),
        api.getHealth(),
      ]);

      if (usersRes.success) {
        setUsers(usersRes.data.users);
        setPagination(usersRes.data.pagination);
      }
      if (healthRes.success) {
        setHealthData(healthRes.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedRoleFilter, 1);
  }, [selectedRoleFilter]);

  const handleOpenEditRole = (user) => {
    setEditingUser(user);
    setNewRole(user.role);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsUpdatingRole(true);
    try {
      const res = await api.updateUserRole(editingUser.id, newRole);
      if (res.success) {
        setSuccessMsg(`Successfully updated role for ${editingUser.name} to ${newRole}`);
        setEditingUser(null);
        fetchDashboardData(selectedRoleFilter, pagination.page);
      }
    } catch (err) {
      setError(err.message || "Failed to update role");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  return (
    <DashboardLayout
      title="Platform Governance & User Directory"
      subtitle="Manage institutional authorizations, system roles, and monitor smart contract connectivity"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={() => fetchDashboardData()} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      }
    >
      {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}
      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* System Health / Status Cards */}
      <div className="grid-3" style={{ marginBottom: "28px" }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.825rem", color: "var(--slate-500)", fontWeight: 600, textTransform: "uppercase" }}>
              Total Registered Users
            </span>
            <Users size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--navy-900)" }}>{pagination.total}</div>
          <div style={{ fontSize: "0.775rem", color: "var(--slate-400)", marginTop: "4px" }}>Across all platform roles</div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.825rem", color: "var(--slate-500)", fontWeight: 600, textTransform: "uppercase" }}>
              Backend & DB Health
            </span>
            <Server size={18} style={{ color: "var(--success)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--navy-900)" }}>
              {healthData?.status || "Checking..."}
            </div>
            {healthData && <StatusBadge status={healthData.status} />}
          </div>
          <div style={{ fontSize: "0.775rem", color: "var(--slate-500)", marginTop: "4px" }}>
            Database: {healthData?.database?.state || "N/A"} | Uptime: {healthData?.uptimeSeconds || 0}s
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.825rem", color: "var(--slate-500)", fontWeight: 600, textTransform: "uppercase" }}>
              Blockchain Registry
            </span>
            <Activity size={18} style={{ color: "var(--info)" }} />
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--navy-900)" }}>
            EVM Localhost (31337)
          </div>
          <div style={{ fontSize: "0.775rem", color: "var(--slate-500)", marginTop: "4px" }}>
            Contracts: IssuerRegistry & CredentialRegistry
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", color: "var(--navy-900)" }}>User Directory & Permissions</h2>
            <p style={{ fontSize: "0.825rem", color: "var(--slate-500)" }}>View user identities and promote institutions to ISSUER role</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--slate-600)", fontWeight: 500 }}>Filter by Role:</span>
            <select
              className="form-select"
              style={{ width: "auto", padding: "6px 12px", fontSize: "0.85rem" }}
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="ISSUER">ISSUER</option>
              <option value="HOLDER">HOLDER</option>
              <option value="VERIFIER">VERIFIER</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner text="Fetching users from database..." />
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--slate-400)" }}>
            No users found matching the selected filter.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>DID / Address</th>
                  <th>Joined</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <StatusBadge status={u.role} type="role" />
                    </td>
                    <td className="font-mono text-xs text-muted" style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.did || u.ethereumAddress || "None"}
                    </td>
                    <td className="text-muted text-sm">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEditRole(u)}
                        style={{ padding: "4px 8px" }}
                        title="Change user role"
                      >
                        <Edit2 size={13} /> Change Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Role Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Modify System Role"
        maxWidth="440px"
      >
        {editingUser && (
          <form onSubmit={handleSaveRole}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.875rem", color: "var(--slate-500)", marginBottom: "4px" }}>User:</div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{editingUser.name} ({editingUser.email})</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="newRoleSelect">Assign New Role</label>
              <select
                id="newRoleSelect"
                className="form-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="HOLDER">HOLDER (Student / Graduate)</option>
                <option value="VERIFIER">VERIFIER (Employer)</option>
                <option value="ISSUER">ISSUER (Academic Institution)</option>
                <option value="ADMIN">ADMIN (Platform Governance)</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isUpdatingRole}
              >
                {isUpdatingRole ? "Saving..." : "Save Role"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
}

export default AdminDashboard;
