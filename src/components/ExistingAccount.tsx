import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderOpen,
  Search,
  MapPin,
  User as UserIcon,
  Phone,
  Calendar,
  Eye,
  ArrowLeft,
  Loader2,
  Layers,
  CheckCircle2,
  Clock,
  X,
  FileText,
  UserCheck
} from 'lucide-react';
import { ExistingAccountItem } from '../types.js';

interface ExistingAccountProps {
  authToken: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExistingAccount: React.FC<ExistingAccountProps> = ({
  authToken,
  showToast
}) => {
  const [existingAccounts, setExistingAccounts] = useState<ExistingAccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ExistingAccountItem | null>(null);

  // Fetch Existing Accounts from server API
  const fetchExistingAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/base44/existing-accounts', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch existing accounts from Base44 database.');
      }
      setExistingAccounts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExistingAccounts();
  }, [authToken]);

  // Aggregate barangay folders from fetched existing accounts
  const barangayFolders = useMemo(() => {
    const foldersMap: { [key: string]: { count: number; verifiedCount: number; list: ExistingAccountItem[] } } = {};
    
    existingAccounts.forEach(acc => {
      const bName = acc.barangay || 'Unknown Barangay';
      if (!foldersMap[bName]) {
        foldersMap[bName] = { count: 0, verifiedCount: 0, list: [] };
      }
      foldersMap[bName].count += 1;
      if (acc.existingAccVerified) {
        foldersMap[bName].verifiedCount += 1;
      }
      foldersMap[bName].list.push(acc);
    });

    return Object.keys(foldersMap).map(name => ({
      barangay: name,
      count: foldersMap[name].count,
      verifiedCount: foldersMap[name].verifiedCount,
      list: foldersMap[name].list
    })).sort((a, b) => a.barangay.localeCompare(b.barangay));
  }, [existingAccounts]);

  // Filter folders in Folder Overview mode
  const filteredFolders = useMemo(() => {
    if (!searchQuery || activeFolder) return barangayFolders;
    return barangayFolders.filter(f => 
      f.barangay.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [barangayFolders, searchQuery, activeFolder]);

  // Filter accounts inside the active folder
  const filteredAccountsInFolder = useMemo(() => {
    if (!activeFolder) return [];
    const folderData = barangayFolders.find(f => f.barangay === activeFolder);
    if (!folderData) return [];

    if (!searchQuery) return folderData.list;

    const lowerQuery = searchQuery.toLowerCase();
    return folderData.list.filter(acc => 
      (acc.full_name || '').toLowerCase().includes(lowerQuery) ||
      (acc.contact_number || '').toLowerCase().includes(lowerQuery) ||
      (acc.purok || '').toLowerCase().includes(lowerQuery) ||
      (acc.pin || '').toLowerCase().includes(lowerQuery)
    );
  }, [barangayFolders, activeFolder, searchQuery]);

  return (
    <div className="space-y-6">
      {/* breadcrumb header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {activeFolder ? (
            <button
              onClick={() => {
                setActiveFolder(null);
                setSearchQuery('');
              }}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 focus:outline-none"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Folders
            </button>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-xs">
              <Folder className="w-5 h-5 text-emerald-700" />
            </div>
          )}

          <div>
            <h2 className="text-lg font-extrabold text-slate-800 font-display flex items-center gap-2">
              {activeFolder ? (
                <>
                  <FolderOpen className="w-5 h-5 text-amber-600 fill-amber-300/30" />
                  Existing Accounts in {activeFolder}
                </>
              ) : (
                'Base44 Existing Account Directories'
              )}
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {activeFolder
                ? `Showing patient records marked as existing accounts stored inside ${activeFolder}`
                : `Organized into ${barangayFolders.length} Barangay Folders from Base44 Database`}
            </p>
          </div>
        </div>

        <button
          onClick={fetchExistingAccounts}
          disabled={loading}
          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 focus:outline-none"
          title="Reload existing accounts from the Base44 database"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5 text-emerald-300" />}
          {loading ? 'Loading...' : 'Refresh Directory ↻'}
        </button>
      </div>

      {loading && existingAccounts.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-xs">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-bold text-sm">Fetching existing accounts from Base44 database...</p>
          <p className="text-slate-400 text-xs mt-1">Please wait a moment while we aggregate and organize files.</p>
        </div>
      ) : (
        <>
          {/* TOOLBAR FOR SEARCH */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeFolder ? `Search in ${activeFolder} folder...` : "Search Barangay Folder name..."}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>
                {activeFolder 
                  ? `${filteredAccountsInFolder.length} Existing Account Submissions` 
                  : `${filteredFolders.length} Barangay Folders`
                }
              </span>
            </div>
          </div>

          {/* VIEW MODE 1: BARANGAY FOLDERS LIST GRID */}
          {!activeFolder && (
            <>
              {filteredFolders.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
                  <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-bold text-sm">No folders found matching "{searchQuery}"</p>
                  <p className="text-slate-400 text-xs mt-1">Try checking your spelling or reloading the dataset.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredFolders.map((folder) => (
                    <motion.div
                      key={folder.barangay}
                      whileHover={{ y: -3, transition: { duration: 0.15 } }}
                      className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all overflow-hidden flex flex-col justify-between group cursor-pointer"
                      onClick={() => {
                        setActiveFolder(folder.barangay);
                        setSearchQuery('');
                      }}
                    >
                      <div className="p-6 pb-4">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/70 border border-amber-300/60 text-amber-800 flex items-center justify-center shadow-xs group-hover:from-emerald-100 group-hover:to-emerald-200 group-hover:border-emerald-300 group-hover:text-emerald-800 transition-colors">
                            <Folder className="w-6 h-6 fill-amber-300/50 group-hover:fill-emerald-300/50 transition-colors" />
                          </div>

                          <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-extrabold text-xs">
                            {folder.count} Records
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-800 font-display group-hover:text-emerald-800 transition-colors capitalize">
                          {folder.barangay.toLowerCase()}
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          Grouped directory folder
                        </p>
                      </div>

                      <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-800 group-hover:bg-emerald-50/30 transition-colors">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{folder.verifiedCount} Verified</span>
                        </div>
                        <span className="group-hover:translate-x-1 transition-transform">Open Directory →</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* VIEW MODE 2: ACTIVE FOLDER DETAILED PATIENT LIST */}
          {activeFolder && (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Patient Records inside Folder
                </span>
                <span className="px-2.5 py-1 text-xs font-extrabold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200/60">
                  {filteredAccountsInFolder.length} Found
                </span>
              </div>

              {filteredAccountsInFolder.length === 0 ? (
                <div className="p-16 text-center">
                  <UserIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-bold text-sm">No patient records found in this folder</p>
                  <p className="text-slate-400 text-xs mt-1">Try clearing your search filters to show all accounts.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase tracking-wider bg-slate-50/40">
                        <th className="py-3 px-5">Patient Name</th>
                        <th className="py-3 px-4">Purok</th>
                        <th className="py-3 px-4">Mobile</th>
                        <th className="py-3 px-4">PIN Code</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Verification</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 text-xs font-medium">
                      {filteredAccountsInFolder.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="capitalize">{item.full_name.toLowerCase()}</span>
                              {item.geotagged && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200/40 rounded-sm">
                                  Geotagged
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 capitalize">
                            {item.purok ? item.purok.toLowerCase() : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold">
                            {item.contact_number || <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 font-semibold">
                            {item.pin || <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide border ${
                              item.status === 'approved' 
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                                : 'text-amber-700 bg-amber-50/70 border-amber-200'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {item.existingAccVerified ? (
                                <span className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                                  <Clock className="w-3.5 h-3.5 text-slate-300" /> Pending
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200/60 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* DETAILED RECORD DIALOG MODAL */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="bg-gradient-to-r from-emerald-900 to-slate-950 px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display capitalize">
                      {selectedItem.full_name.toLowerCase()}
                    </h3>
                    <p className="text-xs text-emerald-300 font-medium">
                      Household submission record
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/25 rounded-lg text-white transition-colors cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5 flex-1">
                {/* Information cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Barangay</span>
                    <span className="text-sm font-bold text-slate-800 capitalize mt-1 block">
                      {selectedItem.barangay ? selectedItem.barangay.toLowerCase() : 'Not Set'}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Purok</span>
                    <span className="text-sm font-bold text-slate-800 capitalize mt-1 block">
                      {selectedItem.purok ? selectedItem.purok.toLowerCase() : '—'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Existing Account Verification Status</span>
                    {selectedItem.existingAccVerified ? (
                      <span className="text-sm font-extrabold text-emerald-800 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verified Existing Account
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-amber-800 mt-1 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" /> Verification Pending
                      </span>
                    )}
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 bg-white border border-emerald-200 rounded-lg">
                    {selectedItem.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Record Details</h4>
                  
                  <div className="space-y-2 text-xs font-semibold text-slate-600">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="w-3.5 h-3.5" /> Mobile Number
                      </span>
                      <span className="font-mono text-slate-800 font-bold">{selectedItem.contact_number || '—'}</span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <UserCheck className="w-3.5 h-3.5" /> PhilHealth PIN Code
                      </span>
                      <span className="font-mono text-slate-800 font-bold">{selectedItem.pin || '—'}</span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" /> Submission Date
                      </span>
                      <span className="text-slate-800 font-bold">
                        {new Date(selectedItem.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <UserIcon className="w-3.5 h-3.5" /> Submitted By
                      </span>
                      <span className="text-slate-800 font-bold">{selectedItem.submittedBy}</span>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="w-3.5 h-3.5" /> Geographic Tagging
                      </span>
                      {selectedItem.geotagged && selectedItem.latitude && selectedItem.longitude ? (
                        <span className="text-teal-700 font-bold font-mono">
                          {selectedItem.latitude.toFixed(6)}, {selectedItem.longitude.toFixed(6)}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-normal">No coordinate telemetry available</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer focus:outline-none"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
