import { useState, useEffect } from 'react';
import {
  Users,
  MapPin,
  FileSpreadsheet,
  Printer,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  UserPlus,
  Loader2,
  Lock,
  Menu,
  X,
  Settings,
  ChevronDown,
  User,
  UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Contact, DashboardStats } from './types.js';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast.js';
import { Login } from './components/Login.js';
import { Dashboard } from './components/Dashboard.js';
import { ContactForm } from './components/ContactForm.js';
import { ContactTable } from './components/ContactTable.js';
import { BulkImport } from './components/BulkImport.js';
import { PrintPreview } from './components/PrintPreview.js';
import { AdminManagement } from './components/AdminManagement.js';
import { AccountManagement } from './components/AccountManagement.js';
import { SettingsPage } from './components/SettingsPage.js';
import { ProfileModal } from './components/ProfileModal.js';
import { ClinicMap } from './components/ClinicMap.js';
import { RecentUpload } from './components/RecentUpload.js';

export const DEFAULT_SITE_LOGO = 'https://www.image2url.com/r2/default/images/1785037750375-501bcf0e-4b15-4e0e-8be2-610bc89d072e.png';

export default function App() {
  // Authentication & Session States
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('dir_auth_token'));
  const [adminUser, setAdminUser] = useState<{ username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null>(() => {
    const saved = localStorage.getItem('dir_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation Panel Routing
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'directory' | 'recent-upload' | 'accounts' | 'bulk' | 'print' | 'admins' | 'settings'>('dashboard');
  
  // Mobile Navigation Drawer Open State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Profile Header Dropdown Menu State
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleTabChange = (tab: 'dashboard' | 'map' | 'directory' | 'recent-upload' | 'accounts' | 'bulk' | 'print' | 'admins' | 'settings') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Branding Customization & Role Permissions States
  const [siteSettings, setSiteSettings] = useState<{
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
    rolePermissions?: Record<string, string[]>;
  }>({
    title: 'SFC HOUSEHOLD DATA LIST',
    faviconTitle: 'SFC HOUSEHOLD DATA LIST',
    logoDataUrl: DEFAULT_SITE_LOGO,
    faviconDataUrl: DEFAULT_SITE_LOGO,
    navDashboard: 'Dashboard',
    navMap: 'Clinic Map',
    navDirectory: 'Clinic Directory',
    navRecentUpload: 'Recent Upload',
    navAccounts: 'Account Management',
    navBulk: 'Bulk Entry',
    navPrint: 'Print List',
    navAdmins: 'Admin Credentials',
    navSettings: 'Website Settings'
  });

  const userRole = adminUser?.role || 'STAFF';
  const isSuperUser = ['MASTER ADMIN', 'IT', 'ADMIN', 'Administrator', 'Master Admin'].includes(userRole);

  const hasTabPermission = (tabId: string) => {
    // Safety check: Prevent lockouts for administrative roles
    const usernameLower = adminUser?.username?.toLowerCase() || '';
    const roleUpper = userRole.toUpperCase();
    const isAdminAccount = usernameLower === 'admin' || 
                           roleUpper === 'MASTER ADMIN' || 
                           roleUpper === 'ADMINISTRATOR';

    if (isAdminAccount && (tabId === 'settings' || tabId === 'accounts')) {
      return true;
    }

    // Check custom role permissions case-insensitively
    if (siteSettings?.rolePermissions) {
      const matchingKey = Object.keys(siteSettings.rolePermissions).find(
        (key) => key.toUpperCase() === roleUpper
      );
      if (matchingKey) {
        const rolePerms = siteSettings.rolePermissions[matchingKey];
        if (Array.isArray(rolePerms)) {
          return rolePerms.includes(tabId);
        }
      }
    }

    // Default fallbacks if no customized permissions are configured
    if (isSuperUser) return true;
    if (tabId === 'settings' || tabId === 'accounts') return false;
    return true;
  };

  const fetchSettings = () => {
    fetch('/api/site/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          const logo = data.logoDataUrl || DEFAULT_SITE_LOGO;
          const favicon = data.faviconDataUrl || DEFAULT_SITE_LOGO;
          setSiteSettings({
            ...data,
            logoDataUrl: logo,
            faviconDataUrl: favicon
          });
          if (data.title) {
            document.title = data.title;
          }
          // Update favicon link
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = favicon;
        }
      })
      .catch(err => {
        // Prevent console error noise for transient network errors (e.g., during dev server restarts)
        if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
          console.warn('Site settings fetch suspended (server starting/restarting).');
        } else {
          console.error('Error fetching site settings:', err);
        }
      });
  };

  // Fetch settings on load, focus, and via polling
  useEffect(() => {
    fetchSettings();

    const handleFocus = () => {
      fetchSettings();
    };

    window.addEventListener('focus', handleFocus);
    const interval = setInterval(fetchSettings, 15000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Redirect if current active tab is not permitted for user's role
  useEffect(() => {
    if (adminUser && !hasTabPermission(activeTab)) {
      const allTabs = ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print'];
      const allowed = allTabs.find(t => hasTabPermission(t));
      if (allowed) {
        setActiveTab(allowed as any);
      }
    }
  }, [adminUser, siteSettings.rolePermissions, activeTab]);

  // Directory Table Action Triggers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [mapNavigateContact, setMapNavigateContact] = useState<Contact | null>(null);

  // Stats State
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Animated Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType, duration?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch Dashboard Summary Stats
  const fetchStats = async () => {
    if (!authToken) return;
    setLoadingStats(true);
    try {
      const res = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(data.error || 'Failed to refresh statistics.');
      }
      setDashboardStats(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchCurrentUser = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setAdminUser(data.user);
        localStorage.setItem('dir_admin_user', JSON.stringify(data.user));
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    if (authToken) {
      fetchStats();
      fetchCurrentUser();
    }
  }, [authToken]);

  // Initial automatic sync and background periodic polling
  useEffect(() => {
    if (!authToken) return;

    let isMounted = true;

    // Trigger initial automatic sync on load/login so the database is always updated immediately
    const triggerInitialSync = async (retries = 2) => {
      try {
        console.log('[App Auto-Sync] Triggering initial automatic Base44 sync...');
        const res = await fetch('/api/contacts/sync-base44', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        });
        if (!isMounted) return;
        const data = await res.json();
        if (res.ok) {
          console.log('[App Auto-Sync] Initial Base44 sync completed successfully:', data);
          setLastSyncTime(new Date().toISOString());
          fetchStats();
        } else {
          console.warn('[App Auto-Sync] Initial sync completed with warning:', data?.error || 'Sync warning');
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (retries > 0) {
          console.log(`[App Auto-Sync] Retrying initial sync in 2s... (${retries} retries left)`);
          setTimeout(() => {
            if (isMounted) triggerInitialSync(retries - 1);
          }, 2000);
        } else {
          console.warn('[App Auto-Sync] Initial Base44 sync deferred (server connection pending):', err?.message || err);
        }
      }
    };

    triggerInitialSync();

    return () => {
      isMounted = false;
    };
  }, [authToken]);

  const handleLoginSuccess = (token: string, user: { username: string; role: string }) => {
    localStorage.setItem('dir_auth_token', token);
    localStorage.setItem('dir_admin_user', JSON.stringify(user));
    setAuthToken(token);
    setAdminUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('dir_auth_token');
    localStorage.removeItem('dir_admin_user');
    setAuthToken(null);
    setAdminUser(null);
    setIsMobileMenuOpen(false);
    showToast('Admin session logged out successfully.', 'success');
  };

  // Handles Quick Shortcut Actions from Dashboard Card Links
  const handleQuickAction = (action: 'add' | 'bulk' | 'print') => {
    setIsMobileMenuOpen(false);
    if (action === 'add') {
      setActiveTab('directory');
      setEditTarget(null);
      setIsFormOpen(true);
    } else if (action === 'bulk') {
      setActiveTab('bulk');
    } else if (action === 'print') {
      setActiveTab('print');
    }
  };

  // Triggers Single Contact Form Saves (Add or Edit update commits)
  const handleSaveContact = async (contact: {
    full_name: string;
    address: string;
    contact_number: string;
  }): Promise<boolean> => {
    if (!authToken) return false;

    try {
      const isEdit = editTarget !== null;
      const url = isEdit ? `/api/contacts/${editTarget.id}` : '/api/contacts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(contact)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Action failed.');
      }

      showToast(
        isEdit
          ? `Successfully updated contact record details for "${data.full_name}".`
          : `Contact record "${data.full_name}" registered successfully.`,
        'success'
      );

      // Reset and trigger stats reload
      setIsFormOpen(false);
      setEditTarget(null);
      fetchStats();
      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const handleEditTrigger = (contact: Contact) => {
    setEditTarget(contact);
    setIsFormOpen(true);
    // Smooth scroll to form view on small devices
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authToken || !adminUser) {
    return (
      <div className="font-sans antialiased bg-slate-50">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <Login onLoginSuccess={handleLoginSuccess} showToast={showToast} siteSettings={siteSettings} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col md:flex-row font-sans antialiased print:h-auto print:overflow-visible">
      {/* Toast Overlay notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        authToken={authToken}
        adminUser={adminUser}
        onAdminUserUpdated={(user, newToken) => {
          setAdminUser(user);
          localStorage.setItem('dir_admin_user', JSON.stringify(user));
          if (newToken) {
            setAuthToken(newToken);
            localStorage.setItem('dir_auth_token', newToken);
          }
        }}
        showToast={showToast}
      />

      {/* Backdrop overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden no-print"
        />
      )}

      {/* Primary Sidebar Control Panel - Hides when printing */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 text-slate-100 flex flex-col shrink-0 no-print border-r border-emerald-900/40 shadow-2xl transition-transform duration-300 ease-in-out
        md:static md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-emerald-900/40 bg-gradient-to-r from-emerald-900/40 via-emerald-800/20 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={siteSettings.logoDataUrl || DEFAULT_SITE_LOGO} 
              alt="Logo" 
              className="w-9 h-9 rounded-xl object-contain bg-white border border-emerald-800/40 shadow-sm" 
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="font-bold text-white font-display text-sm tracking-wide leading-tight">
                {siteSettings.faviconTitle || 'Saint Francis Clinic'}
              </h1>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mt-0.5">
                Clinic Directory
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Navigation Sidebar List */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {([
            { id: 'dashboard', label: siteSettings.navDashboard || 'Dashboard', icon: LayoutDashboard },
            { id: 'map', label: siteSettings.navMap || 'Clinic Map', icon: MapPin },
            { id: 'directory', label: siteSettings.navDirectory || 'Patient List', icon: Users },
            { id: 'recent-upload', label: siteSettings.navRecentUpload || 'Recent Upload', icon: UploadCloud },
            { id: 'accounts', label: siteSettings.navAccounts || 'Account Management', icon: ShieldCheck },
            { id: 'bulk', label: siteSettings.navBulk || 'Bulk Entry', icon: FileSpreadsheet },
            { id: 'print', label: siteSettings.navPrint || 'Print List', icon: Printer },
          ] as const)
            .filter((item) => hasTabPermission(item.id))
            .map((item) => {
              const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative overflow-hidden group focus:outline-none ${
                  isActive
                    ? 'text-white'
                    : 'text-emerald-100/70 hover:text-white hover:bg-emerald-900/30 border border-transparent hover:border-emerald-800/30'
                }`}
              >
                {/* Slidable active tab background capsule */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabGlow"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.35)] -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}

                {/* Pulsing indicator/border on hover (Framer Motion) */}
                <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                  {isActive ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-100"></span>
                    </>
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-emerald-700/40 group-hover:bg-emerald-400 group-hover:scale-125 transition-all duration-300"></span>
                  )}
                </span>

                <div className="relative flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 transition-all duration-300 ${
                    isActive 
                      ? 'text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.2)]' 
                      : 'text-emerald-300/60 group-hover:text-emerald-200 group-hover:rotate-6'
                  }`} />
                  <span className="truncate tracking-widest">{item.label}</span>
                </div>

                {/* Elegant subtle hover overlay ripple/pulse animation */}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </motion.button>
            );
          })}
        </nav>

        {/* Sidebar Navigation Footer */}
        <div className="p-4 border-t border-emerald-900/40 bg-slate-950/40 text-center text-[10px] text-emerald-400/80 font-bold tracking-widest uppercase shrink-0">
          © 2026 {siteSettings.faviconTitle || 'Saint Francis Clinic'}
        </div>

      </aside>

      {/* Main Panel Content Window */}
      <main className="flex-1 min-w-0 overflow-y-auto print:overflow-visible print:h-auto">
        {/* Header - Single unified header for both desktop & mobile */}
        <header className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 border-b border-emerald-900/40 py-3.5 sm:py-4 px-4 sm:px-6 md:px-8 flex items-center justify-between no-print sticky top-0 z-40 text-white shadow-lg shadow-black/20 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-emerald-200 hover:text-white bg-emerald-900/50 hover:bg-emerald-900 rounded-xl transition-all cursor-pointer border border-emerald-800/40 shrink-0 shadow-xs"
              title="Open navigation menu"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img 
              src={siteSettings.logoDataUrl || DEFAULT_SITE_LOGO} 
              alt="Logo" 
              className="md:hidden w-8 h-8 rounded-lg object-contain bg-white border border-emerald-800/30 shrink-0" 
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg md:text-xl font-bold text-white font-display capitalize truncate">
                {activeTab === 'bulk' 
                  ? (siteSettings.navBulk || 'Bulk Entry Import') 
                  : activeTab === 'print' 
                    ? (siteSettings.navPrint || 'Formatted Print Directory') 
                    : activeTab === 'directory' 
                      ? (siteSettings.navDirectory || 'Clinic Directory') 
                      : activeTab === 'recent-upload'
                        ? (siteSettings.navRecentUpload || 'Recent Upload')
                        : activeTab === 'accounts'
                          ? (siteSettings.navAccounts || 'Account Management')
                          : activeTab === 'admins' 
                            ? (siteSettings.navAdmins || 'Admin Credentials') 
                            : activeTab === 'settings'
                              ? (siteSettings.navSettings || 'Website Settings')
                              : activeTab === 'map'
                                ? (siteSettings.navMap || 'Clinic Map')
                                : (siteSettings.navDashboard || 'Dashboard Overview')}
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-300/80 mt-0.5 truncate hidden sm:block">
                Secure directory workspace • {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live System Status Pill */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/60 border border-emerald-800/60 text-[11px] text-emerald-300 font-semibold shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>System Online</span>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer focus:outline-none"
                title="View administrator details & options"
              >
                {adminUser.avatarDataUrl ? (
                  <img
                    src={adminUser.avatarDataUrl}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover shadow-md shadow-emerald-900/30 border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold shadow-md shadow-emerald-900/30">
                    {adminUser.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold leading-tight">
                    {adminUser.displayName || `@${adminUser.username}`}
                  </p>
                  <p className="text-[10px] text-emerald-300/80 leading-tight capitalize">{adminUser.role}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-emerald-300/80 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <>
                    {/* Invisible backdrop layer to dismiss dropdown when clicking away */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsProfileDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-slate-800"
                    >
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
                        {adminUser.avatarDataUrl ? (
                          <img
                            src={adminUser.avatarDataUrl}
                            alt="avatar"
                            className="w-10 h-10 rounded-full object-cover border border-slate-100"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                            {adminUser.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {adminUser.displayName || `@${adminUser.username}`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate">
                            {adminUser.displayName ? `@${adminUser.username}` : adminUser.role}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setIsProfileModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 font-semibold text-xs text-left transition-colors cursor-pointer border-b border-slate-100"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        Profile Settings
                      </button>
                      
                      {hasTabPermission('settings') && (
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            handleTabChange('settings');
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 font-semibold text-xs text-left transition-colors cursor-pointer border-b border-slate-100"
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          {siteSettings.navSettings || 'Website Settings'}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-semibold text-xs text-left transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Log Out Session
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Tab Router Panels */}
        <div className="p-4 sm:p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard
                  stats={dashboardStats}
                  onQuickAction={handleQuickAction}
                  loading={loadingStats}
                  authToken={authToken}
                  onSyncComplete={fetchStats}
                  showToast={showToast}
                />
              )}

              {activeTab === 'map' && (
                <ClinicMap
                  authToken={authToken}
                  showToast={showToast}
                  initialNavigateContact={mapNavigateContact}
                  onClearInitialNavigateContact={() => setMapNavigateContact(null)}
                  lastSyncTime={lastSyncTime}
                />
              )}

              {activeTab === 'directory' && (
                <div className="space-y-6">
                  {/* Single Contact Registration / Edit Slide Drawer Form */}
                  {isFormOpen && (
                    <ContactForm
                      editTarget={editTarget}
                      onSave={handleSaveContact}
                      onCancel={() => {
                        setIsFormOpen(false);
                        setEditTarget(null);
                      }}
                      showToast={showToast}
                    />
                  )}

                  {/* Main Database Grid View */}
                  <ContactTable
                    authToken={authToken}
                    lastSyncTime={lastSyncTime}
                    onEdit={handleEditTrigger}
                    onDeleted={fetchStats}
                    showToast={showToast}
                    siteSettings={siteSettings}
                    currentUser={adminUser}
                    onNavigateToMap={(contact) => {
                      setMapNavigateContact(contact);
                      setActiveTab('map');
                    }}
                  />
                </div>
              )}

              {activeTab === 'recent-upload' && (
                <RecentUpload
                  authToken={authToken}
                  currentUsername={adminUser.username}
                  isAdmin={isSuperUser || userRole.toUpperCase().includes('ADMIN')}
                  showToast={showToast}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountManagement
                  authToken={authToken}
                  currentUsername={adminUser.username}
                  showToast={showToast}
                />
              )}

              {activeTab === 'bulk' && (
                <BulkImport
                  authToken={authToken}
                  onImportComplete={fetchStats}
                  onCancel={() => setActiveTab('dashboard')}
                  showToast={showToast}
                />
              )}

              {activeTab === 'print' && (
                <PrintPreview
                  authToken={authToken}
                  adminUser={adminUser.username}
                  onClose={() => setActiveTab('dashboard')}
                  showToast={showToast}
                  siteSettings={siteSettings}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPage
                  authToken={authToken}
                  sheetsStatus={dashboardStats?.sheetsStatus}
                  loadingSheets={loadingStats}
                  onSyncComplete={fetchStats}
                  showToast={showToast}
                  siteSettings={siteSettings}
                  onSettingsSaved={(updated) => {
                    setSiteSettings(updated);
                    if (updated.title) {
                      document.title = updated.title;
                    }
                    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
                    if (!link) {
                      link = document.createElement('link');
                      link.rel = 'icon';
                      document.getElementsByTagName('head')[0].appendChild(link);
                    }
                    if (updated.faviconDataUrl) {
                      link.href = updated.faviconDataUrl;
                    } else {
                      link.href = '/favicon.ico';
                    }
                  }}
                  adminUser={adminUser}
                  onAdminUserUpdated={(user, newToken) => {
                    setAdminUser(user);
                    localStorage.setItem('dir_admin_user', JSON.stringify(user));
                    if (newToken) {
                      setAuthToken(newToken);
                      localStorage.setItem('dir_auth_token', newToken);
                    }
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
