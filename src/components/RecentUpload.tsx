import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  FileCheck,
  Search,
  Folder,
  MapPin,
  User as UserIcon,
  Phone,
  Calendar,
  Download,
  Trash2,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  ShieldCheck,
  Eye,
  AlertCircle,
  ArrowUpRight
} from 'lucide-react';
import { Contact } from '../types';

interface RecentUploadProps {
  authToken: string | null;
  currentUsername: string;
  isAdmin?: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RecentUpload: React.FC<RecentUploadProps> = ({
  authToken,
  currentUsername,
  isAdmin = false,
  showToast
}) => {
  // Filter States
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('All Barangays');
  const [purokFilter, setPurokFilter] = useState('All Puroks');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'barangay' | 'purok'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(9);

  // Data States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [allBarangays, setAllBarangays] = useState<string[]>([]);
  const [allPuroks, setAllPuroks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Active View Modal
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Fetch recent uploads for current user
  const fetchRecentUploads = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        search,
        barangay: barangayFilter === 'All Barangays' ? 'All Addresses' : barangayFilter,
        purok: purokFilter,
        sortBy,
        sortOrder,
        page: page.toString(),
        limit: limit.toString()
      });

      const res = await fetch(`/api/contacts/recent-uploads?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch recent uploads.');
      }

      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setAllBarangays(data.allBarangays || []);
      setAllPuroks(data.allPuroks || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentUploads();
  }, [search, barangayFilter, purokFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    setPage(1);
  }, [search, barangayFilter, purokFilter]);

  // Remove PCU file from contact (moves it back to Saint Francis Clinic Directory)
  const handleRemovePCU = async (contact: Contact) => {
    if (!window.confirm(`Are you sure you want to restore household "${contact.full_name}"? This will transfer it back to the Saint Francis Clinic Directory and remove it from the PCU uploads and base44 database.`)) {
      return;
    }

    setRemovingId(contact.id);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/pcu`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to restore household.');
      }

