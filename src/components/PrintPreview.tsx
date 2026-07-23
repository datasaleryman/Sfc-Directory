import React, { useState, useEffect, useMemo } from 'react';
import { Printer, X, Loader2, Activity, Search, Filter, Plus, Check, UserPlus, Save } from 'lucide-react';

export interface HouseholdItem {
  id: string | number;
  full_name: string;
  barangay: string;
  purok?: string;
  contact_number?: string;
  created_at?: string;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
  addedToDirectory?: boolean;
}

interface PrintPreviewProps {
  authToken: string;
  adminUser: string;
  onClose?: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  siteSettings: {
    title: string;
    faviconTitle: string;
    logoDataUrl: string;
    faviconDataUrl: string;
    navDashboard?: string;
    navDirectory?: string;
    navBulk?: string;
    navPrint?: string;
    navAdmins?: string;
    navSettings?: string;
  };
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  authToken,
  adminUser,
  onClose,
  showToast,
  siteSettings
}) => {
  const [households, setHouseholds] = useState<HouseholdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | number | null>(null);
  const [datePrinted] = useState(() => new Date().toLocaleString());

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('all');

  // Manual Add Contact Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newBarangay, setNewBarangay] = useState('');
  const [newPurok, setNewPurok] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [savingNewContact, setSavingNewContact] = useState(false);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      showToast('Full Name is required.', 'warning');
      return;
    }
    if (!newBarangay.trim()) {
      showToast('Barangay is required.', 'warning');
      return;
    }

    setSavingNewContact(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: newFullName.trim(),
          barangay: newBarangay.trim(),
          purok: newPurok.trim(),
          contact_number: newContactNumber.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save new contact to database.');
      }

      // Add to local household list so it immediately appears in PRINT LIST
      const newHouseholdItem: HouseholdItem = {
        id: data.id || Date.now(),
        full_name: data.full_name,
        barangay: data.barangay,
        purok: data.purok,
        contact_number: data.contact_number,
        geotagged: true,
        addedToDirectory: true
      };

      setHouseholds(prev => [newHouseholdItem, ...prev]);

      showToast(`Contact "${data.full_name}" added to Print List & saved to Google Sheet database!`, 'success');

      // Reset & close modal
      setNewFullName('');
      setNewBarangay('');
      setNewPurok('');
      setNewContactNumber('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingNewContact(false);
    }
  };

  // Fetch Base44 Household Submissions for Print List page
  const fetchHouseholds = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/base44/households', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch household submissions for print list.');
      }
      setHouseholds(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHouseholds();
  }, [authToken]);

  // Extract unique barangay names for the address filter dropdown
  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    (households || []).forEach(h => {
      if (h && h.barangay) {
        set.add(h.barangay.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [households]);

  // Filter household records based on search query and selected address filter
  const filteredHouseholds = useMemo(() => {
    return (households || []).filter(item => {
      const matchSearch = 
        (item.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.contact_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.purok && item.purok.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.barangay && item.barangay.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchAddress = 
        selectedBarangay === 'all' || 
        (item.barangay && item.barangay.trim().toUpperCase() === selectedBarangay);

      return matchSearch && matchAddress;
    });
  }, [households, searchQuery, selectedBarangay]);

  // Handle +Add List button click
  const handleAddToList = async (item: HouseholdItem) => {
    setAddingId(item.id);
    try {
      const res = await fetch('/api/contacts/add-from-household', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: item.full_name,
          barangay: item.barangay,
          purok: item.purok,
          contact_number: item.contact_number,
          latitude: item.latitude,
          longitude: item.longitude,
          geotagged: item.geotagged
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add household to directory.');
      }

      // Mark local item state as added
      setHouseholds(prev => prev.map(h => h.id === item.id ? { ...h, addedToDirectory: true } : h));

      showToast(
        `Added "${item.full_name}" to Saint Francis Clinic Directory under Barangay ${item.barangay}!`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAddingId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
      
      {/* Interactive Toolbar - Hidden when printing */}
      <div className="flex flex-col gap-5 border-b border-slate-100 pb-5 no-print">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-bold text-slate-800 text-lg font-display">Household Print List & Directory Extractor</h4>
            <p className="text-xs text-slate-500">
              Browse Base44 household entries. Click <strong className="text-emerald-700">+Add List</strong> to save a household to Saint Francis Clinic Directory under its respective Barangay folder.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              +Add Contact
            </button>
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Trigger System Print
            </button>
          </div>
        </div>

        {/* Live Search and Address Filter Dropdown */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search by full name, barangay, or contact number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 placeholder-slate-400 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Address (Barangay) Select Filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Filter className="w-4 h-4" />
              </span>
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 appearance-none cursor-pointer transition-all"
              >
                <option value="all">All Address / Barangays ({uniqueBarangays.length})</option>
                {uniqueBarangays.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-[10px]">
                ▼
              </span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 no-print">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-600" />
          <p className="text-sm font-medium text-slate-600">Loading Base44 Household Print List...</p>
        </div>
      ) : (
        /* Printable Document Sheet */
        <div className="bg-white p-4 md:p-8 max-w-5xl mx-auto border border-slate-100 rounded-xl shadow-xs print:p-0 print:border-none print:shadow-none">
          {/* Print Letterhead Header */}
          <div className="border-b-4 border-emerald-700 pb-5 mb-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div className="flex items-center gap-4.5">
              {siteSettings.logoDataUrl ? (
                <img 
                  src={siteSettings.logoDataUrl} 
                  alt="Clinic Logo" 
                  className="w-16 h-16 object-contain rounded-xl bg-white border border-slate-200/50 p-1 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-900/10 shrink-0 border border-emerald-500/20">
                  <Activity className="w-8 h-8 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.2)]" />
                </div>
              )}
              <div className="text-center md:text-left">
                <h1 className="text-xl md:text-2xl font-extrabold uppercase tracking-wide text-slate-900 font-display">
                  {siteSettings.title ? siteSettings.title.toUpperCase() : 'SAINT FRANCIS CLINIC DIRECTORY'}
                </h1>
                <p className="text-[10px] md:text-xs font-bold text-emerald-700 uppercase tracking-widest mt-0.5">
                  Official Household Submissions & Directory Register
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium italic">
                  Confidential Document • Internal Access Only
                </p>
              </div>
            </div>

            <div className="flex flex-row md:flex-col justify-between md:justify-start gap-4 md:gap-1.5 text-xs text-slate-500 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 w-full md:w-auto font-medium">
              <div className="space-y-0.5 text-left md:text-right">
                <p>Printed By: <strong className="text-slate-800 font-semibold">@{adminUser}</strong></p>
                <p>Date: <strong className="text-slate-800 font-semibold">{datePrinted}</strong></p>
              </div>
              <div className="space-y-0.5 text-right">
                <p>Selection: <strong className="text-slate-800 font-semibold">{selectedBarangay === 'all' ? 'All Barangays' : `Barangay: ${selectedBarangay}`}</strong></p>
                <p>Total Records: <strong className="text-slate-800 font-semibold text-emerald-700">{filteredHouseholds.length}</strong></p>
              </div>
            </div>
          </div>

          {/* Directory Print Table */}
          <div className="overflow-x-auto select-none print:overflow-visible">
            <table className="w-full text-left text-xs border-collapse min-w-[500px] print:min-w-0">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-800">
                <th className="py-2.5 px-3 font-bold text-slate-800 w-12 text-center border border-slate-300">#</th>
                <th className="py-2.5 px-3 font-bold text-slate-800 border border-slate-300">Full Name</th>
                <th className="py-2.5 px-3 font-bold text-slate-800 border border-slate-300">Registered Address (Barangay)</th>
                <th className="py-2.5 px-3 font-bold text-slate-800 border border-slate-300 w-36">Contact Number</th>
                <th className="py-2.5 px-3 font-bold text-slate-800 border border-slate-300 w-32 text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredHouseholds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-medium border border-slate-300">
                    No household records matched the specified search and address filters.
                  </td>
                </tr>
              ) : (
                filteredHouseholds.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono border border-slate-300">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 border border-slate-300">
                      {item.full_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 border border-slate-300">
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] mr-1.5 border border-emerald-200/60 no-print">
                        {item.barangay}
                      </span>
                      <span className="print:inline hidden">{item.barangay}</span>
                      {item.purok ? <span className="text-slate-500 text-[11px]">({item.purok})</span> : null}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800 border border-slate-300">
                      {item.contact_number || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-center border border-slate-300 no-print">
                      {item.addedToDirectory ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <Check className="w-3 h-3" />
                          Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddToList(item)}
                          disabled={addingId === item.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] rounded-lg transition-all shadow-xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                          title={`Add ${item.full_name} to Saint Francis Clinic Directory under Barangay ${item.barangay}`}
                        >
                          {addingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          +add List
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          {/* Print Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
            <p>Generated by Directory Management System</p>
            <p className="print:block hidden">Page 1 of 1</p>
          </div>
        </div>
      )}

      {/* Manual +Add Contact Modal Form */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 font-display text-base">Add New Contact</h3>
                  <p className="text-[11px] text-slate-500">Will be displayed on Print List and saved to Google Sheet database</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Juan De La Cruz"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Barangay <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newBarangay}
                    onChange={(e) => setNewBarangay(e.target.value)}
                    placeholder="e.g. Barangay San Jose"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purok (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPurok}
                    onChange={(e) => setNewPurok(e.target.value)}
                    placeholder="e.g. Purok 3"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contact Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newContactNumber}
                  onChange={(e) => setNewContactNumber(e.target.value)}
                  placeholder="e.g. 09171234567"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={savingNewContact}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewContact}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-600/10 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {savingNewContact ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving to DB...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Contact & Add to List
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
