import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, 
  FileSpreadsheet, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Upload, 
  Globe, 
  Image as ImageIcon,
  RotateCcw,
  Save,
  ShieldCheck,
  User,
  Lock,
  Menu
} from 'lucide-react';
import { SheetsStatus } from '../types.js';
import { DEFAULT_SITE_LOGO } from '../App.js';

interface SettingsPageProps {
  authToken: string | null;
  sheetsStatus?: SheetsStatus;
  loadingSheets: boolean;
  onSyncComplete: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  siteSettings: {
    title: string;
    faviconTitle: string;
    logoDataUrl: string;
    faviconDataUrl: string;
    navDashboard?: string;
    navMap?: string;
    navDirectory?: string;
    navRecentUpload?: string;
    navAccounts?: string;
    navBulk?: string;
    navPrint?: string;
    navAdmins?: string;
    navSettings?: string;
    navExistingAccount?: string;
    navExistAccFiles?: string;
    navVerificationEntry?: string;
    rolePermissions?: Record<string, string[]>;
  };
  onSettingsSaved: (updated: any) => void;
}

const DEFAULT_ROLES = [
  'MASTER ADMIN',
  'IT',
  'LEADER',
  'CO-LEADER',
  'ADMIN',
  'ENCODER',
  'STAFF'
];