      showToast(`Household "${contact.full_name}" has been restored back to Saint Francis Clinic Directory and removed from PCU uploads.`, 'success');
      if (selectedContact?.id === contact.id) {
        setSelectedContact(null);
      }
      fetchRecentUploads();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const getFileDisplayName = (fileUrlOrData?: string) => {
    if (!fileUrlOrData) return 'PCU Document';
    if (fileUrlOrData.startsWith('Uploaded:')) {
      return fileUrlOrData;
    }
    if (fileUrlOrData.startsWith('http')) {
      const parts = fileUrlOrData.split('/');
      return parts[parts.length - 1] || 'PCU Document';
    }
    if (fileUrlOrData.startsWith('data:')) {
      return 'Uploaded PCU Document (Data)';
    }
    return fileUrlOrData;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 border border-emerald-800/40 shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <UploadCloud className="w-48 h-48 text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Personal Upload Archives</span>
            </div>
            <h2 className="text-2xl font-bold font-display text-white tracking-wide">
              Recent Uploads
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Household records that have completed PCU file uploads. When a PCU file is uploaded, the household transfers from the Saint Francis Clinic Directory barangay folders to this private archive page.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-emerald-900/50 border border-emerald-700/50 rounded-2xl px-5 py-3 text-center min-w-[120px]">
              <span className="text-xs text-emerald-300 uppercase tracking-wider font-semibold block">
                Your Uploads
              </span>
              <span className="text-2xl font-bold font-display text-white mt-0.5 block">
                {total}
              </span>
            </div>
            <button
              onClick={fetchRecentUploads}
              className="p-3 bg-emerald-800/40 hover:bg-emerald-800/80 border border-emerald-700/50 rounded-2xl text-emerald-200 hover:text-white transition-all cursor-pointer"
              title="Refresh recent uploads"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search uploaded household name, barangay, or contact #..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Barangay Dropdown */}
          <div className="md:col-span-3">
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
            >
              <option value="All Barangays">All Barangays ({allBarangays.length})</option>
              {allBarangays.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          {/* Purok Dropdown */}
          <div className="md:col-span-2">
            <select
              value={purokFilter}
              onChange={(e) => setPurokFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
            >
              <option value="All Puroks">All Puroks ({allPuroks.length})</option>
              {allPuroks.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="md:col-span-2 flex gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
            >
              <option value="date">Sort: Upload Date</option>
              <option value="name">Sort: Household Name</option>
              <option value="barangay">Sort: Barangay</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              title={`Switch to ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Active Isolation Notice */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Isolated View: Showing uploads assigned exclusively to user <strong className="text-emerald-950 font-bold">@{currentUsername}</strong></span>
          </div>
          <span className="text-[11px] text-slate-400">
            Showing {contacts.length} of {total} uploaded households
          </span>
        </div>
      </div>

      {/* Household Upload Grid Cards */}
      {loading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading your uploaded PCU households...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="py-16 px-6 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-800 font-display">No Recent Uploads Found</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {search || barangayFilter !== 'All Barangays' || purokFilter !== 'All Puroks'
                ? 'No households match your active search filters.'
                : `You (@${currentUsername}) haven't uploaded PCU files for any households yet. Go to Saint Francis Clinic Directory to select a household and upload a PCU file.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {contacts.map((contact) => (
            <motion.div
              key={contact.id}
              whileHover={{ y: -3 }}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm font-display truncate" title={contact.full_name}>
                      {contact.full_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{contact.barangay}</span>
                      {contact.purok && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold uppercase tracking-wider shrink-0">
                          {contact.purok}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <FileCheck className="w-3 h-3 text-emerald-600" />
                    Uploaded
                  </span>
                </div>

                {/* PCU File Badge */}
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[180px]">
                        {getFileDisplayName(contact.pcu_file_url)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-emerald-200/40">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {contact.pcu_uploaded_at ? new Date(contact.pcu_uploaded_at).toLocaleDateString() : 'Recently'}
                    </span>
                    <span className="font-medium text-emerald-800">
                      By @{contact.pcu_uploaded_by || currentUsername}
                    </span>
                  </div>
                </div>

                {/* Additional Household Info */}
                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{contact.contact_number || 'No contact number'}</span>
                  </p>
                </div>
              </div>

              {/* Card Actions Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedContact(contact)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                <button
                  onClick={() => handleRemovePCU(contact)}
                  disabled={removingId === contact.id}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                  title="Restore this household back to Saint Francis Clinic Directory"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${removingId === contact.id ? 'animate-spin' : ''}`} />
                  <span>Restore</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-3.5 border border-slate-200/80 shadow-sm text-xs">
          <span className="text-slate-500">
            Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail & File View Modal */}
      <AnimatePresence>
        {selectedContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between border-b border-emerald-800/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold font-display text-base text-white">
                      {selectedContact.full_name}
                    </h3>
                    <p className="text-xs text-emerald-300/80 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {selectedContact.barangay} {selectedContact.purok ? `• ${selectedContact.purok}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedContact(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs">
                {/* Household Info Grid */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Household Head</span>
                    <span className="font-bold text-slate-900 text-sm mt-0.5 block">{selectedContact.full_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Contact Number</span>
                    <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedContact.contact_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Barangay</span>
                    <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedContact.barangay}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Purok</span>
                    <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedContact.purok || 'None'}</span>
                  </div>
                </div>

                {/* PCU File Upload Information Box */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 font-display">
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                    <span>Uploaded PCU File Document</span>
                  </h4>

                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                        <div>
                          <span className="font-bold text-emerald-950 text-xs block">
                            {getFileDisplayName(selectedContact.pcu_file_url)}
                          </span>
                          <span className="text-[10px] text-emerald-700">
                            Uploaded by @{selectedContact.pcu_uploaded_by || currentUsername} • {selectedContact.pcu_uploaded_at ? new Date(selectedContact.pcu_uploaded_at).toLocaleString() : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* File Preview if base64 or URL */}
                    {selectedContact.pcu_file_url && (
                      <div className="pt-2 border-t border-emerald-200/60">
                        {selectedContact.pcu_file_url.startsWith('http') ? (
                          <a
                            href={selectedContact.pcu_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open / Download PCU File</span>
                          </a>
                        ) : selectedContact.pcu_file_url.startsWith('data:image/') ? (
                          <div className="space-y-2">
                            <img
                              src={selectedContact.pcu_file_url}
                              alt="PCU Document Preview"
                              className="max-h-56 rounded-xl border border-emerald-200 object-contain mx-auto bg-white"
                            />
                            <a
                              href={selectedContact.pcu_file_url}
                              download={`PCU_${selectedContact.full_name.replace(/\s+/g, '_')}.png`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download PCU File</span>
                            </a>
                          </div>
                        ) : selectedContact.pcu_file_url.startsWith('data:') ? (
                          <a
                            href={selectedContact.pcu_file_url}
                            download={`PCU_${selectedContact.full_name.replace(/\s+/g, '_')}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Attachment File</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-emerald-800 italic">
                            File stored in local directory cache ({selectedContact.pcu_file_url})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 text-emerald-800 text-[11px] flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    To transfer this household back to the Saint Francis Clinic Directory and delete its PCU file, click "Restore to Directory" below.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => handleRemovePCU(selectedContact)}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restore to Directory</span>
                </button>

                <button
                  onClick={() => setSelectedContact(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
