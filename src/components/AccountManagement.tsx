import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Filter, ShieldCheck, Mail, MapPin, Trash2, CheckCircle2, AlertCircle, Clock, ShieldAlert, Loader2, User, UserCheck, RefreshCw, X, Edit3, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface UserAccount {
  username: string;
  email: string;
  fullName: string;
  barangay: string;
  role: string;
  status: 'Active' | 'Pending' | 'Suspended';
  createdAt: string;
  displayName?: string;
  avatarDataUrl?: string;
}

interface AccountManagementProps {
  authToken: string;
  currentUsername: string;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({
  authToken,
  currentUsername,
  showToast
}) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('All Barangays');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  // Base44 roles state
  const [base44Roles, setBase44Roles] = useState<string[]>([
    'Administrator',
    'Staff',
    'User',
    'Barangay Health Worker',
    'Clinic Doctor',
    'Clinic Nurse',
    'Barangay Official',
    'Data Encoder'
  ]);

  // Modal State for Adding New User
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBarangay, setRegBarangay] = useState('');
  const [regRole, setRegRole] = useState('Staff');
  const [creating, setCreating] = useState(false);

  // Modal State for Editing User
  const [editTarget, setEditTarget] = useState<UserAccount | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editRole, setEditRole] = useState('Staff');
  const [editStatus, setEditStatus] = useState<'Active' | 'Pending' | 'Suspended'>('Active');
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Barangay selection list
  const [barangayList, setBarangayList] = useState<string[]>([]);
  const [fetchingBarangays, setFetchingBarangays] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch registered accounts
  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch registered user accounts.');
      }
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles from Base44 database
  const fetchBase44Roles = async () => {
    try {
      const res = await fetch('/api/base44/roles');
      const data = await res.json();
      if (res.ok && Array.isArray(data.roles) && data.roles.length > 0) {
        setBase44Roles(data.roles);
      }
    } catch (err) {
      console.warn('Failed to fetch Base44 roles:', err);
    }
  };

  // Fetch barangays dropdown
  const fetchBarangays = async () => {
    setFetchingBarangays(true);
    try {
      const res = await fetch('/api/public/barangays');
      const data = await res.json();
      if (res.ok && Array.isArray(data.barangays)) {
        setBarangayList(data.barangays);
        if (data.barangays.length > 0 && !regBarangay) {
          setRegBarangay(data.barangays[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load barangay list:', err);
    } finally {
      setFetchingBarangays(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchAccounts();
      fetchBarangays();
      fetchBase44Roles();
    }
  }, [authToken]);

  // Handle Add Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regEmail.trim() || !regPassword.trim() || !regBarangay.trim()) {
      showToast('All fields are required.', 'warning');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          email: regEmail.trim(),
          password: regPassword.trim(),
          barangay: regBarangay.trim(),
          role: regRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register account.');
      }

      showToast(`User account for "${regFullName}" registered and saved to Google Sheets!`, 'success');
      setRegFullName('');
      setRegEmail('');
      setRegPassword('');
      setIsAddModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  // Open edit modal
  const openEditModal = (acc: UserAccount) => {
    setEditTarget(acc);
    setEditFullName(acc.fullName || acc.displayName || '');
    setEditEmail(acc.email || '');
    setEditBarangay(acc.barangay || (barangayList[0] || 'BARANGAY CENTRAL'));
    setEditRole(acc.role || 'Staff');
    setEditStatus(acc.status || 'Active');
    setEditPassword('');
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    if (!editFullName.trim() || !editBarangay.trim()) {
      showToast('Full Name and Barangay are required.', 'warning');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(editTarget.username)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          email: editEmail.trim(),
          barangay: editBarangay.trim(),
          role: editRole,
          status: editStatus,
          password: editPassword.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update account.');
      }

      showToast(`Account @${editTarget.username} updated and synced to Google Sheets!`, 'success');
      setEditTarget(null);
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Role Change inline
  const handleRoleChange = async (username: string, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user role.');
      }
      showToast(`Role for @${username} updated to ${newRole} and synced to Google Sheets.`, 'success');
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Status Toggle (Active <-> Suspended)
  const handleStatusToggle = async (username: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user status.');
      }
      showToast(`Account @${username} status is now ${nextStatus}.`, 'success');
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Account Deletion
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(deleteTarget.username)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user account.');
      }
      showToast(`Account "@${deleteTarget.username}" deleted and Google Sheets synced.`, 'success');
      setDeleteTarget(null);
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Unique Barangays for filter dropdown
  const uniqueBarangaysInAccounts = Array.from(
    new Set([...barangayList, ...accounts.map(a => a.barangay).filter(Boolean)])
  ).sort();

  // Filtered accounts list
  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch =
      search === '' ||
      acc.username.toLowerCase().includes(search.toLowerCase()) ||
      (acc.fullName && acc.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (acc.email && acc.email.toLowerCase().includes(search.toLowerCase()));

    const matchesBarangay =
      barangayFilter === 'All Barangays' || acc.barangay === barangayFilter;

    const matchesRole = roleFilter === 'All Roles' || acc.role === roleFilter;

    return matchesSearch && matchesBarangay && matchesRole;
  });

  const activeCount = accounts.filter(a => a.status === 'Active' || !a.status).length;
  const adminCount = accounts.filter(a => a.role === 'Administrator').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
              <Users className="w-4 h-4 text-emerald-600" />
              Administrative Directory
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight font-display">Account Management</h2>
            <p className="text-xs text-slate-500 mt-1">
              Manage user accounts, edit profiles, assign Base44 roles, and control access permissions. All user updates save to Google Sheets database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchAccounts();
                fetchBase44Roles();
              }}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0"
              title="Refresh directory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              Register New Account
            </button>
          </div>
        </div>

        {/* Quick Summary Widgets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total Users</div>
            <div className="text-2xl font-black text-slate-800 mt-1 font-display">{accounts.length}</div>
          </div>

          <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100/60">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">Active Accounts</div>
            <div className="text-2xl font-black text-emerald-800 mt-1 font-display">{activeCount}</div>
          </div>

          <div className="bg-purple-50/60 rounded-2xl p-4 border border-purple-100/60">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-purple-800">Administrators</div>
            <div className="text-2xl font-black text-purple-800 mt-1 font-display">{adminCount}</div>
          </div>

          <div className="bg-teal-50/60 rounded-2xl p-4 border border-teal-100/60">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-teal-800">Base44 Roles</div>
            <div className="text-2xl font-black text-teal-800 mt-1 font-display">{base44Roles.length}</div>
          </div>
        </div>
      </div>

      {/* Account Table Controls */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, or email address..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Barangay Filter */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer pr-1"
              >
                <option value="All Barangays">All Barangays</option>
                {uniqueBarangaysInAccounts.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer pr-1"
              >
                <option value="All Roles">All Roles</option>
                {base44Roles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* User Table */}
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading user accounts directory...</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No matching user accounts found</h4>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or register a new account.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">User / Account</th>
                  <th className="py-3.5 px-4">Contact Email</th>
                  <th className="py-3.5 px-4">Assigned Barangay</th>
                  <th className="py-3.5 px-4">Role Permission</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredAccounts.map((acc) => {
                  const isMasterAdmin = acc.username.toLowerCase() === 'admin';
                  const isCurrent = acc.username.toLowerCase() === currentUsername.toLowerCase();

                  return (
                    <tr key={acc.username} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center border border-emerald-200 shrink-0">
                            {acc.fullName ? acc.fullName.charAt(0).toUpperCase() : acc.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              {acc.fullName || acc.displayName || `@${acc.username}`}
                              {isMasterAdmin && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase">
                                  Master Admin
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-medium">@{acc.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{acc.email || `${acc.username}@clinic.gov.ph`}</span>
                        </div>
                      </td>

                      {/* Barangay Badge */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-bold">
                          <MapPin className="w-3 h-3 text-teal-600" />
                          {acc.barangay || 'Central'}
                        </span>
                      </td>

                      {/* Role Selector */}
                      <td className="py-4 px-4">
                        {isMasterAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 text-xs font-extrabold">
                            <ShieldCheck className="w-3.5 h-3.5" /> Administrator
                          </span>
                        ) : (
                          <select
                            value={acc.role}
                            onChange={(e) => handleRoleChange(acc.username, e.target.value)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer transition-all"
                          >
                            {!base44Roles.includes(acc.role) && (
                              <option value={acc.role}>{acc.role}</option>
                            )}
                            {base44Roles.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4">
                        <button
                          onClick={() => !isMasterAdmin && handleStatusToggle(acc.username, acc.status || 'Active')}
                          disabled={isMasterAdmin}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all ${
                            acc.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          } ${isMasterAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                          title={isMasterAdmin ? 'Master admin cannot be suspended' : 'Click to toggle active status'}
                        >
                          {acc.status === 'Active' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Suspended
                            </>
                          )}
                        </button>
                      </td>

                      {/* Registration Date */}
                      <td className="py-4 px-4 text-xs text-slate-400 font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-300" />
                          {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Initial Seed'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(acc)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
                            title="Edit user account"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>

                          {!isMasterAdmin && !isCurrent ? (
                            <button
                              onClick={() => setDeleteTarget(acc)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
                              title="Delete user account"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-semibold italic pl-1">Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile User Cards View for full responsiveness */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredAccounts.map((acc) => {
              const isMasterAdmin = acc.username.toLowerCase() === 'admin';
              const isCurrent = acc.username.toLowerCase() === currentUsername.toLowerCase();
              return (
                <div key={acc.username} className="p-4 space-y-3 hover:bg-slate-50/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center border border-emerald-200 shrink-0">
                        {acc.fullName ? acc.fullName.charAt(0).toUpperCase() : acc.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex flex-wrap items-center gap-1.5">
                          {acc.fullName || acc.displayName || `@${acc.username}`}
                          {isMasterAdmin && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase">
                              Master Admin
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">@{acc.username}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => !isMasterAdmin && handleStatusToggle(acc.username, acc.status || 'Active')}
                      disabled={isMasterAdmin}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all ${
                        acc.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                      } ${isMasterAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {acc.status === 'Active' ? 'Active' : 'Suspended'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200/60 text-teal-800 font-bold">
                      <MapPin className="w-3 h-3 text-teal-600" />
                      {acc.barangay || 'Central'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                      <Shield className="w-3 h-3 text-slate-500" />
                      {acc.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="font-mono text-xs text-slate-500 flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{acc.email || `${acc.username}@clinic.gov.ph`}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(acc)}
                        className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      {!isMasterAdmin && !isCurrent ? (
                        <button
                          onClick={() => setDeleteTarget(acc)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-semibold italic pl-1">Protected</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {/* Modal: Register New Account */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative"
            >
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-display">Register New Account</h3>
                  <p className="text-xs text-slate-400">Saves directly to Google Sheets database.</p>
                </div>
              </div>

              <form onSubmit={handleAddAccount} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Full Name <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Email Address <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="juan.delacruz@gmail.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Password <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Password (min 4 chars)"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Barangay (Base44 Address) <span className="text-emerald-600">*</span>
                  </label>
                  <select
                    required
                    value={regBarangay}
                    onChange={(e) => setRegBarangay(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {fetchingBarangays ? (
                      <option value="">Loading Barangays...</option>
                    ) : (
                      barangayList.map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Role Permission (Base44 DB Roles) <span className="text-emerald-600">*</span>
                  </label>
                  <select
                    required
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {base44Roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Edit Account Details */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative"
            >
              <button
                onClick={() => setEditTarget(null)}
                className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-display">Edit User Account</h3>
                  <p className="text-xs text-slate-400">Update account for @{editTarget.username}</p>
                </div>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Full Name <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Assigned Barangay <span className="text-emerald-600">*</span>
                  </label>
                  <select
                    required
                    value={editBarangay}
                    onChange={(e) => setEditBarangay(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {barangayList.map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                      Role Permission <span className="text-emerald-600">*</span>
                    </label>
                    <select
                      disabled={editTarget.username.toLowerCase() === 'admin'}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                    >
                      {!base44Roles.includes(editRole) && (
                        <option value={editRole}>{editRole}</option>
                      )}
                      {base44Roles.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                      Account Status
                    </label>
                    <select
                      disabled={editTarget.username.toLowerCase() === 'admin'}
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    New Password <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>
                  </label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="New password (optional)"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 font-display">Delete Registered Account?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete the account for <strong className="text-slate-700">{deleteTarget.fullName || deleteTarget.username}</strong> (@{deleteTarget.username})?
              </p>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Account'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
