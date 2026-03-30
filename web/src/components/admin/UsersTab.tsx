"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/hooks/useAuth";
import type { AdminUserRow, UserRole } from "@/types/auth";

type SortCol = "userName" | "email" | "role" | "created";
type SortDir = "asc" | "desc";

function SortHeader({ label, col, sortCol, sortDir, onSort }: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir; onSort: (col: SortCol) => void;
}) {
  return (
    <th
      className="py-2 pr-3 font-medium cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortCol === col && (
          <span className="text-indigo-500">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </span>
    </th>
  );
}

export function UsersTab() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ userId: string; role: UserRole } | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchUsers = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError("Failed to load users"); return; }
      setUsers(await res.json());
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const token = getAccessToken();
    if (!token) return;
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.detail ?? "Failed to update role"); return; }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch {
      alert("Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  let filtered = users;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((u) =>
      u.userName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }
  if (filterRole) filtered = filtered.filter((u) => u.role === filterRole);

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortCol === "userName") return (a.userName || a.email).localeCompare(b.userName || b.email) * dir;
    if (sortCol === "email") return a.email.localeCompare(b.email) * dir;
    if (sortCol === "role") return a.role.localeCompare(b.role) * dir;
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
  });

  if (error) return <div className="text-sm text-red-500 py-4">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email..."
          className="min-h-[36px] px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
        />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="cursor-pointer min-h-[36px] px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All roles</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <span className="text-xs text-gray-500">{sorted.length} users</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <SortHeader label="Username" col="userName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Email" col="email" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Role" col="role" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Joined" col="created" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="py-2 font-medium w-40">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {sorted.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2.5 pr-3 font-medium">{u.userName || "—"}</td>
                  <td className="py-2.5 pr-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{u.email}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      u.role === "admin"
                        ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={pendingChange?.userId === u.id ? pendingChange.role : u.role}
                        onChange={(e) => setPendingChange({ userId: u.id, role: e.target.value as UserRole })}
                        disabled={updatingId === u.id}
                        className="cursor-pointer min-h-[32px] px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                      {pendingChange?.userId === u.id && pendingChange.role !== u.role && (
                        <>
                          <button type="button"
                            onClick={async () => { await handleRoleChange(pendingChange.userId, pendingChange.role); setPendingChange(null); }}
                            disabled={updatingId === u.id}
                            className="cursor-pointer text-[10px] font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 px-2 py-1 rounded transition-colors">
                            {updatingId === u.id ? "..." : "Confirm"}
                          </button>
                          <button type="button" onClick={() => setPendingChange(null)}
                            className="cursor-pointer text-[10px] font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-1.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No users found.</p>}
        </div>
      )}
    </div>
  );
}