const APP_PAGES = [
  { id: 'dashboard', name: 'Dashboard', desc: 'Main overview & statistics' },
  { id: 'map', name: 'Clinic Map', desc: 'Geotagged patient map' },
  { id: 'directory', name: 'Clinic Directory', desc: 'Patient records & search' },
  { id: 'exist-acc-files', name: 'Exist. Acc. Files', desc: 'Patient uploaded archives and records list' },
  { id: 'member-verification', name: 'Member verification', desc: 'Search and verify clinical or community membership accounts' },
  { id: 'verification-entry', name: 'Verification Entry', desc: 'Sleek interface to search patients and submit a verification entry record' },
  { id: 'recent-upload', name: 'Recent Upload', desc: 'Private PCU upload archives' },
  { id: 'accounts', name: 'Account Management', desc: 'User accounts & roles' },
  { id: 'bulk', name: 'Bulk Entry', desc: 'CSV & batch patient imports' },
  { id: 'print', name: 'Print List', desc: 'Formatted printable directory' },
  { id: 'existing-account', name: 'Existing Account', desc: 'Directory of patient records flagged as existing accounts' },
  { id: 'admins', name: 'Admin Credentials', desc: 'Administrator username and credentials management' },
  { id: 'settings', name: 'Website Settings', desc: 'Branding & access rules' }
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  authToken,
  sheetsStatus,
  loadingSheets,
  onSyncComplete,
  showToast,
  siteSettings,
  onSettingsSaved
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<'branding' | 'nav' | 'roles'>('branding');
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form States
  const [title, setTitle] = useState(siteSettings.title);
  const [faviconTitle, setFaviconTitle] = useState(siteSettings.faviconTitle);
  const [logoDataUrl, setLogoDataUrl] = useState(siteSettings.logoDataUrl);
  const [faviconDataUrl, setFaviconDataUrl] = useState(siteSettings.faviconDataUrl);
  const [navDashboard, setNavDashboard] = useState(siteSettings.navDashboard || 'Dashboard');
  const [navMap, setNavMap] = useState(siteSettings.navMap || 'Clinic Map');
  const [navDirectory, setNavDirectory] = useState(siteSettings.navDirectory || 'Clinic Directory');
  const [navRecentUpload, setNavRecentUpload] = useState(siteSettings.navRecentUpload || 'Recent Upload');
  const [navAccounts, setNavAccounts] = useState(siteSettings.navAccounts || 'Account Management');
  const [navBulk, setNavBulk] = useState(siteSettings.navBulk || 'Bulk Entry');
  const [navPrint, setNavPrint] = useState(siteSettings.navPrint || 'Print List');
  const [navAdmins, setNavAdmins] = useState(siteSettings.navAdmins || 'Admin Credentials');
  const [navSettings, setNavSettings] = useState(siteSettings.navSettings || 'Website Settings');
  const [navExistingAccount, setNavExistingAccount] = useState(siteSettings.navExistingAccount || 'Existing Account');
  const [navExistAccFiles, setNavExistAccFiles] = useState(siteSettings.navExistAccFiles || 'Exist. Acc. Files');
  const [navVerificationEntry, setNavVerificationEntry] = useState(siteSettings.navVerificationEntry || 'Verification Entry');

  // Roles & Permissions States
  const [rolesList, setRolesList] = useState<string[]>(DEFAULT_ROLES);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(() => {
    return siteSettings.rolePermissions || {
      'MASTER ADMIN': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'verification-entry', 'settings'],
      'IT': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'verification-entry', 'settings'],
      'ADMIN': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'verification-entry', 'settings'],
      'Administrator': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'verification-entry', 'settings'],
      'LEADER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account', 'verification-entry'],
      'CO-LEADER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account', 'verification-entry'],
      'ENCODER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account', 'verification-entry'],
      'STAFF': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account', 'verification-entry']
    };
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Toggle page access for a specific role
  const togglePageForRole = (roleName: string, pageId: string) => {
    setRolePermissions(prev => {
      const roleUpper = roleName.toUpperCase();
      const actualKey = Object.keys(prev).find(k => k.toUpperCase() === roleUpper) || roleName;
      const current = prev[actualKey] || [];
      const updated = current.includes(pageId)
        ? current.filter(p => p !== pageId)
        : [...current, pageId];
      return { ...prev, [actualKey]: updated };
    });
  };

  const grantAllPages = (roleName: string) => {
    setRolePermissions(prev => {
      const roleUpper = roleName.toUpperCase();
      const actualKey = Object.keys(prev).find(k => k.toUpperCase() === roleUpper) || roleName;
      return {
        ...prev,
        [actualKey]: APP_PAGES.map(p => p.id)
      };
    });
  };

  const clearAllPages = (roleName: string) => {
    setRolePermissions(prev => {
      const roleUpper = roleName.toUpperCase();
      const actualKey = Object.keys(prev).find(k => k.toUpperCase() === roleUpper) || roleName;
      return {
        ...prev,
        [actualKey]: []
      };
    });
  };

  // Fetch Base44 roles on mount
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch('/api/base44/roles');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.roles) && data.roles.length > 0) {
            setRolesList(data.roles);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch roles:', err);
      }
    };
    fetchRoles();
  }, []);

  // Sync state if initial siteSettings changes
  useEffect(() => {
    setTitle(siteSettings.title);
    setFaviconTitle(siteSettings.faviconTitle);
    if (siteSettings.logoDataUrl !== undefined) {
      setLogoDataUrl(siteSettings.logoDataUrl);
    }
    if (siteSettings.faviconDataUrl !== undefined) {
      setFaviconDataUrl(siteSettings.faviconDataUrl);
    }
    setNavDashboard(siteSettings.navDashboard || 'Dashboard');
    setNavMap(siteSettings.navMap || 'Clinic Map');
    setNavDirectory(siteSettings.navDirectory || 'Clinic Directory');
    setNavRecentUpload(siteSettings.navRecentUpload || 'Recent Upload');
    setNavAccounts(siteSettings.navAccounts || 'Account Management');
    setNavBulk(siteSettings.navBulk || 'Bulk Entry');
    setNavPrint(siteSettings.navPrint || 'Print List');
    setNavAdmins(siteSettings.navAdmins || 'Admin Credentials');
    setNavSettings(siteSettings.navSettings || 'Website Settings');
    setNavExistingAccount(siteSettings.navExistingAccount || 'Existing Account');
    setNavExistAccFiles(siteSettings.navExistAccFiles || 'Exist. Acc. Files');
    setNavVerificationEntry(siteSettings.navVerificationEntry || 'Verification Entry');
    if (siteSettings.rolePermissions) {
      setRolePermissions(siteSettings.rolePermissions);
    }
  }, [siteSettings]);

  // Convert Date in local friendly format
  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Trigger Google Sheet database synchronization
  const handleSync = async () => {
    if (!authToken) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync with Google Sheets.');
      }
      showToast(data.message || 'Successfully synchronized with Google Sheets Database!', 'success');
      onSyncComplete();
    } catch (err: any) {
      showToast(err.message, 'error');
      onSyncComplete();
    } finally {
      setSyncing(false);
    }
  };

  // Convert file upload to base64 data URL with client-side optimization and resizing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', 'error');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showToast('Image size should be less than 50MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;

      // Optimize and resize the image client-side to standard logo/favicon size (max 256x256).
      // This ensures excellent visual quality while maintaining extremely compact base64 strings
      // that sync reliably to Google Sheets.
      const img = new Image();
      img.src = base64String;
      img.onload = () => {
        const maxWidth = 256;
        const maxHeight = 256;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Try to export as PNG first to preserve transparency for brand layouts
          let finalBase64 = canvas.toDataURL('image/png');
          // If PNG exceeds 40,000 chars, compress as JPEG to stay safely within limits
          if (finalBase64.length > 40000) {
            finalBase64 = canvas.toDataURL('image/jpeg', 0.85);
          }

          if (type === 'logo') {
            setLogoDataUrl(finalBase64);
            showToast('Website Logo uploaded and optimized! Click Save to persist changes.', 'info');
          } else if (type === 'favicon') {
            setFaviconDataUrl(finalBase64);
            showToast('Favicon uploaded and optimized! Click Save to persist changes.', 'info');
          }
        } else {
          // Fallback if canvas fails
          if (type === 'logo') {
            setLogoDataUrl(base64String);
            showToast('Website Logo updated! Click Save to persist.', 'info');
          } else if (type === 'favicon') {
            setFaviconDataUrl(base64String);
            showToast('Favicon updated! Click Save to persist.', 'info');
          }
        }
      };
      img.onerror = () => {
        if (type === 'logo') {
          setLogoDataUrl(base64String);
        } else if (type === 'favicon') {
          setFaviconDataUrl(base64String);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // Save branding customizations to the backend
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;

    if (!title.trim()) {
      showToast('Website title cannot be empty.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/site/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          title: title.trim(),
          faviconTitle: faviconTitle.trim() || 'Saint Francis Clinic',
          logoDataUrl,
          faviconDataUrl,
          navDashboard: navDashboard.trim() || 'Dashboard',
          navMap: navMap.trim() || 'Clinic Map',
          navDirectory: navDirectory.trim() || 'Clinic Directory',
          navRecentUpload: navRecentUpload.trim() || 'Recent Upload',
          navAccounts: navAccounts.trim() || 'Account Management',
          navBulk: navBulk.trim() || 'Bulk Entry',
          navPrint: navPrint.trim() || 'Print List',
          navAdmins: navAdmins.trim() || 'Admin Credentials',
          navSettings: navSettings.trim() || 'Website Settings',
          navExistingAccount: navExistingAccount.trim() || 'Existing Account',
          navExistAccFiles: navExistAccFiles.trim() || 'Exist. Acc. Files',
          navVerificationEntry: navVerificationEntry.trim() || 'Verification Entry',
          rolePermissions
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save branding settings.');
      }

      showToast('Website branding and titles successfully updated!', 'success');
      onSettingsSaved(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reset to original default clinic layout branding
  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all branding settings to defaults?')) {
      setTitle('Saint Francis Clinic Directory');
      setFaviconTitle('Saint Francis Clinic');
      setLogoDataUrl('');
      setFaviconDataUrl('');
      setNavDashboard('Dashboard');
      setNavMap('Clinic Map');
      setNavDirectory('Clinic Directory');
      setNavRecentUpload('Recent Upload');
      setNavAccounts('Account Management');
      setNavBulk('Bulk Entry');
      setNavPrint('Print List');
      setNavAdmins('Admin Credentials');
      setNavSettings('Website Settings');
      setNavExistingAccount('Existing Account');
      setNavExistAccFiles('Exist. Acc. Files');
      setNavVerificationEntry('Verification Entry');
      showToast('Form reset to default presets. Make sure to click Save to persist!', 'info');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Intro Banner Card */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 md:p-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold font-display">Website Settings & Branding</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-xl">
                Configure clinic identity, browser titles, custom logos, dynamic favicons, and manage real-time synchronization with your Google Sheets Database.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tab Bar */}
      <div className="flex items-center gap-2 sm:gap-3 border-b border-slate-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSettingsTab('branding')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'branding'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          General & Branding
        </button>
        <button
          type="button"
          onClick={() => setActiveSettingsTab('nav')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'nav'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Menu className="w-4 h-4" />
          Navigation Link Titles
        </button>
        <button
          type="button"
          onClick={() => setActiveSettingsTab('roles')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'roles'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Role Page Access Control
        </button>
      </div>

      {activeSettingsTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Side: Branding Form */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 font-display">Branding & Metadata</h4>
                  <p className="text-[11px] text-slate-500">Customize the look and name of your clinic portal</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Titles Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Website Title (Browser Tab)
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all font-medium text-slate-800 text-sm outline-none"
                      placeholder="e.g. Saint Francis Clinic Directory"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Short Title (Sidebar & Header)
                    </label>
                    <input
                      type="text"
                      value={faviconTitle}
                      onChange={(e) => setFaviconTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all font-medium text-slate-800 text-sm outline-none"
                      placeholder="e.g. Saint Francis Clinic"
                    />
                  </div>
                </div>

                {/* Uploads Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                  {/* Logo Upload Card */}
                  <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 flex flex-col items-center text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 self-start mb-3">
                      Website Logo (Sidebar)
                    </span>
                    
                    <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2 mb-4 shadow-xs">
                      <img src={logoDataUrl || DEFAULT_SITE_LOGO} alt="Logo preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>

                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={(e) => handleFileUpload(e, 'logo')}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Logo
                    </button>
                    {logoDataUrl && logoDataUrl !== DEFAULT_SITE_LOGO && (
                      <button
                        type="button"
                        onClick={() => setLogoDataUrl(DEFAULT_SITE_LOGO)}
                        className="text-[10px] text-rose-500 hover:underline mt-2 font-semibold cursor-pointer"
                      >
                        Reset to default logo
                      </button>
                    )}
                  </div>

                  {/* Favicon Upload Card */}
                  <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 flex flex-col items-center text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 self-start mb-3">
                      Favicon Icon (Browser Tab)
                    </span>

                    <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2 mb-4 shadow-xs">
                      <img src={faviconDataUrl || DEFAULT_SITE_LOGO} alt="Favicon preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>

                    <input
                      type="file"
                      ref={faviconInputRef}
                      onChange={(e) => handleFileUpload(e, 'favicon')}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => faviconInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Favicon
                    </button>
                    {faviconDataUrl && faviconDataUrl !== DEFAULT_SITE_LOGO && (
                      <button
                        type="button"
                        onClick={() => setFaviconDataUrl(DEFAULT_SITE_LOGO)}
                        className="text-[10px] text-rose-500 hover:underline mt-2 font-semibold cursor-pointer"
                      >
                        Reset to default favicon
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6">
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    disabled={saving}
                    className="px-3.5 py-2 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Defaults
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Branding Settings
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Side: Google Sheets Database Connection details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 font-display">Database Sync</h4>
                  <p className="text-[11px] text-slate-500">Google Sheets Integration status</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status</span>
                    <div className="mt-1">
                      {loadingSheets ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                          Checking...
                        </span>
                      ) : sheetsStatus?.connected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                          Disconnected
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleSync}
                    disabled={syncing || loadingSheets}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all inline-flex items-center gap-1.5 border cursor-pointer ${
                      syncing
                        ? 'bg-slate-50 text-slate-400 border-slate-200'
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200/50'
                    }`}
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        Sync Now
                      </>
                    )}
                  </button>
                </div>

                {/* Technical Details list */}
                {sheetsStatus && (
                  <div className="space-y-2 text-xs font-mono bg-slate-50/50 border border-slate-100 rounded-xl p-4">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Auth Method:</span>
                      <span className="text-slate-700 font-semibold">{sheetsStatus.config.authType || 'apiKey'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Sheet Name:</span>
                      <span className="text-slate-700 font-semibold">{sheetsStatus.config.sheetName || 'Sheet1'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Spreadsheet ID:</span>
                      <span className="text-slate-700 font-semibold truncate max-w-[120px]" title={sheetsStatus.config.spreadsheetId || ''}>
                        {sheetsStatus.config.spreadsheetId || 'None'}
                      </span>
                    </div>
                    {sheetsStatus.lastSuccess && (
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Last Sync:</span>
                        <span className="text-slate-700 font-semibold">{formatTime(sheetsStatus.lastSuccess)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Instructions details if disconnected */}
                {sheetsStatus && !sheetsStatus.connected && (
                  <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-rose-950">
                          Connection Failed
                        </p>
                        <p className="text-[10px] text-rose-800 leading-normal font-mono break-all whitespace-pre-wrap">
                          {sheetsStatus.error || 'Check environment configurations.'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-rose-100/50 text-[10px] text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-700">How to fix:</p>
                      <ul className="list-disc pl-3.5 space-y-1 text-slate-600">
                        <li>Configure <code>SPREADSHEET_ID</code> and <code>PRIVATE_KEY</code> in Google AI Studio Settings.</li>
                        <li>Share your Google Sheet with: <code className="bg-white px-1 py-0.5 rounded select-all border border-slate-200">{sheetsStatus.config.clientEmail || 'your-service-account@email'}</code> as <b>Editor</b>.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMIZE NAVIGATION LINK TITLES */}
      {activeSettingsTab === 'nav' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Menu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 font-display">Customize Navigation Link Titles</h4>
                <p className="text-[11px] text-slate-500">Rename the sidebar menu link titles to match your clinic's terminology</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer self-start sm:self-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Link Titles
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dashboard Link Title
                </label>
                <input
                  type="text"
                  value={navDashboard}
                  onChange={(e) => setNavDashboard(e.target.value)}
                  placeholder="e.g. Dashboard"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Clinic Map Link Title
                </label>
                <input
                  type="text"
                  value={navMap}
                  onChange={(e) => setNavMap(e.target.value)}
                  placeholder="e.g. Clinic Map"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Clinic Directory Link Title
                </label>
                <input
                  type="text"
                  value={navDirectory}
                  onChange={(e) => setNavDirectory(e.target.value)}
                  placeholder="e.g. Clinic Directory"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Recent Upload Link Title
                </label>
                <input
                  type="text"
                  value={navRecentUpload}
                  onChange={(e) => setNavRecentUpload(e.target.value)}
                  placeholder="e.g. Recent Upload"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Account Management Link Title
                </label>
                <input
                  type="text"
                  value={navAccounts}
                  onChange={(e) => setNavAccounts(e.target.value)}
                  placeholder="e.g. Account Management"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Bulk Entry Link Title
                </label>
                <input
                  type="text"
                  value={navBulk}
                  onChange={(e) => setNavBulk(e.target.value)}
                  placeholder="e.g. Bulk Entry"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Print List Link Title
                </label>
                <input
                  type="text"
                  value={navPrint}
                  onChange={(e) => setNavPrint(e.target.value)}
                  placeholder="e.g. Print List"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Website Settings Link Title
                </label>
                <input
                  type="text"
                  value={navSettings}
                  onChange={(e) => setNavSettings(e.target.value)}
                  placeholder="e.g. Website Settings"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Existing Account Link Title
                </label>
                <input
                  type="text"
                  value={navExistingAccount}
                  onChange={(e) => setNavExistingAccount(e.target.value)}
                  placeholder="e.g. Existing Account"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Exist. Acc. Files Link Title
                </label>
                <input
                  type="text"
                  value={navExistAccFiles}
                  onChange={(e) => setNavExistAccFiles(e.target.value)}
                  placeholder="e.g. Exist. Acc. Files"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Verification Entry Link Title
                </label>
                <input
                  type="text"
                  value={navVerificationEntry}
                  onChange={(e) => setNavVerificationEntry(e.target.value)}
                  placeholder="e.g. Verification Entry"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Admin Credentials Link Title
                </label>
                <input
                  type="text"
                  value={navAdmins}
                  onChange={(e) => setNavAdmins(e.target.value)}
                  placeholder="e.g. Admin Credentials"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={handleResetSettings}
                disabled={saving}
                className="px-3.5 py-2 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Link Titles
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ROLE PAGE ACCESS CONTROL */}
      {activeSettingsTab === 'roles' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 font-display">Role Page Access Control</h4>
                <p className="text-[11px] text-slate-500">Configure permitted application pages/tabs for each Base44 database role</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Permissions
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {rolesList.map((roleName) => {
              const roleUpper = roleName.toUpperCase();
              const actualKey = Object.keys(rolePermissions).find(k => k.toUpperCase() === roleUpper) || roleName;
              const allowedPages = rolePermissions[actualKey] || [];
              
              let roleBadgeColor = "bg-slate-100 text-slate-700 border-slate-200";
              if (roleName === 'MASTER ADMIN') roleBadgeColor = "bg-purple-100 text-purple-800 border-purple-200";
              else if (roleName === 'IT') roleBadgeColor = "bg-blue-100 text-blue-800 border-blue-200";
              else if (roleName === 'ADMIN' || roleName === 'Administrator') roleBadgeColor = "bg-indigo-100 text-indigo-800 border-indigo-200";
              else if (roleName === 'LEADER') roleBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
              else if (roleName === 'CO-LEADER') roleBadgeColor = "bg-teal-100 text-teal-800 border-teal-200";
              else if (roleName === 'ENCODER') roleBadgeColor = "bg-amber-100 text-amber-800 border-amber-200";
              else if (roleName === 'STAFF') roleBadgeColor = "bg-slate-100 text-slate-800 border-slate-200";

              return (
                <div key={roleName} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase border ${roleBadgeColor}`}>
                        {roleName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ({allowedPages.length} / {APP_PAGES.length} pages enabled)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => grantAllPages(roleName)}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                      >
                        Grant All
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAllPages(roleName)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 px-2 py-1 rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Page access toggles */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                    {APP_PAGES.map((page) => {
                      const isChecked = allowedPages.includes(page.id);
                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => togglePageForRole(roleName, page.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0 pr-1">
                            <p className="text-xs font-bold truncate leading-tight">{page.name}</p>
                            <p className={`text-[9px] truncate ${isChecked ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {page.desc}
                            </p>
                          </div>
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isChecked ? 'bg-white text-emerald-700' : 'bg-slate-100 text-slate-300'
                          }`}>
                            {isChecked ? '✓' : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Role Permissions
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
