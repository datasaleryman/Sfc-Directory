import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Edit2, Trash2, Eye, FileText, ArrowDownToLine, Loader2, Calendar, MapPin, Phone, User, Clock, ChevronLeft, ChevronRight, Check, Folder, FolderOpen, ArrowLeft, Grid, List, Plus, Layers, Navigation, Upload, Image, UserCheck, ShieldCheck, CheckSquare, Square, BarChart3 } from 'lucide-react';
import { Contact } from '../types.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';

export interface BarangayFolderInfo {
  barangay: string;
  count: number;
  purokCount: number;
  geotaggedCount: number;
}

interface ContactTableProps {
  authToken: string;
  onEdit: (contact: Contact) => void;
  onDeleted: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  siteSettings?: {
    title: string;
    faviconTitle: string;
    logoDataUrl: string;
    faviconDataUrl: string;
  };
  onNavigateToMap?: (contact: Contact) => void;
  lastSyncTime?: string | null;
  currentUser?: {
    username: string;
    role: string;
    barangay?: string;
  } | null;
}

export const ContactTable: React.FC<ContactTableProps> = ({
  authToken,
  onEdit,
  onDeleted,
  showToast,
  siteSettings,
  onNavigateToMap,
  lastSyncTime,
  currentUser
}) => {
  // Role permissions check for LEADER and CO-LEADER
  const userRoleNormalized = (currentUser?.role || '').toUpperCase();
  const isLeaderOrCoLeader = userRoleNormalized === 'LEADER' || userRoleNormalized === 'CO-LEADER' || userRoleNormalized.includes('LEADER');
  const isAdmin = userRoleNormalized === 'ADMINISTRATOR';
  const userBarangay = currentUser?.barangay || '';

  // Folder View state vs Table View
  const [activeFolder, setActiveFolder] = useState<string | null>(null); // null = Folder Overview, string = specific Barangay folder
  const [folderSearch, setFolderSearch] = useState('');
  const [isChartExpanded, setIsChartExpanded] = useState(true);
  const [chartMetric, setChartMetric] = useState<'households' | 'puroks' | 'all'>('all');

  // Query Filter States
  const [search, setSearch] = useState('');
  const [addressFilter, setAddressFilter] = useState('All Barangays');
  const [purokFilter, setPurokFilter] = useState('All Puroks');
  const [sortBy, setSortBy] = useState<'name' | 'address' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Loaded DB data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [allAddresses, setAllAddresses] = useState<string[]>([]);
  const [allPuroks, setAllPuroks] = useState<string[]>([]);
  const [barangayFolders, setBarangayFolders] = useState<BarangayFolderInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // Export state
  const [exporting, setExporting] = useState<string | null>(null);

  // Active Modals state
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  // Designate Barangay Folder state
  const [userAccounts, setUserAccounts] = useState<Array<{ username: string; email: string; fullName: string; barangay: string; role: string; status: string }>>([]);
  const [designateModalOpen, setDesignateModalOpen] = useState(false);
  const [sourceDesignateBarangay, setSourceDesignateBarangay] = useState<string>('');
  const [targetDesignateBarangay, setTargetDesignateBarangay] = useState<string>('');
  const [savingDesignation, setSavingDesignation] = useState(false);

  const fetchUserAccounts = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setUserAccounts(data);
      }
    } catch (err: any) {
      if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        console.warn('User accounts fetch suspended (server starting/restarting).');
      } else {
        console.error('Failed to fetch user accounts:', err);
      }
    }
  };

  useEffect(() => {
    fetchUserAccounts();
  }, [authToken]);

  const handleOpenDesignateModal = (sourceName?: string) => {
    const src = sourceName || activeFolder || (barangayFolders[0]?.barangay || '');
    setSourceDesignateBarangay(src);
    
    // Pick target default from allAddresses that is different from src if possible
    const availableTargets = allAddresses.filter(a => a && a !== 'All Barangays' && a.trim().toLowerCase() !== src.trim().toLowerCase());
    const target = availableTargets[0] || (src || 'Navalan');
    setTargetDesignateBarangay(target);
    setDesignateModalOpen(true);
  };

  const handleSaveDesignation = async () => {
    if (!targetDesignateBarangay.trim()) {
      showToast('Please select or enter a target Barangay name.', 'warning');
      return;
    }

    setSavingDesignation(true);
    try {
      const res = await fetch('/api/admin/designate-barangay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          sourceBarangay: sourceDesignateBarangay.trim(),
          barangay: targetDesignateBarangay.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to designate barangay folder.');
      }

      showToast(data.message || `Barangay "${targetDesignateBarangay}" folder designated successfully!`, 'success');
      setDesignateModalOpen(false);
      
      // Refresh user accounts and contact list
      fetchUserAccounts();
      fetchContacts();

      // If active folder was transferred, switch active folder view to target folder
      if (activeFolder && sourceDesignateBarangay && activeFolder.trim().toLowerCase() === sourceDesignateBarangay.trim().toLowerCase()) {
        setActiveFolder(targetDesignateBarangay.trim());
        setAddressFilter(targetDesignateBarangay.trim());
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingDesignation(false);
    }
  };

  // Syncing Base44 state
  const [syncing, setSyncing] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);

  const handleSyncSheets = async () => {
    setSyncingSheets(true);
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync with Google Sheets Database.');
      }
      showToast(data.message || 'Google Sheets Database synchronized live!', 'success');
      fetchContacts(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSyncingSheets(false);
    }
  };

  const [imageUploading, setImageUploading] = useState(false);
  const [pcuUploading, setPcuUploading] = useState(false);
  const [stagedPcuFiles, setStagedPcuFiles] = useState<{ fileName: string; fileData: string; size: number }[]>([]);

  useEffect(() => {
    setStagedPcuFiles([]);
  }, [viewContact]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewContact) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file (PNG, JPG, etc.)', 'error');
      return;
    }

    setImageUploading(true);
    try {
      const base64Data = await convertFileToBase64(file);
      const res = await fetch(`/api/contacts/${viewContact.id}/photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ photoDataUrl: base64Data })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload photo.');
      }

      const updatedContact = await res.json();
      setViewContact(updatedContact);
      setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
      showToast('Image photo uploaded successfully!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setImageUploading(false);
    }
  };

  const handlePCUFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files) as File[];
    
    const newStagedFiles: { fileName: string; fileData: string; size: number }[] = [];
    for (const file of filesArray) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`File "${file.name}" exceeds the 5MB size limit.`, 'error');
        continue;
      }
      try {
        const base64Data = await convertFileToBase64(file);
        newStagedFiles.push({
          fileName: file.name,
          fileData: base64Data,
          size: file.size
        });
      } catch (err) {
        console.error(err);
        showToast(`Failed to read file "${file.name}".`, 'error');
      }
    }
    
    if (newStagedFiles.length > 0) {
      setStagedPcuFiles(prev => [...prev, ...newStagedFiles]);
    }
    e.target.value = '';
  };

  const removeStagedPcuFile = (index: number) => {
    setStagedPcuFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handlePCUSubmit = async () => {
    if (!viewContact || stagedPcuFiles.length === 0) return;

    setPcuUploading(true);
    try {
      const res = await fetch(`/api/contacts/${viewContact.id}/pcu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fullName: viewContact.full_name,
          files: stagedPcuFiles.map(f => ({ fileName: f.fileName, fileData: f.fileData }))
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload files.');
      }

      setViewContact(null);
      setStagedPcuFiles([]);
      fetchContacts();
      showToast(`Successfully uploaded ${stagedPcuFiles.length} file(s)! Member "${viewContact.full_name}" has been transferred to Recent Upload.`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPcuUploading(false);
    }
  };

  const handleSyncBase44 = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/contacts/sync-base44', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync with Base44 Database.');
      }
      showToast(data.message || 'Successfully synchronized with Base44 Database!', 'success');
      fetchContacts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Fetch paginated database contacts list
  const fetchContacts = async (forceSync: boolean = false) => {
    setLoading(true);
    try {
      let currentBarangay = activeFolder ? activeFolder : (addressFilter === 'All Barangays' ? 'All Addresses' : addressFilter);
      if (isLeaderOrCoLeader && userBarangay) {
        currentBarangay = userBarangay;
      }

      const queryParams = new URLSearchParams({
        search,
        address: currentBarangay,
        purok: purokFilter === 'All Puroks' ? 'All Puroks' : purokFilter,
        sortBy,
        sortOrder,
        page: page.toString(),
        limit: limit.toString(),
        sync: forceSync ? 'true' : 'false'
      });

      const res = await fetch(`/api/contacts?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch contacts list.');
      }

      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setAllPuroks(data.allPuroks || []);

      if (isLeaderOrCoLeader && userBarangay) {
        setAllAddresses([userBarangay]);
        if (Array.isArray(data.barangayFolders)) {
          const filtered = data.barangayFolders.filter(
            (f: BarangayFolderInfo) => f.barangay.trim().toLowerCase() === userBarangay.trim().toLowerCase()
          );
          setBarangayFolders(filtered);
        }
      } else {
        setAllAddresses(data.allAddresses || []);
        if (Array.isArray(data.barangayFolders)) {
          setBarangayFolders(data.barangayFolders);
        }
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Trigger loading on filter changes
  useEffect(() => {
    fetchContacts();
  }, [search, addressFilter, purokFilter, sortBy, sortOrder, page, activeFolder, lastSyncTime]);

  // Reset page index on filter updates
  useEffect(() => {
    setPage(1);
  }, [search, addressFilter, purokFilter, activeFolder]);

  // Sync on initial mount
  useEffect(() => {
    if (authToken) {
      handleSyncBase44();
    }
  }, [authToken]);

  const handleSort = (field: 'name' | 'address' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Perform soft delete operations
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/contacts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete record.');
      }

      showToast(`Contact "${deleteTarget.full_name}" has been soft-deleted successfully.`, 'success');
      setDeleteTarget(null);
      onDeleted();
      fetchContacts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Bulk soft delete a whole Barangay folder (Admin only)
  const handleDeleteFolderConfirm = async () => {
    if (!deleteFolderTarget) return;
    setDeletingFolder(true);

    try {
      const res = await fetch(`/api/contacts/folder/${encodeURIComponent(deleteFolderTarget)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete folder.');
      }

      showToast(`Barangay folder "${deleteFolderTarget}" has been successfully deleted along with ${data.count} members.`, 'success');
      setDeleteFolderTarget(null);
      setActiveFolder(null); // Return to folders grid overview if they were inside it
      fetchContacts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDeletingFolder(false);
    }
  };

  // Get full list of filtered records for export
  const fetchAllMatchingForExport = async (overrideBarangay?: string): Promise<Contact[]> => {
    const targetBarangay = overrideBarangay || (activeFolder ? activeFolder : (addressFilter === 'All Barangays' ? 'All Addresses' : addressFilter));

    const queryParams = new URLSearchParams({
      search,
      address: targetBarangay,
      purok: purokFilter === 'All Puroks' ? 'All Puroks' : purokFilter,
      sortBy,
      sortOrder
    });

    const res = await fetch(`/api/contacts/export?${queryParams}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to fetch items for export.');
    }

    return await res.json();
  };

  // XLSX Export Handler
  const handleExportExcel = async (overrideBarangay?: string) => {
    const folderName = overrideBarangay || activeFolder || 'All_Barangays';
    setExporting(`Excel-${folderName}`);
    try {
      const data = await fetchAllMatchingForExport(overrideBarangay);
      if (data.length === 0) {
        showToast('No directory records match current criteria to export.', 'warning');
        return;
      }

      const formattedData = data.map((item, index) => ({
        '#': index + 1,
        'Full Name': item.full_name,
        'Barangay': item.barangay || '',
        'Purok': item.purok || '',
        'Contact Number': item.contact_number,
        'Geotagged': item.geotagged ? 'Yes' : 'No',
        'Date Recorded': formatDate(item.created_at)
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Household Directory');

      const fileName = `Saint_Francis_Directory_${folderName.replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showToast(`Excel spreadsheet generated with ${data.length} records!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  // PDF Export Handler
  const handleExportPDF = async (overrideBarangay?: string) => {
    const folderName = overrideBarangay || activeFolder || 'All_Barangays';
    setExporting(`PDF-${folderName}`);
    try {
      const data = await fetchAllMatchingForExport(overrideBarangay);
      if (data.length === 0) {
        showToast('No directory records match current criteria to export.', 'warning');
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFillColor(16, 185, 129); // Emerald header banner
      doc.rect(0, 0, 297, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(siteSettings?.faviconTitle || 'Saint Francis Clinic Directory', 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Official Household Directory - Folder: ${folderName}`, 14, 18);

      const tableData = data.map((item, index) => [
        (index + 1).toString(),
        item.full_name,
        item.barangay || '',
        item.purok || '',
        item.contact_number,
        item.geotagged ? 'Geotagged' : 'Standard',
        formatDate(item.created_at)
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['#', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Location Status', 'Date Added']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { top: 30, left: 14, right: 14, bottom: 20 }
      });

      doc.save(`Saint_Francis_Directory_${folderName.replace(/\s+/g, '_')}.pdf`);
      showToast(`PDF report generated successfully for ${folderName}!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  // Open a Barangay Folder
  const openFolder = (barangayName: string) => {
    if (isLeaderOrCoLeader && userBarangay && barangayName.trim().toLowerCase() !== userBarangay.trim().toLowerCase()) {
      showToast(`Access restricted: Your account is assigned to Barangay ${userBarangay}`, 'warning');
      return;
    }
    setActiveFolder(barangayName);
    setAddressFilter(barangayName);
    setSearch('');
    setPurokFilter('All Puroks');
    setPage(1);
  };

  // Filter Barangay Folders grid
  const rawFiltered = barangayFolders.filter(f => {
    if (isLeaderOrCoLeader && userBarangay) {
      if (f.barangay.trim().toLowerCase() !== userBarangay.trim().toLowerCase()) {
        return false;
      }
    }
    return f.barangay.toLowerCase().includes(folderSearch.toLowerCase().trim());
  });

  const filteredFolders = (isLeaderOrCoLeader && userBarangay && rawFiltered.length === 0)
    ? [{ barangay: userBarangay, count: total, purokCount: allPuroks.length, geotaggedCount: contacts.filter(c => c.geotagged).length }]
    : rawFiltered;

  const maxHouseholds = Math.max(...barangayFolders.map(f => f.count), 1);
  const maxPuroks = Math.max(...barangayFolders.map(f => f.purokCount), 1);

  return (
    <div className="space-y-6">
      {/* View Switcher Breadcrumb Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {activeFolder ? (
            <button
              onClick={() => {
                setActiveFolder(null);
                setAddressFilter(isLeaderOrCoLeader && userBarangay ? userBarangay : 'All Barangays');
              }}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Barangay Folders
            </button>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Folder className="w-5 h-5 text-emerald-700" />
            </div>
          )}

          <div>
            <h2 className="text-lg font-extrabold text-slate-800 font-display flex items-center gap-2">
              {activeFolder ? (
                <>
                  <FolderOpen className="w-5 h-5 text-emerald-600" />
                  {activeFolder} Folder
                </>
              ) : (
                'Saint Francis Clinic Directory Folders'
              )}
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {activeFolder
                ? `Showing member records stored inside ${activeFolder}`
                : isLeaderOrCoLeader && userBarangay
                  ? `Assigned Barangay Folder for ${currentUser?.role || 'Leader'}: ${userBarangay}`
                  : `Organized into ${barangayFolders.length} Barangay Folders from Base44 Database`}
            </p>
          </div>
        </div>

        {/* Global Auto Sync Badge & Controls */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleSyncSheets}
            disabled={syncingSheets || loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
            title="Refresh and sync live data from Google Sheets Database"
          >
            {syncingSheets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-emerald-200" />}
            {syncingSheets ? 'Refreshing Sheets...' : 'Sync Google Sheets ↻'}
          </button>

          <button
            onClick={handleSyncBase44}
            disabled={syncing || loading}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
            title="Force synchronization with Base44 Database"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5 text-emerald-300" />}
            {syncing ? 'Syncing...' : 'Base44 Auto-Synced ✓'}
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: BARANGAY FOLDERS OVERVIEW GRID */}
      {!activeFolder && (
        <div className="space-y-6">
          {/* Barangay Summary & Analytics Panel */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/50 shadow-inner">
                  <BarChart3 className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 font-display">
                    Barangay Summary Analytics
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Overview of members and puroks across all folders
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                <div className="flex flex-wrap items-center bg-slate-50 p-1 rounded-xl border border-slate-200/60 text-xs gap-1 justify-center sm:justify-start">
                  <button
                    onClick={() => setChartMetric('all')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      chartMetric === 'all'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/40'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Metrics
                  </button>
                  <button
                    onClick={() => setChartMetric('households')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      chartMetric === 'households'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/40'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Members
                  </button>
                  <button
                    onClick={() => setChartMetric('puroks')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      chartMetric === 'puroks'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/40'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Puroks
                  </button>
                </div>

                <button
                  onClick={() => setIsChartExpanded(!isChartExpanded)}
                  className="py-2 px-3 sm:p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 sm:gap-0"
                  title={isChartExpanded ? 'Collapse Analytics' : 'Expand Analytics'}
                >
                  <span className="inline sm:hidden text-xs font-bold text-slate-600">
                    {isChartExpanded ? 'Hide Analytics' : 'Show Analytics'}
                  </span>
                  {isChartExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {isChartExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {/* Executive Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Barangays</p>
                      <p className="text-2xl font-extrabold text-slate-800 font-display mt-1">
                        {barangayFolders.length}
                        <span className="text-slate-400 text-sm font-semibold ml-0.5">
                          /{barangayFolders.reduce((sum, f) => sum + f.purokCount, 0)}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Active folders & puroks</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members</p>
                      <p className="text-2xl font-extrabold text-slate-800 font-display mt-1">
                        {barangayFolders.reduce((sum, f) => sum + f.count, 0)}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Across all folders</p>
                    </div>
                  </div>

                  {/* Ultra-compact Barangay Folders Summary list with no progress bars */}
                  <div className="mt-5 w-full bg-slate-50/30 rounded-2xl border border-slate-100 p-3 sm:p-4">
                    {barangayFolders.length === 0 ? (
                      <div className="h-[120px] flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                        <p className="text-xs text-slate-400 font-bold">Populating analytical data...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                        {barangayFolders.map((f) => (
                          <div 
                            key={f.barangay} 
                            className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl shadow-2xs hover:border-emerald-200/40 hover:shadow-xs transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-extrabold text-slate-700 text-xs truncate" title={f.barangay}>
                                {f.barangay}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 text-[9px] font-black tracking-wide">
                              {(chartMetric === 'all' || chartMetric === 'households') && (
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100/50" title={`${f.count} Members`}>
                                  {f.count} M
                                </span>
                              )}
                              {(chartMetric === 'all' || chartMetric === 'puroks') && (
                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100/50" title={`${f.purokCount} Puroks`}>
                                  {f.purokCount} P
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Folders Search & Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                placeholder="Search Barangay Folder name..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Barangay Quick Select Dropdown fetched from Google Sheet database */}
              <div className="relative min-w-[170px]">
                <select
                  value={addressFilter === 'All Addresses' ? 'All Barangays' : addressFilter}
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (selected === 'All Barangays') {
                      setActiveFolder(null);
                      setAddressFilter('All Barangays');
                    } else {
                      openFolder(selected);
                    }
                  }}
                  className="w-full appearance-none pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-700 font-semibold text-xs outline-none cursor-pointer"
                >
                  <option value="All Barangays">All Barangays (Sheet)</option>
                  {(allAddresses || []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>{filteredFolders.length} Folders</span>
              </div>

              {isAdmin && (
                <button
                  onClick={() => handleOpenDesignateModal()}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs shrink-0"
                  title="Select a designated barangay and make it available to assigned user accounts"
                >
                  <UserCheck className="w-4 h-4 text-emerald-200" />
                  <span>Designate Barangay to Accounts</span>
                </button>
              )}
            </div>
          </div>

          {/* Barangay Folders Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pt-4">
            {filteredFolders.map((folder) => {
              const assignedAccounts = userAccounts.filter(
                u => u.barangay && u.barangay.trim().toLowerCase() === folder.barangay.trim().toLowerCase()
              );
              const assignedCount = assignedAccounts.length;
              const isUserDesignated = userBarangay && userBarangay.trim().toLowerCase() === folder.barangay.trim().toLowerCase();

              return (
                <motion.div
                  key={folder.barangay}
                  whileHover={{ y: -3, transition: { duration: 0.12 } }}
                  onClick={() => openFolder(folder.barangay)}
                  className="relative cursor-pointer group pt-5 flex flex-col h-full min-h-[165px] max-w-[250px] w-full mx-auto sm:mx-0 select-none"
                >
                  {/* Skeuomorphic Folder Tab on Top */}
                  <div className="absolute top-0 left-4 h-6 w-32 bg-amber-100/90 border-t border-x border-amber-300/70 rounded-t-lg group-hover:bg-emerald-50 group-hover:border-emerald-300/80 transition-all duration-300 shadow-2xs flex items-center justify-start px-2.5 z-10">
                    <Folder className="w-3 h-3 text-amber-700 group-hover:text-emerald-700 fill-amber-300/30 group-hover:fill-emerald-300/20 mr-1 shrink-0" />
                    <span className="text-[9px] font-extrabold text-amber-800 group-hover:text-emerald-800 tracking-wider uppercase truncate">
                      {folder.count} {folder.count === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>

                  {/* Physical Folder Body */}
                  <div className="flex-1 bg-amber-50/15 hover:bg-amber-50/35 border border-amber-300/50 rounded-b-2xl rounded-tr-2xl rounded-tl-sm shadow-2xs group-hover:shadow-xs group-hover:border-emerald-400/70 transition-all duration-300 p-4 flex flex-col justify-between relative overflow-hidden z-0">
                    {/* Subtle aesthetic folder paper line design inside the folder */}
                    <div className="absolute right-3 top-3 opacity-[0.02] group-hover:opacity-[0.05] transition-all">
                      <Folder className="w-16 h-16 stroke-1 text-slate-900" />
                    </div>

                    {/* Barangay Details */}
                    <div className="space-y-1">
                      <span className="text-[8px] font-extrabold text-amber-800/60 group-hover:text-emerald-800/60 tracking-wider uppercase block">
                        Barangay Folder
                      </span>
                      <h3 className="text-base font-extrabold text-slate-800 font-display group-hover:text-emerald-800 transition-colors truncate">
                        {folder.barangay}
                      </h3>
                      <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5 bg-white/60 group-hover:bg-emerald-50/60 px-2 py-0.5 rounded-md border border-amber-200/30 group-hover:border-emerald-200/30 w-fit transition-colors">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Ready to browse</span>
                      </p>
                    </div>

                    {/* Folder Action Bar */}
                    <div className="mt-4 pt-2 border-t border-amber-200/30 group-hover:border-emerald-200/30 flex items-center justify-between gap-2 z-10">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportExcel(folder.barangay);
                          }}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-emerald-200/40"
                          title={`Export ${folder.barangay} to Excel`}
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportPDF(folder.barangay);
                          }}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-emerald-200/40"
                          title={`Export ${folder.barangay} to PDF`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDesignateModal(folder.barangay);
                              }}
                              className="p-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/80 bg-emerald-50 border border-emerald-200/70 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title={`Designate ${folder.barangay} folder to accounts`}
                            >
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              <span className="hidden sm:inline">Designate</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteFolderTarget(folder.barangay);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title={`Delete folder ${folder.barangay} & all its members`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: INDIVIDUAL BARANGAY FOLDER HOUSEHOLD RECORDS TABLE */}
      {activeFolder && (
        <div className="space-y-4 sm:space-y-6">
          {/* Search & Purok Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full lg:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400 min-h-[42px]"
                placeholder={`Search inside ${activeFolder}...`}
              />
            </div>

            {/* Filter Dropdown + Export buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
              {/* Barangay Dropdown */}
              <div className="relative w-full sm:w-auto min-w-[160px]">
                <select
                  value={addressFilter === 'All Addresses' ? 'All Barangays' : addressFilter}
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (selected === 'All Barangays') {
                      setActiveFolder(null);
                      setAddressFilter('All Barangays');
                    } else {
                      openFolder(selected);
                    }
                  }}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-700 font-semibold text-xs sm:text-sm outline-none cursor-pointer min-h-[42px]"
                >
                  <option value="All Barangays">All Barangays</option>
                  {(allAddresses || []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* Purok Dropdown */}
              <div className="relative w-full sm:w-auto min-w-[140px]">
                <select
                  value={purokFilter}
                  onChange={(e) => setPurokFilter(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-700 font-semibold text-xs sm:text-sm outline-none cursor-pointer min-h-[42px]"
                >
                  <option value="All Puroks">All Puroks</option>
                  {(allPuroks || []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* Export Controls for this specific folder */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleExportExcel(activeFolder)}
                  disabled={exporting !== null || loading}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
                  title="Export this folder to Excel"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" /> Excel
                </button>
                <button
                  onClick={() => handleExportPDF(activeFolder)}
                  disabled={exporting !== null || loading}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
                  title="Export formatted report to PDF document"
                >
                  {exporting?.startsWith('PDF') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Export PDF
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setDeleteFolderTarget(activeFolder)}
                    className="col-span-2 sm:col-span-1 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
                    title={`Delete folder "${activeFolder}" & all its members`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Folder
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Directory Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs relative">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 select-none">
                  <tr>
                    <th className="py-4 px-5 w-14 text-center">#</th>
                    
                    <th
                      onClick={() => handleSort('name')}
                      className="py-4 px-5 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Full Name
                        {sortBy === 'name' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-600" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300 opacity-60" />
                        )}
                      </div>
                    </th>

                    <th className="py-4 px-5">Barangay</th>
                    <th className="py-4 px-5">Purok</th>
                    <th className="py-4 px-5">Contact Number</th>
                    <th className="py-4 px-5">Location Status</th>

                    <th
                      onClick={() => handleSort('date')}
                      className="py-4 px-5 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Date Added
                        {sortBy === 'date' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-600" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300 opacity-60" />
                        )}
                      </div>
                    </th>

                    <th className="py-4 px-5 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm relative">
                  {loading && contacts.length === 0 ? (
                    [1, 2, 3, 4].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-5 text-center"><div className="h-4 bg-slate-100 rounded w-6 mx-auto" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-44" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-36" /></td>
                        <td className="py-4 px-5"><div className="h-6 bg-slate-100 rounded-lg w-24" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                        <td className="py-4 px-5"><div className="h-8 bg-slate-100 rounded-lg w-28 mx-auto" /></td>
                      </tr>
                    ))
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 px-5 text-center text-slate-400">
                        <Folder className="w-10 h-10 mb-3 mx-auto text-slate-300" />
                        <p className="font-semibold text-slate-600">No member records stored in this Barangay folder.</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try clearing search filters or add a new record.</p>
                      </td>
                    </tr>
                  ) : (
                    contacts.map((contact, index) => {
                      const itemIndex = (page - 1) * limit + index + 1;
                      return (
                        <tr 
                          key={contact.id} 
                          onClick={() => setViewContact(contact)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-5 text-center text-xs font-bold text-slate-400">
                            {itemIndex}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-xs flex items-center justify-center border border-emerald-100 shrink-0 overflow-hidden">
                                {contact.photo_url ? (
                                  <img src={contact.photo_url} alt={contact.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  contact.full_name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span>{contact.full_name}</span>
                                {contact.pcu_file_url && (
                                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded w-max mt-0.5 flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" /> PCU Attached
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-slate-700">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-900 text-xs font-bold">
                              <Folder className="w-3 h-3 text-amber-600 fill-amber-300" />
                              {contact.barangay || 'Unassigned'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-slate-600 font-medium">
                            {contact.purok || '-'}
                          </td>
                          <td className="py-3.5 px-5 font-mono text-xs text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {contact.contact_number}
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            {contact.geotagged ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-extrabold">
                                <MapPin className="w-3 h-3 text-teal-600" /> Geotagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold">
                                Standard
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-xs text-slate-400 font-medium">
                            {formatDate(contact.created_at)}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setViewContact(contact); }}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                                className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit contact"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {onNavigateToMap && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onNavigateToMap(contact); }}
                                  className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                                  title="Locate on Map"
                                >
                                  <MapPin className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(contact); }}
                                className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View for Mobile Responsiveness */}
            <div className="block md:hidden divide-y divide-slate-100">
              {loading && contacts.length === 0 ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="p-4 space-y-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-1/2" />
                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                      </div>
                    </div>
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                ))
              ) : contacts.length === 0 ? (
                <div className="py-10 px-4 text-center text-slate-400">
                  <Folder className="w-10 h-10 mb-3 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-600 text-sm">No member records found.</p>
                </div>
              ) : (
                contacts.map((contact, index) => {
                  const itemIndex = (page - 1) * limit + index + 1;
                  return (
                    <div 
                      key={contact.id} 
                      onClick={() => setViewContact(contact)}
                      className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-xs flex items-center justify-center border border-emerald-100 shrink-0 overflow-hidden">
                            {contact.photo_url ? (
                              <img src={contact.photo_url} alt={contact.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              contact.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 text-sm block truncate flex items-center gap-1.5">
                              {contact.full_name}
                              {contact.pcu_file_url && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 text-[9px] font-bold shrink-0">
                                  <Check className="w-2.5 h-2.5" /> PCU
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 font-semibold block">{formatDate(contact.created_at)}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
                          #{itemIndex}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200/40 text-amber-900 font-bold">
                          <Folder className="w-3 h-3 text-amber-600 fill-amber-300" />
                          {contact.barangay || 'Unassigned'}
                        </span>
                        {contact.purok && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-semibold">
                            Purok {contact.purok}
                          </span>
                        )}
                        {contact.geotagged ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-bold">
                            <MapPin className="w-3 h-3 text-teal-600" /> Geotagged
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 font-medium">
                            Standard
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                        <span className="font-mono text-xs text-slate-500 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {contact.contact_number || 'N/A'}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewContact(contact); }}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                            className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit contact"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {onNavigateToMap && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onNavigateToMap(contact); }}
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Locate on Map"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(contact); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-slate-500">
                  Showing Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong> ({total} total records)
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-white text-slate-700 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-white text-slate-700 transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: View Contact Details */}
      <AnimatePresence>
        {viewContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto my-auto"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl overflow-hidden border border-emerald-200/60 shadow-inner shrink-0">
                  {viewContact.photo_url ? (
                    <img src={viewContact.photo_url} alt={viewContact.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    viewContact.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 font-display">{viewContact.full_name}</h3>
                  <p className="text-xs text-slate-400">Directory Member Record Details</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Barangay</span>
                  <span className="font-bold text-slate-800 text-right">{viewContact.barangay}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Purok</span>
                  <span className="font-bold text-slate-800 text-right">{viewContact.purok || 'Not specified'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Contact Number</span>
                  <span className="font-mono font-bold text-slate-800">{viewContact.contact_number}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Geotagged</span>
                  <span className="font-bold text-emerald-600">{viewContact.geotagged ? 'Yes' : 'No'}</span>
                </div>
                {viewContact.pcu_file_url && (
                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5 text-blue-600 animate-pulse" /> PCU File Saved
                    </span>
                    {viewContact.pcu_file_url.startsWith('http') ? (
                      <a 
                        href={viewContact.pcu_file_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="font-bold text-blue-700 hover:underline text-xs truncate max-w-[150px] sm:max-w-[200px] flex items-center gap-1 cursor-pointer"
                        title="Click to view file"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" /> View File
                      </a>
                    ) : (
                      <span className="font-semibold text-blue-900 text-xs truncate max-w-[150px] sm:max-w-[200px]" title={viewContact.pcu_file_url}>{viewContact.pcu_file_url}</span>
                    )}
                  </div>
                )}
              </div>

              {/* File Upload Zone */}
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Upload Directory Files</h4>
                
                <div>
                  {/* Upload PCU Section */}
                  <label className="flex flex-col items-center justify-center p-4 sm:p-5 border border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/10 rounded-2xl cursor-pointer transition-all text-center group w-full">
                    <input 
                      type="file" 
                      multiple
                      onChange={handlePCUFileChange} 
                      disabled={pcuUploading} 
                      className="hidden" 
                    />
                    {pcuUploading ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin mb-1.5" />
                    ) : (
                      <Upload className="w-5 h-5 text-slate-400 mb-1.5 group-hover:text-blue-600 transition-colors" />
                    )}
                    <span className="text-xs font-bold text-slate-700">Select PCU Files</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Supports multiple files selection</span>
                  </label>
                </div>

                {/* Staged Files List */}
                {stagedPcuFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                        Staged for Upload ({stagedPcuFiles.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setStagedPcuFiles([])}
                        className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {stagedPcuFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs">
                          <span className="font-medium text-emerald-900 truncate max-w-[180px] font-mono" title={f.fileName}>
                            {f.fileName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-emerald-700">
                              {(f.size / 1024).toFixed(1)} KB
                            </span>
                            <button
                              type="button"
                              onClick={() => removeStagedPcuFile(idx)}
                              className="text-red-500 hover:text-red-700 font-bold px-1.5 py-0.5 rounded-md hover:bg-red-100 transition-all cursor-pointer"
                              title="Remove file"
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handlePCUSubmit}
                      disabled={pcuUploading}
                      className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px] flex items-center justify-center gap-2 shadow-sm font-display"
                    >
                      {pcuUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Saving to Base44 DB...
                        </>
                      ) : (
                        'Submit'
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-5">
                <button
                  onClick={() => setViewContact(null)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 text-center shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 font-display">Delete Household Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to soft-delete <strong className="text-slate-700">{deleteTarget.full_name}</strong> from directory?
              </p>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Record'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete Folder Confirmation */}
      <AnimatePresence>
        {deleteFolderTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 text-center shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 font-display">Delete Entire Folder?</h3>
              <p className="text-xs text-slate-500 mt-2">
                Are you sure you want to delete the entire <strong className="text-slate-800">Barangay {deleteFolderTarget}</strong> folder?
              </p>
              <p className="text-[11px] text-rose-600 font-bold mt-3 bg-rose-50 p-3 rounded-2xl border border-rose-100/65 leading-normal">
                ⚠️ This will soft-delete ALL member records associated with this Barangay folder from the clinic directory.
              </p>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => setDeleteFolderTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                  disabled={deletingFolder}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteFolderConfirm}
                  disabled={deletingFolder}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
                >
                  {deletingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Folder'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Designate Barangay Folder to Accounts & Automatic Data Transfer */}
      <AnimatePresence>
        {designateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col my-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 font-display">Designate Barangay Folder</h3>
                    <p className="text-xs text-slate-400 font-medium">Transfer folder data & assign account access</p>
                  </div>
                </div>
                <button
                  onClick={() => setDesignateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-left">
                {/* 1. Source / Previous Barangay Folder */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Previous / Source Barangay Folder (To Transfer From)
                  </label>
                  <select
                    value={sourceDesignateBarangay}
                    onChange={(e) => setSourceDesignateBarangay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="">None (Do not transfer records from previous folder)</option>
                    {barangayFolders.map(f => (
                      <option key={f.barangay} value={f.barangay}>
                        {f.barangay} ({f.count} Members)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Select the existing folder whose data will automatically be transferred.
                  </p>
                </div>

                {/* 2. Target Designated Barangay Folder */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Selected / Target Designated Folder (Destination)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetDesignateBarangay}
                      onChange={(e) => setTargetDesignateBarangay(e.target.value)}
                      placeholder="e.g. Dampalan, Navalan, SAN JOSE..."
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                    <select
                      value={targetDesignateBarangay}
                      onChange={(e) => {
                        if (e.target.value) setTargetDesignateBarangay(e.target.value);
                      }}
                      className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[150px]"
                    >
                      <option value="">Select Existing</option>
                      {allAddresses.filter(a => a && a !== 'All Barangays').map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Enter or choose the designated Barangay name from Google Sheet database where all data will be moved.
                  </p>
                </div>

                {/* Data Transfer Notice Card */}
                {sourceDesignateBarangay && targetDesignateBarangay && sourceDesignateBarangay.trim().toLowerCase() !== targetDesignateBarangay.trim().toLowerCase() && (() => {
                  const srcFolder = barangayFolders.find(f => f.barangay.trim().toLowerCase() === sourceDesignateBarangay.trim().toLowerCase());
                  const recCount = srcFolder ? srcFolder.count : 0;

                  return (
                    <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl text-left space-y-1.5">
                      <div className="flex items-center gap-2 font-extrabold text-amber-900 text-xs">
                        <FolderOpen className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Automatic Data Transfer & Folder Removal</span>
                      </div>
                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        All <strong className="text-amber-950 font-extrabold">{recCount} member record(s)</strong> inside previous folder <strong className="text-amber-950">"{sourceDesignateBarangay}"</strong> will automatically be transferred to <strong className="text-emerald-900 font-extrabold">"{targetDesignateBarangay}"</strong>.
                      </p>
                      <div className="pt-1.5 border-t border-amber-200/70 text-[11px] text-amber-900 font-bold flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>The previous folder "{sourceDesignateBarangay}" will be emptied and automatically removed from Clinic Directory.</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Info panel showing accounts assigned to targetDesignateBarangay */}
                {(() => {
                  const matchingAccounts = userAccounts.filter(
                    u => u.barangay && u.barangay.trim().toLowerCase() === targetDesignateBarangay.trim().toLowerCase()
                  );

                  return (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-emerald-700" />
                          Accounts Assigned to {targetDesignateBarangay || 'Selected Barangay'} ({matchingAccounts.length})
                        </label>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Automatic Access
                        </span>
                      </div>

                      {matchingAccounts.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {matchingAccounts.map((account) => (
                            <div
                              key={account.username}
                              className="p-2 bg-white rounded-xl border border-emerald-200/60 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-800">{account.fullName || account.username}</span>
                                <span className="text-slate-400 font-normal ml-1">(@{account.username})</span>
                              </div>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-extrabold text-[10px] rounded-md uppercase">
                                {account.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 font-medium italic p-1">
                          No user accounts are currently assigned to "{targetDesignateBarangay}". When accounts are assigned to this Barangay in Account Management, this folder will automatically be visible to them.
                        </p>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-emerald-200/60 text-[11px] font-medium text-emerald-800">
                        ✓ User accounts assigned to <strong>"{targetDesignateBarangay || 'Selected Barangay'}"</strong> will automatically view this folder and its contents.
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="pt-4 mt-2 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDesignateModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                  disabled={savingDesignation}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDesignation}
                  disabled={savingDesignation}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
                >
                  {savingDesignation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : sourceDesignateBarangay && sourceDesignateBarangay.trim().toLowerCase() !== targetDesignateBarangay.trim().toLowerCase() ? (
                    'Transfer Data & Designate Folder'
                  ) : (
                    'Save Designated Folder'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
