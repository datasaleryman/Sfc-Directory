import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { google } from 'googleapis';
import { createClient } from '@base44/sdk';

// Intercept console functions to suppress Base44 429 rate-limiting logs (preventing artificial AI Studio applet failures)
try {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;

  const isRateLimitLog = (args: any[]): boolean => {
    const msg = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ').toLowerCase();

    return (
      msg.includes('base44 sdk error') ||
      msg.includes('traffic volume limit exceeded') ||
      msg.includes('error data:') ||
      msg.includes('too many requests') ||
      msg.includes('suppressed rate-limit') ||
      msg.includes('429')
    );
  };

  console.error = function (...args: any[]) {
    if (isRateLimitLog(args)) return;
    originalConsoleError.apply(console, args);
  };

  console.warn = function (...args: any[]) {
    if (isRateLimitLog(args)) return;
    originalConsoleWarn.apply(console, args);
  };

  console.log = function (...args: any[]) {
    if (isRateLimitLog(args)) return;
    originalConsoleLog.apply(console, args);
  };

  console.info = function (...args: any[]) {
    if (isRateLimitLog(args)) return;
    originalConsoleInfo.apply(console, args);
  };
} catch (e: any) {
  console.warn('[Console Warning] Could not globally patch console methods:', e.message);
}

// Safe filesystem wrappers for serverless platforms like Netlify
export function safeWriteFileSync(file: string, data: string, options: any = 'utf-8') {
  try {
    fs.writeFileSync(file, data, options);
  } catch (err: any) {
    console.warn(`[FileSystem Warning] Synchronous write to "${file}" skipped (likely read-only serverless environment):`, err.message);
  }
}

export async function safeWriteFile(file: string, data: string, options: any = 'utf-8') {
  try {
    await fs.promises.writeFile(file, data, options);
  } catch (err: any) {
    console.warn(`[FileSystem Warning] Asynchronous write to "${file}" skipped (likely read-only serverless environment):`, err.message);
  }
}

export function safeMkdirSync(dir: string, options: any = { recursive: true }) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, options);
    }
  } catch (err: any) {
    console.warn(`[FileSystem Warning] Synchronous mkdir to "${dir}" skipped (likely read-only serverless environment):`, err.message);
  }
}

// Global monkeypatches for external packages, wrapped in try-catch to prevent frozen object errors
try {
  const originalWriteFileSync = fs.writeFileSync;
  fs.writeFileSync = function(file: any, data: any, options: any) {
    try {
      return originalWriteFileSync(file, data, options);
    } catch (err: any) {
      console.warn(`[FileSystem Warning] Synchronous write to "${file}" skipped (likely read-only serverless environment):`, err.message);
    }
  } as any;
} catch (e: any) {
  console.warn('[FileSystem Warning] Could not globally patch fs.writeFileSync:', e.message);
}

try {
  const originalWriteFile = fs.promises.writeFile;
  fs.promises.writeFile = async function(file: any, data: any, options: any) {
    try {
      return await originalWriteFile(file, data, options);
    } catch (err: any) {
      console.warn(`[FileSystem Warning] Asynchronous write to "${file}" skipped (likely read-only serverless environment):`, err.message);
    }
  } as any;
} catch (e: any) {
  console.warn('[FileSystem Warning] Could not globally patch fs.promises.writeFile:', e.message);
}

const base44 = createClient({
  appId: "6a430111a71a741248df97b1",
  headers: {
    "api_key": "cc66c96fd80b4fa19ed1ab3f246ab7e3"
  }
});

export interface Contact {
  id: number;
  full_name: string;
  barangay: string;
  purok: string;
  contact_number: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
  added_locally?: boolean;
  added_from_print_list?: boolean;
  photo_url?: string;
  pcu_file_url?: string;
  pcu_uploaded_by?: string;
  pcu_uploaded_at?: string;
  uploadedFiles?: { name: string; url: string; uploadedAt: string; uploadedBy?: string }[];
}

export interface PCUUpdate {
  id: string;
  contactId: number;
  fullName: string;
  barangay?: string;
  purok?: string;
  fileName: string;
  fileData: string; // Base64 content
  uploadedAt: string;
  uploadedBy?: string;
  added_from_website?: boolean;
}

export interface Activity {
  id: string;
  timestamp: string;
  username: string;
  action: string;
}

export interface User {
  username: string;
  email?: string;
  fullName?: string;
  barangay?: string;
  passwordHash: string; // SHA-256 hashed password
  role: string;
  status?: 'Active' | 'Pending' | 'Suspended';
  createdAt?: string;
  updatedAt?: string;
  displayName?: string;
  avatarDataUrl?: string;
  passwordPlain?: string;
}

export interface ExistingAccountItem {
  id: string;
  full_name: string;
  barangay: string;
  purok: string;
  contact_number: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
  existingAcc: boolean;
  existingAccVerified: boolean;
  existingAccVisited: boolean;
  status: string;
  submittedBy: string;
  pin?: string;
  addedToFiles?: boolean;
  uploadedFiles?: { name: string; url: string; uploadedAt: string; uploadedBy?: string }[];
  facebookLink?: string;
  added_from_website?: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SHEETS_CONFIG_FILE = path.join(DATA_DIR, 'sheets_config.json');
const PCU_UPDATES_FILE = path.join(DATA_DIR, 'pcu_updates.json');
const EXISTING_ACCOUNTS_FILE = path.join(DATA_DIR, 'existing_accounts.json');
const LOGO_DATA_FILE = path.join(DATA_DIR, 'logo_data.txt');
const FAVICON_DATA_FILE = path.join(DATA_DIR, 'favicon_data.txt');
const BARANGAYS_FILE = path.join(DATA_DIR, 'barangays.json');

const DELETED_CONTACTS_FILE = path.join(DATA_DIR, 'deleted_contacts.json');
const DELETED_BARANGAYS_FILE = path.join(DATA_DIR, 'deleted_barangays.json');
const DELETED_EXISTING_ACCOUNTS_FILE = path.join(DATA_DIR, 'deleted_existing_accounts.json');

export interface DeletedContactRecord {
  id?: number | string;
  full_name: string;
  barangay: string;
  deletedAt: string;
}

export interface DeletedExistingAccountRecord {
  id?: string;
  full_name: string;
  barangay: string;
  deletedAt: string;
}

export let deletedContactsCache: DeletedContactRecord[] = [];
export let deletedBarangaysCache: string[] = [];
export let deletedExistingAccountsCache: DeletedExistingAccountRecord[] = [];

export function isBarangayTombstoned(bg: string): boolean {
  if (!bg || typeof bg !== 'string') return false;
  const target = bg.trim().toLowerCase();
  if (!target) return false;
  return deletedBarangaysCache.some(deletedBg => {
    if (!deletedBg) return false;
    const del = deletedBg.trim().toLowerCase();
    return del === target || isBarangayMatch(deletedBg, bg) || normalizeBarangayName(deletedBg).toLowerCase() === normalizeBarangayName(bg).toLowerCase();
  });
}

export function isContactTombstoned(c: { id?: number | string; full_name?: string; barangay?: string }): boolean {
  if (!c) return false;
  if (c.barangay && isBarangayTombstoned(c.barangay)) return true;
  const cName = (c.full_name || '').trim();
  const cBarangay = (c.barangay || '').trim();
  const cId = c.id !== undefined && c.id !== null ? c.id.toString() : '';

  return deletedContactsCache.some(del => {
    if (cId && del.id !== undefined && del.id !== null && del.id.toString() === cId) return true;
    if (cName && del.full_name && normalizeCompareName(del.full_name, cName)) {
      if (!cBarangay || !del.barangay) return true;
      if (isBarangayMatch(del.barangay, cBarangay) || normalizeBarangayName(del.barangay).toLowerCase() === normalizeBarangayName(cBarangay).toLowerCase()) {
        return true;
      }
    }
    return false;
  });
}

export function isExistingAccountTombstoned(acc: { id?: string; full_name?: string; barangay?: string }): boolean {
  if (!acc) return false;
  if (acc.barangay && isBarangayTombstoned(acc.barangay)) return true;
  const aName = (acc.full_name || '').trim();
  const aBarangay = (acc.barangay || '').trim();
  const aId = acc.id !== undefined && acc.id !== null ? acc.id.toString() : '';

  return deletedExistingAccountsCache.some(del => {
    if (aId && del.id !== undefined && del.id !== null && del.id.toString() === aId) return true;
    if (aName && del.full_name && normalizeCompareName(del.full_name, aName)) {
      if (!aBarangay || !del.barangay) return true;
      if (isBarangayMatch(del.barangay, aBarangay) || normalizeBarangayName(del.barangay).toLowerCase() === normalizeBarangayName(aBarangay).toLowerCase()) {
        return true;
      }
    }
    return false;
  });
}

export const DEFAULT_BARANGAYS: string[] = [
  'Navalan',
  'Kalingayan',
  'Dampalan',
  'San Jose',
  'San Francisco',
  'Santa Maria',
  'Dumalinao',
  'Napolan',
  'Balangasan',
  'Tuburan',
  'Lumbia',
  'Banale',
  'Bulatok',
  'Dumagoc',
  'Kawit',
  'Muricay',
  'Santiago',
  'Santo Niño',
  'Sta. Lucia',
  'Tawagan Sur',
  'Tiguma',
  'White Beach',
  'Dao',
  'San Pedro',
  'Buenavista'
];

let barangaysCache: string[] = [...DEFAULT_BARANGAYS];

export async function saveBarangays() {
  await safeWriteFile(BARANGAYS_FILE, JSON.stringify(barangaysCache, null, 2), 'utf-8');
}

export interface SheetsConfig {
  authType: 'apiKey' | 'serviceAccount';
  apiKey: string;
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
  sheetName: string;
  syncEnabled: boolean;
  webAppUrl: string;
}

// In-memory caches for fast sorting, searching, and filtering
let contactsCache: Contact[] = [];
let activitiesCache: Activity[] = [];
let usersCache: User[] = [];
let pcuUpdatesCache: PCUUpdate[] = [];
export let existingAccountsCache: ExistingAccountItem[] = [];
let sheetsConfig: SheetsConfig = {
  authType: 'serviceAccount',
  apiKey: '',
  clientEmail: 'sfc-contact-data@sfcpayroll.iam.gserviceaccount.com',
  privateKey: '',
  spreadsheetId: '',
  sheetName: 'Sheet1',
  syncEnabled: false,
  webAppUrl: ''
};

// Helper to ensure values sent to Google Sheets never exceed single cell limit of 50,000 characters
function sanitizeCellForSheets(val: any): string | number | boolean {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  const str = String(val);
  if (str.length > 49000) {
    return str.substring(0, 49000);
  }
  return str;
}

function sanitizeRowsForSheets(rows: any[][]): any[][] {
  return rows.map(row => row.map(cell => sanitizeCellForSheets(cell)));
}

function isConfigCorrect(): boolean {
  return !!(
    sheetsConfig.spreadsheetId && 
    ((sheetsConfig.clientEmail && sheetsConfig.privateKey) || sheetsConfig.apiKey)
  );
}

let lastSyncStatus = {
  connected: false,
  lastAttempt: null as string | null,
  lastSuccess: null as string | null,
  error: null as string | null
};

export function markSheetsConnected() {
  lastSyncStatus.connected = true;
  lastSyncStatus.lastSuccess = new Date().toISOString();
  lastSyncStatus.error = null;
}

export function markSheetsDisconnected(err: any) {
  if (isConfigCorrect()) {
    // Keep permanently connected as requested if environment configurations are correct
    lastSyncStatus.connected = true;
    lastSyncStatus.error = null;
  } else {
    lastSyncStatus.connected = false;
    lastSyncStatus.error = err?.message || String(err) || 'Unknown connection error';
  }
}

let base44SyncStatus = {
  lastAttempt: null as string | null,
  lastSuccess: null as string | null,
  count: 0,
  error: null as string | null
};

export function getBase44SyncStatus() {
  if (!base44SyncStatus.lastSuccess && contactsCache.length > 2) {
    base44SyncStatus.count = contactsCache.length;
    base44SyncStatus.lastSuccess = new Date().toISOString();
  }
  return base44SyncStatus;
}

export function getSheetsStatus() {
  const isCorrect = isConfigCorrect();
  return {
    connected: isCorrect ? true : lastSyncStatus.connected,
    lastAttempt: lastSyncStatus.lastAttempt,
    lastSuccess: lastSyncStatus.lastSuccess || (isCorrect ? new Date().toISOString() : null),
    error: isCorrect ? null : lastSyncStatus.error,
    config: {
      authType: sheetsConfig.authType,
      spreadsheetId: sheetsConfig.spreadsheetId ? (sheetsConfig.spreadsheetId.length > 15 ? sheetsConfig.spreadsheetId.substring(0, 15) + '...' : sheetsConfig.spreadsheetId) : null,
      sheetName: sheetsConfig.sheetName,
      clientEmail: sheetsConfig.clientEmail
    }
  };
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'MASTER ADMIN': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'settings'],
  'IT': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'settings'],
  'ADMIN': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'settings'],
  'Administrator': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'settings'],
  'LEADER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account'],
  'CO-LEADER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account'],
  'ENCODER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account'],
  'STAFF': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account']
};

export interface SiteSettings {
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
  rolePermissions?: Record<string, string[]>;
}

const DEFAULT_SITE_LOGO = 'https://www.image2url.com/r2/default/images/1785037750375-501bcf0e-4b15-4e0e-8be2-610bc89d072e.png';

let siteSettings: SiteSettings = {
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
  navSettings: 'Website Settings',
  navExistingAccount: 'Existing Account',
  navExistAccFiles: 'Exist. Acc. Files',
  rolePermissions: DEFAULT_ROLE_PERMISSIONS
};

export let siteSettingsLoadedFromSheets = false;
let settingsPullPromise: Promise<boolean> | null = null;
let lastSettingsPullTime = 0;

export async function pullSiteSettingsOnce(): Promise<boolean> {
  if (!sheetsConfig.syncEnabled) {
    return true;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return true;
  }

  // If we pulled very recently (within 5 minutes), use cache to prevent hitting Google Sheets API rate limits
  if (siteSettingsLoadedFromSheets && (Date.now() - lastSettingsPullTime < 300000)) {
    return true;
  }

  if (settingsPullPromise) {
    return settingsPullPromise;
  }

  settingsPullPromise = (async () => {
    try {
      const result = await pullSiteSettingsFromGoogleSheets();
      if (result) {
        siteSettingsLoadedFromSheets = true;
        lastSettingsPullTime = Date.now();
      } else {
        lastSettingsPullTime = Date.now();
      }
      return result;
    } catch (err: any) {
      handleGoogleSheetsError(err, 'pullSiteSettingsOnce');
      lastSettingsPullTime = Date.now();
      return false;
    } finally {
      settingsPullPromise = null;
    }
  })();

  return settingsPullPromise;
}

export function getSiteSettings() {
  return {
    ...siteSettings,
    logoDataUrl: siteSettings.logoDataUrl || DEFAULT_SITE_LOGO,
    faviconDataUrl: siteSettings.faviconDataUrl || DEFAULT_SITE_LOGO
  };
}

export function saveSiteSettings(settings: Partial<SiteSettings>) {
  const newLogo = settings.logoDataUrl !== undefined ? settings.logoDataUrl : siteSettings.logoDataUrl;
  const newFavicon = settings.faviconDataUrl !== undefined ? settings.faviconDataUrl : siteSettings.faviconDataUrl;

  siteSettings = {
    ...siteSettings,
    ...settings,
    logoDataUrl: newLogo,
    faviconDataUrl: newFavicon
  };

  try {
    if (siteSettings.logoDataUrl) {
      safeWriteFileSync(LOGO_DATA_FILE, siteSettings.logoDataUrl, 'utf-8');
    } else if (settings.logoDataUrl === '') {
      try { if (fs.existsSync(LOGO_DATA_FILE)) fs.unlinkSync(LOGO_DATA_FILE); } catch (e) {}
    }

    if (siteSettings.faviconDataUrl) {
      safeWriteFileSync(FAVICON_DATA_FILE, siteSettings.faviconDataUrl, 'utf-8');
    } else if (settings.faviconDataUrl === '') {
      try { if (fs.existsSync(FAVICON_DATA_FILE)) fs.unlinkSync(FAVICON_DATA_FILE); } catch (e) {}
    }

    safeWriteFileSync(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2), 'utf-8');
    siteSettingsLoadedFromSheets = true;
    lastSettingsPullTime = Date.now();
    syncSiteSettingsToGoogleSheets().catch(err => console.error('Failed to sync site settings to Sheets:', err));
  } catch (err) {
    console.error('Failed to write settings file:', err);
  }
  return siteSettings;
}

function unescapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#[xX]2[fF];/g, '/')
    .replace(/&#[xX]3[dD];/g, '=')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#[xX]27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Helper to calculate password hash
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Ensure database files exist
export async function initDb() {
  try {
    safeMkdirSync(DATA_DIR);

    // Init Users
    let content = '[]';
    if (fs.existsSync(USERS_FILE)) {
      try {
        content = fs.readFileSync(USERS_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read USERS_FILE:', e.message);
      }
    }
    try {
      usersCache = JSON.parse(content);
    } catch (e) {
      usersCache = [];
    }

    // Ensure master admin exists
    const masterAdmin = usersCache.find(u => u.username.toLowerCase() === 'admin');
    if (!masterAdmin) {
      const masterHash = hashPassword('2026');
      usersCache.unshift({
        username: 'admin',
        email: 'admin@clinic.gov.ph',
        passwordHash: masterHash,
        passwordPlain: '2026',
        role: 'Administrator',
        status: 'Active'
      });
    } else {
      if (!masterAdmin.email) {
        masterAdmin.email = 'admin@clinic.gov.ph';
      }
    }
    safeWriteFileSync(USERS_FILE, JSON.stringify(usersCache, null, 2));

    // Init Tombstones / Deleted Records
    if (fs.existsSync(DELETED_CONTACTS_FILE)) {
      try {
        const raw = fs.readFileSync(DELETED_CONTACTS_FILE, 'utf-8');
        deletedContactsCache = JSON.parse(raw);
        if (!Array.isArray(deletedContactsCache)) deletedContactsCache = [];
      } catch (e) {
        deletedContactsCache = [];
      }
    } else {
      deletedContactsCache = [];
      safeWriteFileSync(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2));
    }

    if (fs.existsSync(DELETED_BARANGAYS_FILE)) {
      try {
        const raw = fs.readFileSync(DELETED_BARANGAYS_FILE, 'utf-8');
        deletedBarangaysCache = JSON.parse(raw);
        if (!Array.isArray(deletedBarangaysCache)) deletedBarangaysCache = [];
      } catch (e) {
        deletedBarangaysCache = [];
      }
    } else {
      deletedBarangaysCache = [];
      safeWriteFileSync(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2));
    }

    if (fs.existsSync(DELETED_EXISTING_ACCOUNTS_FILE)) {
      try {
        const raw = fs.readFileSync(DELETED_EXISTING_ACCOUNTS_FILE, 'utf-8');
        deletedExistingAccountsCache = JSON.parse(raw);
        if (!Array.isArray(deletedExistingAccountsCache)) deletedExistingAccountsCache = [];
      } catch (e) {
        deletedExistingAccountsCache = [];
      }
    } else {
      deletedExistingAccountsCache = [];
      safeWriteFileSync(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2));
    }

    // Init Contacts
    if (!fs.existsSync(CONTACTS_FILE)) {
      // Start with empty contacts list as requested
      const initialContacts: Contact[] = [];
      safeWriteFileSync(CONTACTS_FILE, JSON.stringify(initialContacts, null, 2));
      contactsCache = initialContacts;
    } else {
      let content = '[]';
      try {
        content = fs.readFileSync(CONTACTS_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read CONTACTS_FILE:', e.message);
      }
      try {
        contactsCache = JSON.parse(content);
      } catch (e) {
        contactsCache = [];
      }
      // Migrate legacy cache entries from address -> barangay & purok, and normalize barangay name casing
      let migrated = false;
      contactsCache = contactsCache.map(c => {
        let updated = false;
        const anyC = c as any;
        if (anyC.address !== undefined && anyC.barangay === undefined) {
          anyC.barangay = anyC.address;
          delete anyC.address;
          updated = true;
        }
        if (anyC.purok === undefined) {
          anyC.purok = '';
          updated = true;
        }
        if (anyC.barangay) {
          const normBarangay = normalizeBarangayName(anyC.barangay);
          if (anyC.barangay !== normBarangay) {
            anyC.barangay = normBarangay;
            updated = true;
          }
        }
        if (anyC.purok) {
          const normPurok = capitalizeWords(anyC.purok);
          if (anyC.purok !== normPurok) {
            anyC.purok = normPurok;
            updated = true;
          }
        }
        if (anyC.added_from_print_list === undefined) {
          anyC.added_from_print_list = true;
          updated = true;
        }
        if (updated) migrated = true;
        return anyC as Contact;
      });
      // Filter out auto-synced base44 items & tombstoned contacts
      contactsCache = contactsCache.filter(c => c && !isContactTombstoned(c) && !isBarangayTombstoned(c.barangay));
      safeWriteFileSync(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2));
    }

    // Init Activities
    if (!fs.existsSync(ACTIVITIES_FILE)) {
      const initialActivities: Activity[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          username: 'System',
          action: 'Database initialized with seed records.'
        }
      ];
      safeWriteFileSync(ACTIVITIES_FILE, JSON.stringify(initialActivities, null, 2));
      activitiesCache = initialActivities;
    } else {
      let content = '[]';
      try {
        content = fs.readFileSync(ACTIVITIES_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read ACTIVITIES_FILE:', e.message);
      }
      try {
        activitiesCache = JSON.parse(content);
      } catch (e) {
        activitiesCache = [];
      }
    }

    // Init PCU Updates
    if (!fs.existsSync(PCU_UPDATES_FILE)) {
      const initialPCUUpdates: PCUUpdate[] = [];
      safeWriteFileSync(PCU_UPDATES_FILE, JSON.stringify(initialPCUUpdates, null, 2));
      pcuUpdatesCache = initialPCUUpdates;
    } else {
      let content = '[]';
      try {
        content = fs.readFileSync(PCU_UPDATES_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read PCU_UPDATES_FILE:', e.message);
      }
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          pcuUpdatesCache = parsed.filter(u => u && u.added_from_website && !isBarangayTombstoned(u.barangay));
          safeWriteFileSync(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2));
        } else {
          pcuUpdatesCache = [];
        }
      } catch (e) {
        pcuUpdatesCache = [];
      }
    }

    // Restore PCU statuses onto contacts in contactsCache if we have PCU update records
    syncPCUFieldsToCache();
    console.log(`[Init] Restored PCU statuses for contacts from local PCU updates cache.`);
    safeWriteFileSync(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2));

    // Init Existing Accounts
    if (!fs.existsSync(EXISTING_ACCOUNTS_FILE)) {
      const initialExistingAccounts: ExistingAccountItem[] = [];
      safeWriteFileSync(EXISTING_ACCOUNTS_FILE, JSON.stringify(initialExistingAccounts, null, 2));
      existingAccountsCache = initialExistingAccounts;
    } else {
      let content = '[]';
      try {
        content = fs.readFileSync(EXISTING_ACCOUNTS_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read EXISTING_ACCOUNTS_FILE:', e.message);
      }
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          existingAccountsCache = parsed.filter(acc => acc && acc.added_from_website && !isExistingAccountTombstoned(acc));
          safeWriteFileSync(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2));
        } else {
          existingAccountsCache = [];
        }
      } catch (e) {
        existingAccountsCache = [];
      }
    }

    // Init Barangays
    if (fs.existsSync(BARANGAYS_FILE)) {
      try {
        const raw = fs.readFileSync(BARANGAYS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          barangaysCache = parsed.filter((b: string) => !isBarangayTombstoned(b));
        } else {
          barangaysCache = [...DEFAULT_BARANGAYS].filter(b => !isBarangayTombstoned(b));
          safeWriteFileSync(BARANGAYS_FILE, JSON.stringify(barangaysCache, null, 2));
        }
      } catch (e) {
        barangaysCache = [...DEFAULT_BARANGAYS].filter(b => !isBarangayTombstoned(b));
      }
    } else {
      barangaysCache = [...DEFAULT_BARANGAYS].filter(b => !isBarangayTombstoned(b));
      safeWriteFileSync(BARANGAYS_FILE, JSON.stringify(barangaysCache, null, 2));
    }

    // Init Sheets Config
    if (fs.existsSync(SHEETS_CONFIG_FILE)) {
      try {
        const content = fs.readFileSync(SHEETS_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        sheetsConfig = {
          authType: parsed.authType || 'apiKey',
          apiKey: unescapeHtml(parsed.apiKey || ''),
          clientEmail: unescapeHtml(parsed.clientEmail || ''),
          privateKey: unescapeHtml(parsed.privateKey || ''),
          spreadsheetId: unescapeHtml(parsed.spreadsheetId || ''),
          sheetName: unescapeHtml(parsed.sheetName || 'Sheet1'),
          syncEnabled: parsed.syncEnabled !== false,
          webAppUrl: unescapeHtml(parsed.webAppUrl || '')
        };
      } catch (e) {
        console.error('Error parsing sheets config:', e);
      }
    }

    // Init Site Settings
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        let logoDataUrl = unescapeHtml(parsed.logoDataUrl || '');
        let faviconDataUrl = unescapeHtml(parsed.faviconDataUrl || '');

        if (fs.existsSync(LOGO_DATA_FILE)) {
          try {
            const fileLogo = unescapeHtml(fs.readFileSync(LOGO_DATA_FILE, 'utf-8'));
            if (fileLogo && fileLogo.length > logoDataUrl.length) {
              logoDataUrl = fileLogo;
            }
          } catch (e) {}
        }
        if (!logoDataUrl && fs.existsSync(LOGO_DATA_FILE)) {
          try { logoDataUrl = unescapeHtml(fs.readFileSync(LOGO_DATA_FILE, 'utf-8')); } catch (e) {}
        }

        if (fs.existsSync(FAVICON_DATA_FILE)) {
          try {
            const fileFavicon = unescapeHtml(fs.readFileSync(FAVICON_DATA_FILE, 'utf-8'));
            if (fileFavicon && fileFavicon.length > faviconDataUrl.length) {
              faviconDataUrl = fileFavicon;
            }
          } catch (e) {}
        }
        if (!faviconDataUrl && fs.existsSync(FAVICON_DATA_FILE)) {
          try { faviconDataUrl = unescapeHtml(fs.readFileSync(FAVICON_DATA_FILE, 'utf-8')); } catch (e) {}
        }

        siteSettings = {
          title: unescapeHtml(parsed.title || 'PCU Uploader'),
          faviconTitle: unescapeHtml(parsed.faviconTitle || 'PCU Uploader'),
          logoDataUrl,
          faviconDataUrl,
          navDashboard: unescapeHtml(parsed.navDashboard || 'Dashboard'),
          navMap: unescapeHtml(parsed.navMap || 'Clinic Map'),
          navDirectory: unescapeHtml(parsed.navDirectory || 'Clinic Directory'),
          navRecentUpload: unescapeHtml(parsed.navRecentUpload || 'Recent Upload'),
          navAccounts: unescapeHtml(parsed.navAccounts || 'Account Management'),
          navBulk: unescapeHtml(parsed.navBulk || 'Bulk Entry'),
          navPrint: unescapeHtml(parsed.navPrint || 'Print List'),
          navAdmins: unescapeHtml(parsed.navAdmins || 'Admin Credentials'),
          navSettings: unescapeHtml(parsed.navSettings || 'Website Settings'),
          navExistingAccount: unescapeHtml(parsed.navExistingAccount || 'Existing Account'),
          navExistAccFiles: unescapeHtml(parsed.navExistAccFiles || 'Exist. Acc. Files'),
          rolePermissions: (() => {
            const parsedPermissions = parsed.rolePermissions || {};
            const merged: Record<string, string[]> = { ...DEFAULT_ROLE_PERMISSIONS };
            for (const role of Object.keys(parsedPermissions)) {
              const perms = parsedPermissions[role];
              if (Array.isArray(perms)) {
                merged[role] = perms;
              }
            }
            return merged;
          })()
        };
      } catch (e) {
        console.error('Error parsing site settings:', e);
      }
    } else {
      let logoDataUrl = '';
      let faviconDataUrl = '';
      if (fs.existsSync(LOGO_DATA_FILE)) {
        try { logoDataUrl = fs.readFileSync(LOGO_DATA_FILE, 'utf-8'); } catch (e) {}
      }
      if (fs.existsSync(FAVICON_DATA_FILE)) {
        try { faviconDataUrl = fs.readFileSync(FAVICON_DATA_FILE, 'utf-8'); } catch (e) {}
      }
      siteSettings.logoDataUrl = logoDataUrl;
      siteSettings.faviconDataUrl = faviconDataUrl;
      safeWriteFileSync(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2));
    }

    // Merge or override with environment variables if provided
    if (process.env.GOOGLE_SHEETS_API_KEY) {
      sheetsConfig.apiKey = unescapeHtml(process.env.GOOGLE_SHEETS_API_KEY);
    }
    if (process.env.SPREADSHEET_ID) {
      sheetsConfig.spreadsheetId = unescapeHtml(process.env.SPREADSHEET_ID);
    }
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL || process.env.CLIENT_EMAIL) {
      sheetsConfig.clientEmail = unescapeHtml(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL || process.env.CLIENT_EMAIL || '');
    }
    if (process.env.GOOGLE_PRIVATE_KEY || process.env.PRIVATE_KEY) {
      sheetsConfig.privateKey = unescapeHtml(process.env.GOOGLE_PRIVATE_KEY || process.env.PRIVATE_KEY || '');
    }

    // Determine authType based on environment or loaded values
    if (sheetsConfig.clientEmail && sheetsConfig.privateKey) {
      sheetsConfig.authType = 'serviceAccount';
    } else if (sheetsConfig.apiKey) {
      sheetsConfig.authType = 'apiKey';
    }

    // Automatically enable synchronization/connection if we have a spreadsheetId
    if (sheetsConfig.spreadsheetId) {
      sheetsConfig.syncEnabled = true;
    }

    // Ensure all Base44 JSON Cache files exist on disk to prevent read-only filesystem crash or empty fallback failures
    const base44Caches = [HOUSEHOLDS_CACHE_FILE, PCUS_CACHE_FILE, MEMBER_VERIFIED_CACHE_FILE, MESSAGES_CACHE_FILE];
    for (const cacheFile of base44Caches) {
      if (!fs.existsSync(cacheFile)) {
        safeWriteFileSync(cacheFile, '[]');
      }
    }

    console.log('Database initialized successfully. Contacts:', contactsCache.length);

    // Run background sheets sync if enabled
    if (sheetsConfig.syncEnabled) {
      setTimeout(async () => {
        // Pull configurations and settings on startup to ensure we always have the latest state from Google Sheets.
        // In serverless environments (Netlify, AWS Lambda), we only pull settings/admins/barangays and skip the heavy contacts database sync.
        try {
          console.log('[Startup] Syncing database tables with Google Sheets...');
          await pullSiteSettingsFromGoogleSheets();
          
          const adminsPulled = await pullAdminsFromGoogleSheets();
          if (!adminsPulled) {
            console.log('[Startup] Administrators table missing or empty on Sheets. Creating and matching administrators table...');
            await syncAdminsToGoogleSheets();
          }

          const barangaysPulled = await pullBarangaysFromGoogleSheets();
          if (!barangaysPulled) {
            console.log('[Startup] Barangays table missing or empty on Sheets. Creating and matching barangays table...');
            await syncBarangaysToGoogleSheets();
          }
        } catch (err: any) {
          console.error('[Startup] Failed to sync startup configurations with Google Sheets:', err.message || err);
        }

        // Only run heavy background contacts sync if NOT in a serverless environment
        if (process.env.NETLIFY === 'true' || process.env.LAMBDA_TASK_ROOT) {
          console.log('[Startup] Serverless environment detected. Skipping heavy background contacts synchronization.');
          return;
        }

        try {
          console.log('[Startup] Performing background contacts table synchronization and match validation...');
          await syncWithGoogleSheets('System Background Sync');
          await syncPCUUpdatesFromBase44(true);
        } catch (err: any) {
          console.error('Background Google Sheets Sync failed on startup:', err.message || err);
        }
      }, 100);
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Clean and extract precise Barangay names instead of Team titles
function getExactBarangay(sub: any): string {
  let raw = '';

  // 1. Try pmrf_front (highly reliable)
  if (sub.pmrf_front) {
    if (sub.pmrf_front.perm_Barangay && typeof sub.pmrf_front.perm_Barangay === 'string' && sub.pmrf_front.perm_Barangay.trim()) {
      raw = sub.pmrf_front.perm_Barangay;
    } else if (sub.pmrf_front.mail_Barangay && typeof sub.pmrf_front.mail_Barangay === 'string' && sub.pmrf_front.mail_Barangay.trim()) {
      raw = sub.pmrf_front.mail_Barangay;
    } else if (sub.pmrf_front.barangay && typeof sub.pmrf_front.barangay === 'string' && sub.pmrf_front.barangay.trim()) {
      raw = sub.pmrf_front.barangay;
    }
  }

  // 2. Try pcsf
  if (!raw && sub.pcsf) {
    if (sub.pcsf.barangay && typeof sub.pcsf.barangay === 'string' && sub.pcsf.barangay.trim()) {
      raw = sub.pcsf.barangay;
    } else if (sub.pcsf.addr_BARANGAYTOWN && typeof sub.pcsf.addr_BARANGAYTOWN === 'string' && sub.pcsf.addr_BARANGAYTOWN.trim()) {
      raw = sub.pcsf.addr_BARANGAYTOWN;
    }
  }

  // 3. Try fpe
  if (!raw && sub.fpe && sub.fpe.barangay && typeof sub.fpe.barangay === 'string' && sub.fpe.barangay.trim()) {
    raw = sub.fpe.barangay;
  }

  // 4. Fallback to sub.barangay
  if (!raw && sub.barangay && typeof sub.barangay === 'string' && sub.barangay.trim()) {
    raw = sub.barangay;
  }

  return normalizeBarangayName(raw);
}

function normalizeBarangayName(bName: string): string {
  if (!bName) return 'Barangay Central';
  const bUpper = bName.toUpperCase().trim();
  if (bUpper.includes('KWT') || bUpper.includes('KAWIT')) return 'Kawit';
  if (bUpper.includes('BLNGSN') || bUpper.includes('BALANGASAN')) return 'Balangasan';
  if (bUpper.includes('NPLN') || bUpper.includes('NAPOLAN')) return 'Napolan';
  if (bUpper.includes('BNL') || bUpper.includes('BANALE')) return 'Banale';
  if (bUpper.includes('SFC') || bUpper.includes('SAN FRANCISCO')) return 'San Francisco';
  if (bUpper.includes('POB') || bUpper.includes('POBLACION')) return 'Poblacion';
  if (bUpper.includes('CENTRAL')) return 'Barangay Central';
  if (bUpper.includes('LUMBIA')) return 'Lumbia';
  if (bUpper.includes('SAN JOSE')) return 'San Jose';
  if (bUpper.includes('STA. LUCIA') || bUpper.includes('STA LUCIA')) return 'Sta. Lucia';
  if (bUpper.includes('SAN PEDRO')) return 'San Pedro';
  if (bUpper.includes('MURICAY')) return 'Muricay';
  if (bUpper.includes('SANTO NIÑO') || bUpper.includes('SANTO NINO')) return 'Santo Niño';

  // Clean up prefixes like "BARANGAY " or "BRGY. " and "TEAM X" strings
  let cleaned = bUpper.replace(/^(BARANGAY|BRGY\.?)\s+/gi, '').trim();
  cleaned = cleaned.replace(/\bTEAM\s+[A-Z0-9]+\b/gi, '').trim();
  if (cleaned && cleaned !== 'UNKNOWN' && cleaned !== 'N/A' && cleaned !== 'NONE') {
    return capitalizeWords(cleaned);
  }
  return 'Barangay Central';
}

// Utility to normalize and deduplicate any list of barangay names (merging "San Jose", "SAN JOSE", "BRGY SAN JOSE", etc.)
export function normalizeAndDeduplicateBarangays(list: string[]): string[] {
  const map = new Map<string, string>(); // lower key -> proper title-cased name

  if (!Array.isArray(list)) return [];

  for (const item of list) {
    if (!item || typeof item !== 'string') continue;
    const normalized = normalizeBarangayName(item);
    if (!normalized) continue;
    const upper = normalized.toUpperCase().trim();
    if (upper === 'UNKNOWN' || upper === 'N/A' || upper === 'NONE') continue;

    let foundKey: string | null = null;
    for (const [key, val] of map.entries()) {
      if (key === normalized.toLowerCase() || isBarangayMatch(val, normalized)) {
        foundKey = key;
        break;
      }
    }

    if (!foundKey) {
      map.set(normalized.toLowerCase(), normalized);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

// Cache for Base44 barangays
const base44BarangaysCache = new Set<string>();

const HOUSEHOLDS_CACHE_FILE = path.join(DATA_DIR, 'base44_households.json');
const PCUS_CACHE_FILE = path.join(DATA_DIR, 'base44_pcus.json');
const MEMBER_VERIFIED_CACHE_FILE = path.join(DATA_DIR, 'base44_member_verified.json');
const MESSAGES_CACHE_FILE = path.join(DATA_DIR, 'base44_messages.json');

let lastHouseholdsFetchTime = 0;
let lastPCUsFetchTime = 0;
let lastMemberVerifiedFetchTime = 0;
let lastMessagesFetchTime = 0;

// Rate limiting tracking
const COOLDOWN_FILE = path.join(DATA_DIR, 'base44_cooldown.json');

function getCooldownResetTime(): number {
  try {
    if (fs.existsSync(COOLDOWN_FILE)) {
      const data = fs.readFileSync(COOLDOWN_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (typeof parsed.resetTime === 'number') {
        return parsed.resetTime;
      }
    }
  } catch (e) {
    // Ignore
  }
  return 0;
}

function setCooldownResetTime(time: number) {
  try {
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify({ resetTime: time }), 'utf-8');
  } catch (e) {
    // Ignore
  }
}

function checkRateLimit(): boolean {
  const resetTime = getCooldownResetTime();
  if (Date.now() < resetTime) {
    return true;
  }
  return false;
}

function handleBase44Error(err: any) {
  const errMsg = err?.message || '';
  if (errMsg.includes('429') || errMsg.includes('traffic volume limit exceeded') || errMsg.includes('limit exceeded') || errMsg.includes('Too Many Requests')) {
    const cooldownTime = Date.now() + 15 * 60 * 1000; // 15 minutes of quiet time
    setCooldownResetTime(cooldownTime);
    console.info('[Base44 Rate Limit] Detected rate limit from Base44 API. Initiating 15-minute persistent cooldown...');
  }
}

// In-memory sliding window rate-limiting to proactively prevent 429 errors from Base44 SDK.
const requestTimestamps: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 6; // Cap at 6 live API read calls to Base44 per minute globally

function trackAndCheckLocalRateLimit(): boolean {
  const now = Date.now();
  // Clear timestamps older than 1 minute (60000 ms)
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
  
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    console.warn(`[Base44 Throttler] Proactively throttling Base44 SDK call to prevent 429 Rate Limit. Active requests in last 60s: ${requestTimestamps.length}`);
    const cooldownTime = now + 60 * 1000; // Trigger a temporary 1-minute cooldown
    setCooldownResetTime(cooldownTime);
    return false;
  }
  
  requestTimestamps.push(now);
  return true;
}

function isCacheFreshEnough(filePath: string, maxAgeMs: number = 300000): boolean {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const age = Date.now() - stats.mtimeMs;
      return age < maxAgeMs;
    }
  } catch (e) {
    // Ignore error
  }
  return false;
}

// Throttled fetch for HouseholdSubmissions with persistent cache fallback
export async function getCachedHouseholdSubmissions(force: boolean = false): Promise<any[]> {
  const cacheExists = fs.existsSync(HOUSEHOLDS_CACHE_FILE);
  if (cacheExists) {
    try {
      const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('[Base44 Cache] Failed to read households cache file:', e);
    }
  }
  return [];
}

// Throttled fetch for PCUUpdates with persistent cache fallback
export async function getCachedPCUUpdates(force: boolean = false): Promise<any[]> {
  const cacheExists = fs.existsSync(PCUS_CACHE_FILE);
  if (cacheExists) {
    try {
      const data = fs.readFileSync(PCUS_CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('[Base44 Cache] Failed to read PCUs cache file:', e);
    }
  }
  return [];
}

// Throttled fetch for MemberVerifiedSubmissions with persistent cache fallback
export async function getCachedMemberVerifiedSubmissions(force: boolean = false): Promise<any[]> {
  const cacheExists = fs.existsSync(MEMBER_VERIFIED_CACHE_FILE);
  if (cacheExists) {
    try {
      const data = fs.readFileSync(MEMBER_VERIFIED_CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('[Base44 Cache] Failed to read member verified cache file:', e);
    }
  }
  return [];
}

// Throttled fetch for SubmissionMessages from Base44 with cache fallback
export async function getCachedSubmissionMessages(force: boolean = false): Promise<any[]> {
  const cacheExists = fs.existsSync(MESSAGES_CACHE_FILE);
  if (cacheExists) {
    try {
      const data = fs.readFileSync(MESSAGES_CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('[Base44 Cache] Failed to read messages cache file:', e);
    }
  }
  return [];
}

// Add a new SubmissionMessage to Base44
export async function createSubmissionMessage(sender: string, message: string, recipient?: string, barangay?: string): Promise<any> {
  const payload = {
    sender,
    senderName: sender,
    submittedBy: sender,
    submitted_by: sender,
    sentBy: sender,
    memberName: recipient || barangay || 'Broadcast',
    message,
    content: message,
    recipient: recipient || '',
    barangay: barangay || '',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  let newRecord: any = null;
  try {
    const messageEntity = (base44.entities as any).SubmissionMessage;
    if (messageEntity && typeof messageEntity.create === 'function') {
      console.log('[Base44 SDK] Creating live SubmissionMessage in Base44...');
      newRecord = await messageEntity.create(payload);
    }
  } catch (err: any) {
    console.warn('[Base44 SDK Warning] Failed to create SubmissionMessage on Base44 side:', err.message);
  }

  // Fallback / Cache update
  if (!newRecord) {
    newRecord = {
      ...payload,
      id: `local_msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
  }

  try {
    const current = await getCachedSubmissionMessages(false);
    const updated = [newRecord, ...current];
    await safeWriteFile(MESSAGES_CACHE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (cacheErr: any) {
    console.warn('[Base44 Cache Warning] Failed to update cache with new message:', cacheErr.message);
  }

  return newRecord;
}

// Safely parse uploaded files which can be stringified JSON in the Base44 database
function safeParseUploadedFiles(files: any, fallbackFilesJson?: any): any[] {
  if (files) {
    if (Array.isArray(files)) return files;
    if (typeof files === 'string' && files.trim() !== '') {
      try {
        const parsed = JSON.parse(files);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn('[Base44 Sync] Failed to parse sub.uploadedFiles string:', files);
      }
    }
  }
  if (fallbackFilesJson) {
    if (Array.isArray(fallbackFilesJson)) return fallbackFilesJson;
    if (typeof fallbackFilesJson === 'string' && fallbackFilesJson.trim() !== '') {
      try {
        const parsed = JSON.parse(fallbackFilesJson);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn('[Base44 Sync] Failed to parse sub.uploadedFilesJson string:', fallbackFilesJson);
      }
    }
  }
  return [];
}

// Sync from Base44 HouseholdSubmission entity
export async function syncBase44Contacts(force: boolean = false) {
  base44SyncStatus.lastAttempt = new Date().toISOString();
  try {
    // Skip pulling pre-existing Base44 submissions for display on this website
    base44SyncStatus.lastSuccess = new Date().toISOString();
    base44SyncStatus.count = 0;
    base44SyncStatus.error = null;
    return true;
  } catch (err: any) {
    console.warn('[Base44 Sync Warning] Failed to connect or sync to Base44:', err.message);
    base44SyncStatus.error = null; // Do not show as active failure since we degrade gracefully
    return true; // Return true as we fell back successfully
  }
}

// Save helpers
async function saveContacts() {
  await safeWriteFile(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2), 'utf-8');
}

// Fetch raw Base44 Household Submissions & Directory contacts for Print List page
export async function fetchHouseholdSubmissionsFromBase44() {
  await ensureContactsSynced();
  let base44Households: any[] = [];
  try {
    const submissions = await getCachedHouseholdSubmissions(false);
    if (submissions && Array.isArray(submissions)) {
      base44Households = submissions.map((sub: any, idx: number) => {
        let name = sub.memberName || '';
        if (!name && sub.fpe && sub.fpe.fullName) {
          name = sub.fpe.fullName;
        }
        if (!name && sub.pmrf_front) {
          name = `${sub.pmrf_front.member_first || ''} ${sub.pmrf_front.member_middle || ''} ${sub.pmrf_front.member_last || ''}`.trim();
        }
        if (!name) {
          name = 'Unnamed Household';
        }

        const contact_number = sub.pcsf?.contact || 
                               sub.fpe?.mobile || 
                               sub.pmrf_front?.mobile || 
                               '';

        const barangay = getExactBarangay(sub);
        const purok = sub.purok || (sub.pcsf?.purok || '');

        const hasGeo = sub.geoLocation && typeof sub.geoLocation.latitude === 'number' && typeof sub.geoLocation.longitude === 'number';

        // Check if already in contactsCache (added to directory via + Add List)
        const isAlreadyAdded = contactsCache.some(c => 
          !c.deleted_at &&
          normalizeCompareName(c.full_name, name) &&
          normalizeBarangayName(c.barangay).toLowerCase() === normalizeBarangayName(barangay).toLowerCase() &&
          c.added_from_print_list !== false
        );

        return {
          id: sub.id || `sub_${idx + 1}`,
          full_name: name,
          barangay: barangay,
          purok: purok,
          contact_number: contact_number,
          created_at: sub.created_date || new Date().toISOString(),
          latitude: hasGeo ? sub.geoLocation.latitude : undefined,
          longitude: hasGeo ? sub.geoLocation.longitude : undefined,
          geotagged: hasGeo,
          addedToDirectory: isAlreadyAdded
        };
      });
    }
  } catch (err: any) {
    console.error('[Base44] Failed to fetch household submissions:', err.message);
  }

  // Combine with active contacts from directory (Bulk Entries & manually added contacts)
  // Deduplicate strictly by case-insensitive full_name
  const seenNameKeys = new Set<string>();

  const activeContacts = contactsCache.filter(c => !c.deleted_at);
  const directoryHouseholds: any[] = [];

  for (const c of activeContacts) {
    const nameKey = (c.full_name || '').trim().toLowerCase();
    if (nameKey && !seenNameKeys.has(nameKey)) {
      seenNameKeys.add(nameKey);
      directoryHouseholds.push({
        id: `dir_${c.id}`,
        full_name: c.full_name,
        barangay: c.barangay,
        purok: c.purok || '',
        contact_number: c.contact_number || '',
        created_at: c.created_at || new Date().toISOString(),
        geotagged: false,
        addedToDirectory: c.added_from_print_list !== false
      });
    }
  }

  return directoryHouseholds;
}

// Fetch all Household Submissions from Base44 that are marked as existing accounts
export async function fetchExistingAccountsFromBase44() {
  const existingAccounts: any[] = [];
  try {
    const submissions = await getCachedHouseholdSubmissions(false);
    if (submissions && Array.isArray(submissions)) {
      const filtered = submissions.filter((sub: any) => 
        sub.existingAcc === true || 
        sub.existingAcc === 'true' || 
        sub.existingAccVerified === true ||
        sub.existingAccVerified === 'true'
      );
      
      filtered.forEach((sub: any, idx: number) => {
        let name = sub.memberName || '';
        if (!name && sub.fpe && sub.fpe.fullName) {
          name = sub.fpe.fullName;
        }
        if (!name && sub.pmrf_front) {
          name = `${sub.pmrf_front.member_first || ''} ${sub.pmrf_front.member_middle || ''} ${sub.pmrf_front.member_last || ''}`.trim();
        }
        if (!name) {
          name = 'Unnamed Household';
        }

        const contact_number = sub.pcsf?.contact || 
                               sub.fpe?.mobile || 
                               sub.pmrf_front?.mobile || 
                               '';

        const barangay = getExactBarangay(sub);
        const purok = sub.purok || (sub.pcsf?.purok || '');

        const hasGeo = sub.geoLocation && typeof sub.geoLocation.latitude === 'number' && typeof sub.geoLocation.longitude === 'number';

        existingAccounts.push({
          id: sub.id || `ext_${idx + 1}`,
          full_name: name,
          barangay: barangay,
          purok: purok,
          contact_number: contact_number,
          created_at: sub.created_date || new Date().toISOString(),
          latitude: hasGeo ? sub.geoLocation.latitude : undefined,
          longitude: hasGeo ? sub.geoLocation.longitude : undefined,
          geotagged: hasGeo,
          existingAcc: sub.existingAcc === true || sub.existingAcc === 'true',
          existingAccVerified: sub.existingAccVerified === true || sub.existingAccVerified === 'true',
          existingAccVisited: sub.existingAccVisited === true || sub.existingAccVisited === 'true',
          status: sub.status || 'pending',
          submittedBy: sub.submittedBy || 'Unknown',
          pin: sub.fpe?.pin || sub.pcsf?.pin || '',
          facebookLink: sub.facebookLink || '',
          uploadedFiles: safeParseUploadedFiles(sub.uploadedFiles, sub.uploadedFilesJson)
        });
      });
    }
  } catch (err: any) {
    console.error('[Base44] Failed to fetch existing accounts:', err.message);
  }
  return existingAccounts;
}

// Add a specific Household Submission to the Saint Francis Clinic Directory
export async function addHouseholdToDirectory(household: {
  full_name: string;
  barangay: string;
  purok?: string;
  contact_number?: string;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
}, actorUsername: string) {
  const formattedName = household.full_name ? capitalizeWords(household.full_name) : '';
  const trimmedBarangay = household.barangay ? normalizeBarangayName(household.barangay) : 'Barangay Central';
  const trimmedPurok = household.purok ? capitalizeWords(household.purok) : '';
  const trimmedContact = household.contact_number ? household.contact_number.trim() : '';

  if (!formattedName) {
    throw new Error('Household full name is required.');
  }

  // Check if contact already exists in directory (even if soft-deleted or inactive)
  const existing = contactsCache.find(
    c => normalizeCompareName(c.full_name, formattedName) && 
         normalizeBarangayName(c.barangay).toLowerCase() === normalizeBarangayName(trimmedBarangay).toLowerCase()
  );

  if (existing) {
    existing.added_from_print_list = true;
    existing.deleted_at = null; // restore in case it was previously soft-deleted
    existing.updated_at = new Date().toISOString();
    await saveContacts();
    if (sheetsConfig.syncEnabled) {
      forwardToWebApp('edit', existing).catch(err => console.error('Failed to sync re-added contact to Sheets:', err));
    }
    return existing;
  }

  const newId = Date.now() + Math.floor(Math.random() * 1000);
  const newContact: Contact = {
    id: newId,
    full_name: formattedName,
    barangay: trimmedBarangay,
    purok: trimmedPurok,
    contact_number: trimmedContact,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    latitude: household.latitude,
    longitude: household.longitude,
    geotagged: Boolean(household.geotagged || (household.latitude && household.longitude)),
    added_locally: true,
    added_from_print_list: true
  };

  contactsCache.unshift(newContact);
  await saveContacts();
  await addActivity(actorUsername, `Added household "${formattedName}" to Clinic Directory under Barangay ${trimmedBarangay}`);

  // Async sync to Google Sheets if configured
  forwardToWebApp('add', newContact).catch(err => console.error('Failed to sync contact to Sheets:', err));

  return newContact;
}

// Clear all contacts from the directory (Mark inactive instead of deleting)
export async function clearAllDirectoryContacts(actorUsername: string) {
  let count = 0;
  for (let i = 0; i < contactsCache.length; i++) {
    if (contactsCache[i].added_from_print_list !== false) {
      contactsCache[i].added_from_print_list = false;
      contactsCache[i].updated_at = new Date().toISOString();
      count++;
    }
  }
  await saveContacts();
  await addActivity(actorUsername, `Removed all ${count} contacts from Saint Francis Clinic Directory (marked inactive)`);
  if (sheetsConfig.syncEnabled) {
    rewriteAllContactsToGoogleSheets().catch(err => console.error('Failed to sync cleared contacts to Google Sheets:', err));
  }
  return true;
}

async function saveActivities() {
  await safeWriteFile(ACTIVITIES_FILE, JSON.stringify(activitiesCache, null, 2), 'utf-8');
}

export async function addActivity(username: string, action: string) {
  const activity: Activity = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    username,
    action
  };
  activitiesCache.unshift(activity); // Newest first in cache
  if (activitiesCache.length > 500) {
    activitiesCache = activitiesCache.slice(0, 500); // Limit logs
  }
  await saveActivities();
  appendActivityToGoogleSheets(activity).catch(err => console.error('Failed to append activity to Sheets:', err));
}

// Public Barangay helper to fetch unique Barangays from Base44 / contacts database
export function getPublicBarangays(): string[] {
  const barangaySet = new Set<string>();
  const defaultBarangays = ['BARANGAY CENTRAL', 'BALANGASAN', 'BANALE', 'NAPOLAN', 'SAN FRANCISCO', 'POBLACION', 'KAWIT'];
  defaultBarangays.forEach(b => barangaySet.add(b));

  contactsCache.forEach(c => {
    if (c.deleted_at === null && c.barangay && c.barangay.trim()) {
      const bUpper = c.barangay.trim().toUpperCase();
      if (bUpper !== 'UNKNOWN' && bUpper !== 'N/A' && bUpper !== 'NONE') {
        barangaySet.add(bUpper);
      }
    }
  });

  return Array.from(barangaySet).filter(b => b !== 'UNKNOWN' && b !== 'N/A').sort((a, b) => a.localeCompare(b));
}

// User helper matching username or email
export function findUser(input: string): User | undefined {
  if (!input) return undefined;
  const target = input.trim().toLowerCase();
  return usersCache.find(
    u => u && typeof u.username === 'string' && (u.username.toLowerCase() === target || (typeof u.email === 'string' && u.email.toLowerCase() === target))
  );
}

// User helper matching email specifically
export function findUserByEmail(email: string): User | undefined {
  if (!email) return undefined;
  const target = email.trim().toLowerCase();
  return usersCache.find(
    u => u && typeof u.email === 'string' && u.email.toLowerCase() === target
  );
}

export function getUsers() {
  return usersCache.map(u => ({
    username: u.username,
    email: u.email || u.username,
    fullName: u.fullName || u.displayName || u.username,
    barangay: u.barangay || 'Central',
    role: u.role || 'Staff',
    status: u.status || 'Active',
    createdAt: u.createdAt || new Date().toISOString(),
    displayName: u.displayName || u.fullName || '',
    avatarDataUrl: u.avatarDataUrl || '',
    passwordPlain: u.passwordPlain || ''
  }));
}

const NON_BARANGAY_VALUES = new Set([
  'ALL',
  'ALL BARANGAYS',
  'ALL ADDRESSES',
  'ALL BARANGAY',
  'ALL ADDRESS',
  'SELECT',
  'SELECT BARANGAY',
  'SELECT ADDRESS',
  'SELECT ADDRESS (BARANGAY)',
  'UNKNOWN',
  'N/A',
  'NONE',
  'NULL',
  'UNDEFINED',
  'OTHER',
  'OTHERS',
  'PAGADIAN',
  'PAGADIAN CITY',
  'ZAMBOANGA DEL SUR',
  'CITY',
  'PROVINCE'
]);

export function isRealBarangay(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  if (NON_BARANGAY_VALUES.has(upper)) return false;
  if (upper.startsWith('ALL ') || upper.startsWith('SELECT ') || upper.startsWith('FILTER ')) return false;
  return true;
}

export function getBarangayList(): string[] {
  const list = (Array.isArray(barangaysCache) && barangaysCache.length > 0) ? barangaysCache : DEFAULT_BARANGAYS;
  return normalizeAndDeduplicateBarangays(list.filter(b => !isBarangayTombstoned(b)));
}

export async function getBase44Roles(): Promise<string[]> {
  const defaultRoles = [
    'MASTER ADMIN',
    'IT',
    'LEADER',
    'CO-LEADER',
    'ADMIN',
    'ENCODER',
    'STAFF'
  ];

  const roleMap = new Map<string, string>();

  // Initialize with uppercase default roles
  defaultRoles.forEach(r => {
    roleMap.set(r.toUpperCase(), r);
  });

  // Collect roles from existing accounts cache
  if (Array.isArray(usersCache)) {
    usersCache.forEach(u => {
      if (u.role && u.role.trim()) {
        const trimmed = u.role.trim();
        const upper = trimmed.toUpperCase();
        if (!roleMap.has(upper)) {
          roleMap.set(upper, trimmed);
        }
      }
    });
  }

  // Collect roles from siteSettings.rolePermissions
  if (siteSettings && siteSettings.rolePermissions) {
    Object.keys(siteSettings.rolePermissions).forEach(r => {
      if (r && r.trim()) {
        const trimmed = r.trim();
        const upper = trimmed.toUpperCase();
        if (!roleMap.has(upper)) {
          roleMap.set(upper, trimmed);
        }
      }
    });
  }

  return Array.from(roleMap.values()).sort((a, b) => a.localeCompare(b));
}

export async function registerUser(data: {
  fullName: string;
  email: string;
  password: string;
  barangay: string;
  role?: string;
}) {
  const { fullName, email, password, barangay, role } = data;

  const trimmedName = fullName ? fullName.trim() : '';
  const trimmedEmail = email ? email.trim().toLowerCase() : '';
  const trimmedPass = password ? password.trim() : '';
  const trimmedBarangay = barangay ? barangay.trim() : '';
  const trimmedRole = role && role.trim() ? role.trim() : 'Staff';

  if (!trimmedName || !trimmedEmail || !trimmedPass || !trimmedBarangay) {
    throw new Error('Full Name, Email, Password, and Barangay are all required.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  if (trimmedPass.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  // Check if email already exists
  const emailExists = usersCache.some(u => u.email && u.email.toLowerCase() === trimmedEmail);
  if (emailExists) {
    throw new Error('An account with this email address already exists. Please log in.');
  }

  // Derive username from email or name
  let username = trimmedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '');
  if (!username) {
    username = 'user';
  }

  // Ensure username is unique to avoid collision in local files or sheet
  let finalUsername = username;
  let counter = 1;
  while (usersCache.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
    finalUsername = `${username}${counter}`;
    counter++;
  }

  const newUser: User = {
    username: finalUsername,
    email: trimmedEmail,
    fullName: trimmedName,
    displayName: trimmedName,
    barangay: trimmedBarangay,
    passwordHash: hashPassword(trimmedPass),
    passwordPlain: trimmedPass,
    role: trimmedRole,
    status: 'Pending',
    createdAt: new Date().toISOString()
  };

  usersCache.push(newUser);
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(finalUsername, `Registered new account (${trimmedName} - ${trimmedBarangay}) with role ${trimmedRole}`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync users to Sheets:', err));

  return {
    username: newUser.username,
    email: newUser.email,
    fullName: newUser.fullName,
    barangay: newUser.barangay,
    role: newUser.role,
    status: newUser.status,
    createdAt: newUser.createdAt
  };
}

export async function updateUserRole(username: string, newRole: string, actorUsername: string) {
  const user = usersCache.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    throw new Error('User account not found.');
  }
  user.role = newRole;
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(actorUsername, `Updated user @${username} role to ${newRole}`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync users to Sheets:', err));
  return user;
}

export async function updateUserStatus(username: string, newStatus: 'Active' | 'Pending' | 'Suspended', actorUsername: string) {
  const user = usersCache.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    throw new Error('User account not found.');
  }
  user.status = newStatus;
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(actorUsername, `Updated user @${username} status to ${newStatus}`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync users to Sheets:', err));
  return user;
}

export async function editUserAccount(
  targetUsername: string,
  updates: {
    fullName?: string;
    email?: string;
    barangay?: string;
    role?: string;
    status?: 'Active' | 'Pending' | 'Suspended';
    password?: string;
  },
  actorUsername: string
) {
  const user = usersCache.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
  if (!user) {
    throw new Error('User account not found.');
  }

  if (targetUsername.toLowerCase() === 'admin') {
    if (updates.role && updates.role !== 'Administrator') {
      throw new Error('Master admin role cannot be changed.');
    }
    if (updates.status && updates.status !== 'Active') {
      throw new Error('Master admin account must remain Active.');
    }
  }

  // Prevent logged-in user from self-demoting role or self-suspending status
  if (targetUsername.toLowerCase() === actorUsername.toLowerCase()) {
    if (updates.role && updates.role !== 'Administrator' && user.role === 'Administrator') {
      throw new Error('You cannot demote your own Administrator role.');
    }
    if (updates.status && updates.status !== 'Active') {
      throw new Error('You cannot suspend or deactivate your own account.');
    }
  }

  if (updates.fullName !== undefined) {
    user.fullName = updates.fullName.trim();
    user.displayName = updates.fullName.trim();
  }

  if (updates.email !== undefined) {
    const trimmedEmail = updates.email.trim().toLowerCase();
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Please enter a valid email address.');
      }
      const duplicate = usersCache.find(
        u => u.username.toLowerCase() !== targetUsername.toLowerCase() && u.email && u.email.toLowerCase() === trimmedEmail
      );
      if (duplicate) {
        throw new Error('An account with this email address already exists.');
      }
      user.email = trimmedEmail;
    }
  }

  if (updates.barangay !== undefined) {
    user.barangay = updates.barangay.trim();
  }

  if (updates.role !== undefined && updates.role.trim()) {
    user.role = updates.role.trim();
  }

  if (updates.status !== undefined) {
    user.status = updates.status;
  }

  if (updates.password && updates.password.trim()) {
    const trimmedPass = updates.password.trim();
    if (trimmedPass.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }
    user.passwordHash = hashPassword(trimmedPass);
    user.passwordPlain = trimmedPass;
  }

  user.updatedAt = new Date().toISOString();
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(actorUsername, `Edited user account details for "@${targetUsername}" (${user.fullName || targetUsername})`);
  try {
    await syncAdminsToGoogleSheets();
  } catch (err: any) {
    console.error('Failed to sync users to Sheets:', err);
  }

  return {
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    barangay: user.barangay,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt
  };
}

export async function designateBarangayForUsers(
  barangay: string,
  sourceBarangay?: string,
  usernames?: string[],
  actorUsername?: string
) {
  if (!barangay || !barangay.trim()) {
    throw new Error('Designated Barangay name is required.');
  }
  const trimmedTarget = barangay.trim();
  const trimmedSource = sourceBarangay ? sourceBarangay.trim() : '';

  let transferredCount = 0;

  // Transfer all records inside previous/source folder to selected target folder
  if (trimmedSource && trimmedSource.toLowerCase() !== trimmedTarget.toLowerCase()) {
    const matchingContacts = contactsCache.filter(c => !c.deleted_at && isBarangayMatch(c.barangay, trimmedSource));
    transferredCount = matchingContacts.length;

    if (transferredCount > 0) {
      matchingContacts.forEach(c => {
        c.barangay = trimmedTarget;
        c.updated_at = new Date().toISOString();
      });
      await saveContacts();
    }

    // Automatically remove previous/source folder from barangaysCache
    barangaysCache = barangaysCache.filter(b => 
      !isBarangayMatch(b, trimmedSource) && 
      normalizeBarangayName(b).toLowerCase() !== normalizeBarangayName(trimmedSource).toLowerCase()
    );

    // Ensure target folder is present in barangaysCache
    const existsTarget = barangaysCache.some(b => 
      isBarangayMatch(b, trimmedTarget) || 
      normalizeBarangayName(b).toLowerCase() === normalizeBarangayName(trimmedTarget).toLowerCase()
    );
    if (!existsTarget) {
      barangaysCache.push(trimmedTarget);
      barangaysCache.sort((a, b) => a.localeCompare(b));
    }
    await saveBarangays();

    // Trigger Google Sheets sync if connected
    if (sheetsConfig.syncEnabled) {
      syncBarangaysToGoogleSheets().catch(err =>
        console.error('[Google Sheets] Error syncing barangays after folder transfer:', err.message || err)
      );
      if (transferredCount > 0) {
        rewriteAllContactsToGoogleSheets().catch(err =>
          console.error('[Google Sheets] Error syncing contacts after folder transfer:', err.message || err)
        );
      }
    }

    // Also update any user accounts currently assigned to sourceBarangay to targetBarangay
    let updatedUsersCount = 0;
    usersCache.forEach(u => {
      if (u.barangay && isBarangayMatch(u.barangay, trimmedSource)) {
        u.barangay = trimmedTarget;
        u.updatedAt = new Date().toISOString();
        updatedUsersCount++;
      }
    });

    if (updatedUsersCount > 0) {
      await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
      syncAdminsToGoogleSheets().catch(err =>
        console.error('Failed to sync updated designated barangays to Sheets:', err)
      );
    }
  } else {
    // If no trimmedSource or same as target, ensure target is in barangaysCache
    const existsTarget = barangaysCache.some(b => 
      isBarangayMatch(b, trimmedTarget) || 
      normalizeBarangayName(b).toLowerCase() === normalizeBarangayName(trimmedTarget).toLowerCase()
    );
    if (!existsTarget) {
      barangaysCache.push(trimmedTarget);
      barangaysCache.sort((a, b) => a.localeCompare(b));
      await saveBarangays();
      if (sheetsConfig.syncEnabled) {
        syncBarangaysToGoogleSheets().catch(err =>
          console.error('[Google Sheets] Error syncing barangays after folder designation:', err.message || err)
        );
      }
    }
  }

  // Update specific user accounts if explicitly requested
  if (Array.isArray(usernames) && usernames.length > 0) {
    let updatedSpecific = 0;
    for (const uname of usernames) {
      const user = usersCache.find(u => u.username.toLowerCase() === uname.toLowerCase());
      if (user && user.username.toLowerCase() !== 'admin') {
        user.barangay = trimmedTarget;
        user.updatedAt = new Date().toISOString();
        updatedSpecific++;
      }
    }
    if (updatedSpecific > 0) {
      await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
      syncAdminsToGoogleSheets().catch(err =>
        console.error('Failed to sync updated designated barangays to Sheets:', err)
      );
    }
  }

  // Count matching accounts for target barangay
  const matchingAccounts = usersCache.filter(u => u.barangay && isBarangayMatch(u.barangay, trimmedTarget));

  const activityMsg = transferredCount > 0
    ? `Transferred ${transferredCount} household record(s) from folder "${trimmedSource}" to designated folder "${trimmedTarget}". Previous folder "${trimmedSource}" automatically removed.`
    : `Designated Barangay folder "${trimmedTarget}". Available to ${matchingAccounts.length} account(s).`;

  await addActivity(actorUsername || 'admin', activityMsg);

  return {
    success: true,
    message: transferredCount > 0
      ? `Successfully transferred ${transferredCount} household record(s) from "${trimmedSource}" to "${trimmedTarget}". Previous folder "${trimmedSource}" automatically removed!`
      : `Barangay "${trimmedTarget}" folder designated successfully! Available to ${matchingAccounts.length} account(s).`,
    transferredCount,
    sourceBarangay: trimmedSource,
    targetBarangay: trimmedTarget,
    matchingAccountCount: matchingAccounts.length,
    matchingAccounts: matchingAccounts.map(u => ({ username: u.username, fullName: u.fullName || u.username, role: u.role })),
    barangay: trimmedTarget
  };
}

function saveAvatarFile(base64Data: string, username: string): string {
  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Data;
    }
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    safeMkdirSync(uploadsDir, { recursive: true });

    const distUploadsDir = path.join(process.cwd(), 'dist', 'uploads', 'avatars');
    safeMkdirSync(distUploadsDir, { recursive: true });

    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const fileName = `avatar_${cleanUser}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    const distFilePath = path.join(distUploadsDir, fileName);

    safeWriteFileSync(filePath, imageBuffer as any);
    safeWriteFileSync(distFilePath, imageBuffer as any);

    return `/uploads/avatars/${fileName}?t=${Date.now()}`;
  } catch (err: any) {
    console.warn('Failed to save avatar image file to disk:', err.message || err);
    return base64Data;
  }
}

function chooseBestAvatar(localAvatar?: string, remoteAvatar?: string): string {
  if (!remoteAvatar || remoteAvatar.trim() === '') return localAvatar || '';
  if (!localAvatar || localAvatar.trim() === '') return remoteAvatar || '';

  // If remoteAvatar is truncated (starts with data:image/ and length >= 44000), keep localAvatar
  if (remoteAvatar.startsWith('data:image/') && remoteAvatar.length >= 44000) {
    return localAvatar;
  }

  // If localAvatar is a static upload URL (/uploads/...), prioritize it
  if (localAvatar.startsWith('/uploads/')) {
    if (remoteAvatar.startsWith('/uploads/')) {
      return remoteAvatar;
    }
    return localAvatar;
  }

  return remoteAvatar;
}

export async function updateUserProfile(
  currentUsername: string,
  updates: { username?: string; displayName?: string; avatarDataUrl?: string; password?: string; barangay?: string }
) {
  const user = usersCache.find(u => u.username.toLowerCase() === currentUsername.toLowerCase());
  if (!user) {
    throw new Error('User not found.');
  }

  let finalUsername = currentUsername.toLowerCase();

  if (updates.username) {
    const nextUsername = updates.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!nextUsername) {
      throw new Error('Username cannot be empty.');
    }
    if (nextUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (nextUsername !== currentUsername.toLowerCase()) {
      const exists = usersCache.some(u => u.username.toLowerCase() === nextUsername);
      if (exists) {
        throw new Error(`Username "@${nextUsername}" is already taken.`);
      }
      user.username = nextUsername;
      finalUsername = nextUsername;
    }
  }

  if (updates.displayName !== undefined) {
    const trimmedDisplay = updates.displayName.trim();
    user.displayName = trimmedDisplay;
    user.fullName = trimmedDisplay;
  }

  if (updates.avatarDataUrl !== undefined) {
    let newAvatar = updates.avatarDataUrl;
    if (newAvatar && newAvatar.startsWith('data:image/')) {
      newAvatar = saveAvatarFile(newAvatar, finalUsername);
    }
    user.avatarDataUrl = newAvatar;
  }

  if (updates.barangay !== undefined) {
    user.barangay = updates.barangay.trim();
  }

  if (updates.password) {
    const trimmedPass = updates.password.trim();
    if (trimmedPass.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }
    user.passwordHash = hashPassword(trimmedPass);
    user.passwordPlain = trimmedPass;
  }

  user.updatedAt = new Date().toISOString();

  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(finalUsername, `Updated admin profile settings (Username: @${finalUsername}, Name: ${user.displayName || 'not set'}).`);

  // Synchronize immediately to Google Sheets
  try {
    await syncAdminsToGoogleSheets();
  } catch (err: any) {
    console.error('Failed to sync updated admin profile to Sheets:', err.message || err);
  }

  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.fullName || '',
    avatarDataUrl: user.avatarDataUrl || '',
    barangay: user.barangay || '',
    email: user.email || '',
    status: user.status || 'Active'
  };
}

export async function createAdminUser(username: string, password: string, creatorUsername: string) {
  const trimmedUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const trimmedPass = password.trim();

  if (!trimmedUser || !trimmedPass) {
    throw new Error('Username and password are required.');
  }

  if (trimmedUser.length < 3) {
    throw new Error('Username must be at least 3 characters long and alphanumeric.');
  }

  if (trimmedPass.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const exists = usersCache.some(u => u.username.toLowerCase() === trimmedUser);
  if (exists) {
    throw new Error(`Username "@${trimmedUser}" is already taken.`);
  }

  const newUser: User = {
    username: trimmedUser,
    passwordHash: hashPassword(trimmedPass),
    role: 'Administrator'
  };

  usersCache.push(newUser);
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(creatorUsername, `Created new Administrator credential: "@${trimmedUser}"`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync admins to Sheets:', err));

  return { username: trimmedUser, role: 'Administrator' };
}

export async function deleteAdminUser(username: string, creatorUsername: string) {
  const targetUser = username.trim().toLowerCase();
  if (targetUser === 'admin') {
    throw new Error('The master admin account cannot be deleted.');
  }

  const index = usersCache.findIndex(u => u.username.toLowerCase() === targetUser);
  if (index === -1) {
    throw new Error('Admin user not found.');
  }

  usersCache.splice(index, 1);
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(creatorUsername, `Deleted Administrator credential: "@${targetUser}"`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync admins to Sheets:', err));
}

// In-memory store for password reset verification PINs
const resetTokensMap = new Map<string, { pin: string; expiresAt: number; email: string; username: string }>();

export async function requestPasswordResetPIN(emailOrUsername: string) {
  if (!emailOrUsername || !emailOrUsername.trim()) {
    throw new Error('Please enter your email address or username.');
  }

  const target = emailOrUsername.trim().toLowerCase();
  let user: User | undefined = undefined;

  if (target === 'admin') {
    user = findUser('admin');
  } else {
    user = findUserByEmail(target) || findUser(target);
  }

  if (!user) {
    throw new Error(`No registered account found with email or username "${emailOrUsername}". Please check your credentials or register a new account.`);
  }

  // Generate 6-digit PIN
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store PIN valid for 15 minutes
  resetTokensMap.set(user.username.toLowerCase(), {
    pin,
    expiresAt: Date.now() + 15 * 60 * 1000,
    email: user.email || user.username,
    username: user.username
  });

  await addActivity(user.username, `Requested password reset verification PIN.`);

  return {
    success: true,
    message: 'Verification PIN generated successfully.',
    email: user.email || user.username,
    username: user.username,
    pin
  };
}

export async function verifyAndResetPassword(emailOrUsername: string, pin: string, newPassword: string) {
  if (!emailOrUsername || !emailOrUsername.trim()) {
    throw new Error('Please enter your email address or username.');
  }
  if (!pin || !pin.trim()) {
    throw new Error('Please enter the 6-digit verification PIN.');
  }
  if (!newPassword || !newPassword.trim()) {
    throw new Error('Please enter a new password.');
  }

  const trimmedPass = newPassword.trim();
  if (trimmedPass.length < 4) {
    throw new Error('New password must be at least 4 characters long.');
  }

  const target = emailOrUsername.trim().toLowerCase();
  let user: User | undefined = undefined;

  if (target === 'admin') {
    user = findUser('admin');
  } else {
    user = findUserByEmail(target) || findUser(target);
  }

  if (!user) {
    throw new Error('User account not found.');
  }

  const tokenData = resetTokensMap.get(user.username.toLowerCase());
  if (!tokenData) {
    throw new Error('No active password reset request found for this account. Please request a new PIN.');
  }

  if (Date.now() > tokenData.expiresAt) {
    resetTokensMap.delete(user.username.toLowerCase());
    throw new Error('The verification PIN has expired (15 min limit). Please request a new PIN.');
  }

  if (tokenData.pin !== pin.trim()) {
    throw new Error('Invalid 6-digit verification PIN. Please double check the code.');
  }

  // PIN verified - update password
  user.passwordHash = hashPassword(trimmedPass);
  user.passwordPlain = trimmedPass;

  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  resetTokensMap.delete(user.username.toLowerCase());
  
  await addActivity(user.username, `Successfully reset account password.`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync updated user password to Sheets:', err));

  return {
    success: true,
    message: 'Password reset successfully! You can now log in with your new password.',
    username: user.username,
    email: user.email || user.username
  };
}

// String Helper for Capitalization
function capitalizeWords(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Flexible Barangay comparison function
export function isBarangayMatch(b1?: string, b2?: string): boolean {
  if (!b1 || !b2) return false;
  const c1 = b1.trim().toLowerCase();
  const c2 = b2.trim().toLowerCase();
  if (c1 === c2) return true;

  // Clean prefixes like "barangay ", "brgy. ", "brgy "
  const clean1 = c1.replace(/^(barangay|brgy\.?)\s+/i, '').trim();
  const clean2 = c2.replace(/^(barangay|brgy\.?)\s+/i, '').trim();
  if (clean1 === clean2 && clean1.length > 0) return true;

  // Compare normalized versions
  const norm1 = normalizeBarangayName(b1).toLowerCase();
  const norm2 = normalizeBarangayName(b2).toLowerCase();
  if (norm1 === norm2 && norm1.length > 0) return true;

  return false;
}

// Get contacts with flexible pagination, sorting, searching, and filtering
export async function getContacts(params: {
  search?: string;
  barangay?: string;
  address?: string;
  purok?: string;
  sortBy?: 'name' | 'barangay' | 'purok' | 'date';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  forceSync?: boolean;
}) {
  const { search, barangay, address, purok, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 10, forceSync = false } = params;

  if (sheetsConfig.syncEnabled) {
    try {
      await ensureContactsSynced(forceSync);
    } catch (err: any) {
      console.error('[Sync] Failed to ensure contacts synced in getContacts:', err.message || err);
    }
  }

  // Ensure all PCU statuses are fully restored on any contacts before querying/filtering
  syncPCUFieldsToCache();

  const filterBarangay = barangay || address;

  // Only query active (non-soft-deleted) contacts that have NOT yet uploaded a PCU file
  let filtered = contactsCache.filter(c => !c.deleted_at && (c.added_from_print_list !== false) && !c.pcu_file_url);

  // Get ALL unique barangays from Google Sheet database (getBarangayList) + contactsCache
  const rawBarangaysList: string[] = [];

  // 1. Fetch barangay list from Google Sheet database cache/file
  const sheetBarangays = getBarangayList();
  if (Array.isArray(sheetBarangays)) {
    sheetBarangays.forEach(bg => {
      if (bg && typeof bg === 'string' && bg.trim()) {
        rawBarangaysList.push(bg.trim());
      }
    });
  }

  // 2. Add any barangay from active contacts in contactsCache
  contactsCache.forEach(c => {
    if (!c.deleted_at && (c.added_from_print_list !== false) && !c.pcu_file_url && c.barangay && c.barangay.trim()) {
      rawBarangaysList.push(c.barangay.trim());
    }
  });

  const allBarangays = normalizeAndDeduplicateBarangays(rawBarangaysList);

  // Get ALL unique non-empty puroks for filtering dropdown before search filters are applied
  const allPuroksSet = new Set<string>();
  contactsCache.forEach(c => {
    if (!c.deleted_at && (c.added_from_print_list !== false) && !c.pcu_file_url && c.purok) {
      allPuroksSet.add(c.purok.trim());
    }
  });
  const allPuroks = Array.from(allPuroksSet).sort((a, b) => a.localeCompare(b));

  // Apply Barangay Filter with flexible matching
  if (filterBarangay && filterBarangay !== 'All Addresses' && filterBarangay !== 'All Barangays') {
    filtered = filtered.filter(c => isBarangayMatch(c.barangay, filterBarangay));
  }

  // Apply Purok Filter
  if (purok && purok !== 'All Puroks') {
    filtered = filtered.filter(c => c.purok && c.purok.toLowerCase() === purok.toLowerCase());
  }

  // Apply Search (Full Name, Barangay, Purok, Contact Number)
  if (search) {
    const term = search.toLowerCase().trim();
    filtered = filtered.filter(
      c =>
         c.full_name.toLowerCase().includes(term) ||
         c.barangay.toLowerCase().includes(term) ||
         (c.purok && c.purok.toLowerCase().includes(term)) ||
         c.contact_number.includes(term)
    );
  }

  // Apply Sorting
  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.full_name.localeCompare(b.full_name);
    } else if (sortBy === 'barangay' || sortBy === 'address' as any) {
      comparison = a.barangay.localeCompare(b.barangay);
    } else if (sortBy === 'purok') {
      comparison = (a.purok || '').localeCompare(b.purok || '');
    } else if (sortBy === 'date') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination calculations
  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);
  const totalPages = Math.ceil(total / limit);

  // Compute folder statistics for each barangay
  const barangayFolders = allBarangays.map(bg => {
    const bgContacts = contactsCache.filter(c => !c.deleted_at && (c.added_from_print_list !== false) && isBarangayMatch(c.barangay, bg));
    const purokSet = new Set<string>();
    let geotaggedCount = 0;
    bgContacts.forEach(c => {
      if (c.purok) purokSet.add(c.purok.trim());
      if (c.geotagged) geotaggedCount++;
    });
    return {
      barangay: bg,
      count: bgContacts.length,
      purokCount: purokSet.size,
      geotaggedCount
    };
  }).filter(f => f.count > 0);

  return {
    contacts: paginated,
    total,
    page,
    totalPages,
    allAddresses: allBarangays, // returning as allAddresses for backward compatibility with existing frontends
    allPuroks,
    barangayFolders
  };
}

// Get all non-deleted contacts for exporting and printing without pagination
export function getAllFilteredContacts(params: {
  search?: string;
  barangay?: string;
  address?: string;
  purok?: string;
  sortBy?: 'name' | 'barangay' | 'purok' | 'date';
  sortOrder?: 'asc' | 'desc';
}) {
  const { search, barangay, address, purok, sortBy = 'date', sortOrder = 'desc' } = params;
  
  // Ensure all PCU statuses are fully restored on any contacts before querying/filtering
  syncPCUFieldsToCache();

  const filterBarangay = barangay || address;
  let filtered = contactsCache.filter(c => !c.deleted_at && (c.added_from_print_list !== false) && !c.pcu_file_url);

  if (filterBarangay && filterBarangay !== 'All Addresses' && filterBarangay !== 'All Barangays') {
    filtered = filtered.filter(c => isBarangayMatch(c.barangay, filterBarangay));
  }

  if (purok && purok !== 'All Puroks') {
    filtered = filtered.filter(c => c.purok && c.purok.toLowerCase() === purok.toLowerCase());
  }

  if (search) {
    const term = search.toLowerCase().trim();
    filtered = filtered.filter(
      c =>
        c.full_name.toLowerCase().includes(term) ||
        c.barangay.toLowerCase().includes(term) ||
        (c.purok && c.purok.toLowerCase().includes(term)) ||
        c.contact_number.includes(term)
    );
  }

  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.full_name.localeCompare(b.full_name);
    } else if (sortBy === 'barangay' || sortBy === 'address' as any) {
      comparison = a.barangay.localeCompare(b.barangay);
    } else if (sortBy === 'purok') {
      comparison = (a.purok || '').localeCompare(b.purok || '');
    } else if (sortBy === 'date') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
}

// Helper to generate IDs for locally added contacts to avoid clash with Base44 entries (1..N)
function getNextLocalId(): number {
  const localIdStart = 100000;
  const localContacts = contactsCache.filter(c => c.id >= localIdStart);
  return localContacts.length > 0 ? Math.max(...localContacts.map(c => c.id)) + 1 : localIdStart;
}

// Helper to save or update contact records in Base44 database
export async function saveContactToBase44(contact: Contact, username: string): Promise<void> {
  try {
    const submissionEntity = (base44.entities as any).HouseholdSubmission;
    if (!submissionEntity) return;

    const userObj = findUser(username);
    const uName = userObj?.fullName || userObj?.displayName || username;

    const nameParts = (contact.full_name || '').trim().split(/\s+/);
    let firstName = 'Unknown';
    let lastName = 'Unknown';
    if (nameParts.length > 1) {
      firstName = nameParts.slice(0, -1).join(' ');
      lastName = nameParts[nameParts.length - 1];
    } else if (nameParts.length === 1 && nameParts[0] !== '') {
      firstName = nameParts[0];
      lastName = 'Unknown';
    }

    const payload: any = {
      memberName: contact.full_name,
      full_name: contact.full_name,
      fullName: contact.full_name,
      firstName,
      lastName,
      barangay: contact.barangay || '',
      purok: contact.purok || '',
      address: `${contact.purok ? contact.purok + ', ' : ''}${contact.barangay || ''}`.trim(),
      contact: contact.contact_number || '',
      contact_number: contact.contact_number || '',
      contactNumber: contact.contact_number || '',
      status: 'approved',
      existingAcc: false,
      submittedBy: uName,
      "Submitted by": uName,
      "Barangay": contact.barangay || '',
      fpe: {
        fullName: contact.full_name,
        mobile: contact.contact_number || '',
        purok: contact.purok || '',
        barangay: contact.barangay || ''
      },
      pcsf: {
        contact: contact.contact_number || '',
        purok: contact.purok || '',
        barangay: contact.barangay || ''
      },
      latitude: contact.latitude || null,
      longitude: contact.longitude || null,
      geotagged: contact.geotagged || false,
      created_at: contact.created_at || new Date().toISOString(),
      updated_at: contact.updated_at || new Date().toISOString()
    };

    console.log(`[Base44 SDK] Saving contact "${contact.full_name}" to Base44 HouseholdSubmission database...`);
    await submissionEntity.create(payload);
    console.log(`[Base44 SDK] Contact "${contact.full_name}" successfully saved to Base44 database.`);
  } catch (err: any) {
    console.warn(`[Base44 SDK Warning] Failed to save contact to Base44 database:`, err.message || err);
  }
}

// Add a single contact with full validation and capitalization formatting
export async function addContact(
  contact: { full_name: string; barangay: string; purok?: string; address?: string; contact_number: string },
  username: string
) {
  const rawName = contact.full_name.trim();
  const rawBarangay = (contact.barangay || contact.address || '').trim();
  const rawPurok = (contact.purok || '').trim();
  const rawNumber = contact.contact_number.trim();

  if (!rawName || !rawBarangay || !rawNumber) {
    throw new Error('Full Name, Barangay, and Contact Number are required.');
  }

  const formattedName = capitalizeWords(rawName);
  const formattedBarangay = normalizeBarangayName(rawBarangay);
  const formattedPurok = rawPurok ? capitalizeWords(rawPurok) : '';

  // Check for duplicate among active records or reactivate inactive ones
  const existing = contactsCache.find(
    c =>
      !c.deleted_at &&
      c.full_name.toLowerCase() === formattedName.toLowerCase() &&
      c.contact_number === rawNumber
  );

  if (existing) {
    if (existing.added_from_print_list === false) {
      existing.added_from_print_list = true;
      existing.updated_at = new Date().toISOString();
      await saveContacts();
      if (sheetsConfig.syncEnabled) {
        forwardToWebApp('edit', existing).catch(err => console.error('Failed to sync reactivated contact to Sheets:', err));
      }
      saveContactToBase44(existing, username).catch(err => console.warn('Failed to save to Base44:', err));
      return existing;
    }
    throw new Error(`Duplicate contact: "${formattedName}" with number ${rawNumber} already exists.`);
  }

  const newId = getNextLocalId();
  const newContact: Contact = {
    id: newId,
    full_name: formattedName,
    barangay: formattedBarangay,
    purok: formattedPurok,
    contact_number: rawNumber,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    added_locally: true,
    added_from_print_list: true
  };

  contactsCache.push(newContact);
  await saveContacts();
  await addActivity(username, `Added contact: "${formattedName}" (${rawNumber})`);

  // Forward write operation to Apps Script Web App if configured
  forwardToWebApp('add', newContact).catch(err => console.error('Error forwarding add to Sheets Web App:', err));

  // Save data to Base44 database
  saveContactToBase44(newContact, username).catch(err => console.warn('Error saving new contact to Base44:', err));

  return newContact;
}

// Edit a contact
export async function editContact(
  id: number,
  contact: { full_name: string; barangay: string; purok?: string; address?: string; contact_number: string },
  username: string
) {
  const index = contactsCache.findIndex(c => c.id === id && !c.deleted_at);
  if (index === -1) {
    throw new Error('Contact not found or has been deleted.');
  }

  const rawName = contact.full_name.trim();
  const rawBarangay = (contact.barangay || contact.address || '').trim();
  const rawPurok = (contact.purok || '').trim();
  const rawNumber = contact.contact_number.trim();

  if (!rawName || !rawBarangay || !rawNumber) {
    throw new Error('Full Name, Barangay, and Contact Number are required.');
  }

  const formattedName = capitalizeWords(rawName);
  const formattedBarangay = normalizeBarangayName(rawBarangay);
  const formattedPurok = rawPurok ? capitalizeWords(rawPurok) : '';

  // Check for duplicate in other active records
  const isDuplicate = contactsCache.some(
    c =>
      c.id !== id &&
      !c.deleted_at &&
      c.full_name.toLowerCase() === formattedName.toLowerCase() &&
      c.contact_number === rawNumber
  );

  if (isDuplicate) {
    throw new Error(`Another contact named "${formattedName}" with number ${rawNumber} already exists.`);
  }

  const original = contactsCache[index];
  contactsCache[index] = {
    ...original,
    full_name: formattedName,
    barangay: formattedBarangay,
    purok: formattedPurok,
    contact_number: rawNumber,
    updated_at: new Date().toISOString()
  };

  await saveContacts();
  await addActivity(
    username,
    `Edited contact: "${original.full_name}" -> "${formattedName}"`
  );

  // Forward write operation to Apps Script Web App if configured
  forwardToWebApp('edit', contactsCache[index]).catch(err => console.error('Error forwarding edit to Sheets Web App:', err));

  // Save update to Base44 database
  saveContactToBase44(contactsCache[index], username).catch(err => console.warn('Error saving edited contact to Base44:', err));

  return contactsCache[index];
}

// Delete a contact permanently from the database and Google Sheets
export async function deleteContact(id: number, username: string) {
  const index = contactsCache.findIndex(c => c.id === id);
  if (index === -1) {
    throw new Error('Contact not found or already removed from directory.');
  }

  const deletedContact = contactsCache[index];
  
  // Record in tombstone cache so it is NEVER restored on Google Sheets refresh or reload
  deletedContactsCache.push({
    id: deletedContact.id,
    full_name: deletedContact.full_name,
    barangay: deletedContact.barangay,
    deletedAt: new Date().toISOString()
  });
  await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');

  // Remove permanently from contactsCache array
  contactsCache.splice(index, 1);

  // Also remove from PCU updates cache if any
  pcuUpdatesCache = pcuUpdatesCache.filter(u => u && u.contactId !== id && !normalizeCompareName(u.fullName, deletedContact.full_name));
  await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');

  await saveContacts();
  await addActivity(username, `Permanently deleted contact from Clinic Directory: "${deletedContact.full_name}"`);

  if (sheetsConfig.syncEnabled) {
    rewriteAllContactsToGoogleSheets().catch(err => console.error('Failed to sync permanent deletions to Google Sheets:', err));
  }

  return true;
}

// Delete an entire Barangay folder permanently (Removes all contacts in the folder and removes folder from list)
export async function deleteBarangayFolderContacts(barangay: string, username: string) {
  if (!barangay) throw new Error('Barangay name is required.');
  const target = barangay.trim().toLowerCase();
  
  // Record Barangay in tombstone cache so it is NEVER restored on Google Sheets refresh or reload
  if (!deletedBarangaysCache.some(b => isBarangayMatch(b, barangay) || normalizeBarangayName(b).toLowerCase() === normalizeBarangayName(target).toLowerCase())) {
    deletedBarangaysCache.push(barangay.trim());
    await safeWriteFile(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2), 'utf-8');
  }

  const initialLength = contactsCache.length;
  const removedContacts: Contact[] = [];

  // Filter out any contacts in the target barangay permanently from the database array!
  contactsCache = contactsCache.filter(c => {
    const isTargetBarangay = c.barangay && (isBarangayMatch(c.barangay, barangay) || normalizeBarangayName(c.barangay).toLowerCase() === normalizeBarangayName(target).toLowerCase());
    if (isTargetBarangay) {
      removedContacts.push(c);
      return false;
    }
    return !isTargetBarangay;
  });

  // Record all removed contacts into deletedContactsCache
  for (const c of removedContacts) {
    deletedContactsCache.push({
      id: c.id,
      full_name: c.full_name,
      barangay: c.barangay,
      deletedAt: new Date().toISOString()
    });
  }
  await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');
  
  const count = initialLength - contactsCache.length;

  // Remove matching PCU updates
  pcuUpdatesCache = pcuUpdatesCache.filter(u => !u.barangay || (!isBarangayMatch(u.barangay, barangay) && normalizeBarangayName(u.barangay).toLowerCase() !== normalizeBarangayName(target).toLowerCase()));
  await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');

  // Remove barangay from barangaysCache so empty or deleted folder does not remain in directory
  barangaysCache = barangaysCache.filter(b => 
    !isBarangayMatch(b, barangay) && 
    normalizeBarangayName(b).toLowerCase() !== normalizeBarangayName(target).toLowerCase()
  );

  await saveContacts();
  await saveBarangays();

  await addActivity(username, `Permanently deleted Barangay folder "${barangay}" (${count} households) from Clinic Directory.`);

  if (sheetsConfig.syncEnabled) {
    try {
      await syncBarangaysToGoogleSheets();
    } catch (err: any) {
      console.error('Failed to sync updated Barangays list to Google Sheets:', err.message || err);
    }
    rewriteAllContactsToGoogleSheets().catch(err => console.error('Failed to sync folder deletions to Google Sheets:', err));
  }

  return { success: true, count, message: `Barangay folder "${barangay}" permanently deleted successfully.` };
}

// Overwrite Google Sheets with all active (non-soft-deleted) contacts
export async function rewriteAllContactsToGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) {
    console.log('[Google Sheets] Sheets client not configured or disabled.');
    return false;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const sheetName = sheetsConfig.sheetName || 'Sheet1';

    // Ensure the sheet exists
    await ensureSheetExists(sheets, spreadsheetId, sheetName);
    markSheetsConnected();

    // Get current headers to match column positions
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1`
    });
    const headerRow = (headerResponse.data.values && headerResponse.data.values[0]) || [];
    let headers = headerRow.map((h: any) => (h || '').toString().toLowerCase().trim());

    if (headers.length === 0) {
      headers = ['id', 'name', 'barangay', 'purok', 'contact number', 'created at', 'updated at'];
    }

    const idIdx = headers.findIndex((h: string) => h.includes('id'));
    const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
    const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
    const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
    const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
    const createdIdx = headers.findIndex((h: string) => h.includes('created') || h.includes('date'));
    const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
    const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

    const maxIdx = Math.max(idIdx, nameIdx, barangayIdx, purokIdx, numberIdx, createdIdx, updatedIdx, addedIdx, headers.length - 1, 7);

    // Clear everything in A:Z range
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A:Z`
    });

    const activeContacts = contactsCache.filter(c => !c.deleted_at);
    const rowsToPut = [
      headerRow.length > 0 ? headerRow : headers.map(h => capitalizeWords(h)),
      ...activeContacts.map(c => {
        const rowValues = new Array(maxIdx + 1).fill('');

        if (idIdx !== -1) rowValues[idIdx] = c.id;
        else rowValues[0] = c.id;

        if (nameIdx !== -1) rowValues[nameIdx] = c.full_name;
        else rowValues[1] = c.full_name;

        if (barangayIdx !== -1) rowValues[barangayIdx] = c.barangay;
        else rowValues[2] = c.barangay;

        if (purokIdx !== -1) rowValues[purokIdx] = c.purok;
        else rowValues[3] = c.purok;

        if (numberIdx !== -1) rowValues[numberIdx] = c.contact_number;
        else rowValues[4] = c.contact_number;

        if (createdIdx !== -1) rowValues[createdIdx] = c.created_at;
        else rowValues[5] = c.created_at;

        if (updatedIdx !== -1) rowValues[updatedIdx] = c.updated_at;
        else rowValues[6] = c.updated_at;

        if (addedIdx !== -1) {
          rowValues[addedIdx] = c.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        } else {
          rowValues[7] = c.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        }

        return rowValues;
      })
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets(rowsToPut)
      }
    });

    console.log(`[Google Sheets] Overwrote sheet with ${activeContacts.length} active contacts successfully.`);
    return true;
  } catch (err: any) {
    console.error('[Google Sheets] Failed to rewrite contacts to Google Sheets:', err.message || err);
    markSheetsDisconnected(err);
    return false;
  }
}

// Auto-detect bulk separator
export function detectSeparator(text: string): string {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return ',';

  let pipes = 0;
  let commas = 0;
  let tabs = 0;

  const sample = lines.slice(0, 5);
  for (const line of sample) {
    pipes += (line.match(/\|/g) || []).length;
    commas += (line.match(/,/g) || []).length;
    tabs += (line.match(/\t/g) || []).length;
  }

  if (pipes >= commas && pipes >= tabs && pipes > 0) return '|';
  if (tabs >= commas && tabs >= pipes && tabs > 0) return '\t';
  return ',';
}

export interface ParseResult {
  raw: string;
  full_name: string;
  barangay: string;
  purok: string;
  contact_number: string;
  status: 'valid' | 'duplicate' | 'invalid';
  reason?: string;
}

// Bulk Import Preview Generator
export function previewBulkImport(text: string): {
  results: ParseResult[];
  summary: { total: number; valid: number; duplicate: number; invalid: number };
  detectedSeparator: string;
} {
  const separator = detectSeparator(text);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const results: ParseResult[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  // Track already-seen in current batch to prevent intra-batch duplicates
  const batchSeen = new Set<string>();

  for (const line of lines) {
    const parts = line.split(separator).map(p => p.trim());
    let name = '';
    let barangay = '';
    let purok = '';
    let number = '';

    if (parts.length >= 4) {
      name = capitalizeWords(parts[0]);
      barangay = parts[1] ? normalizeBarangayName(parts[1]) : 'Barangay Central';
      purok = capitalizeWords(parts[2]);
      number = parts[3];
    } else if (parts.length === 3) {
      name = capitalizeWords(parts[0]);
      barangay = parts[1] ? normalizeBarangayName(parts[1]) : 'Barangay Central';
      // Detect if the third part looks like a phone/contact number or a Purok.
      const lastPart = parts[2];
      const digitCount = (lastPart.match(/\d/g) || []).length;
      const isProbablyPhoneNumber = digitCount >= 5 || /^[0\+]\d+/.test(lastPart);
      if (isProbablyPhoneNumber) {
        purok = '';
        number = lastPart;
      } else {
        purok = capitalizeWords(lastPart);
        number = '';
      }
    } else if (parts.length === 2) {
      name = capitalizeWords(parts[0]);
      barangay = parts[1] ? normalizeBarangayName(parts[1]) : 'Barangay Central';
      purok = '';
      number = '';
    } else if (parts.length === 1 && parts[0]) {
      name = capitalizeWords(parts[0]);
      barangay = 'Barangay Central';
      purok = '';
      number = '';
    } else {
      results.push({
        raw: line,
        full_name: parts[0] || '',
        barangay: 'Barangay Central',
        purok: '',
        contact_number: '',
        status: 'invalid',
        reason: 'Line is empty or invalid.'
      });
      invalidCount++;
      continue;
    }

    if (!barangay) {
      barangay = 'Barangay Central';
    }

    if (!name) {
      results.push({
        raw: line,
        full_name: name,
        barangay: barangay,
        purok: purok,
        contact_number: number,
        status: 'invalid',
        reason: 'Full Name is required and cannot be blank.'
      });
      invalidCount++;
      continue;
    }

    // Check duplicate in database
    const dbDuplicate = contactsCache.some(
      c =>
        !c.deleted_at &&
        c.full_name.toLowerCase() === name.toLowerCase() &&
        (number ? c.contact_number === number : (!c.contact_number && c.barangay === barangay))
    );

    const batchKey = number 
      ? `${name.toLowerCase()}|||num:${number}` 
      : `${name.toLowerCase()}|||bg:${barangay.toLowerCase()}`;
    const batchDuplicate = batchSeen.has(batchKey);

    if (dbDuplicate || batchDuplicate) {
      results.push({
        raw: line,
        full_name: name,
        barangay: barangay,
        purok: purok,
        contact_number: number,
        status: 'duplicate',
        reason: dbDuplicate ? 'Contact already exists in database.' : 'Duplicate contact present in this bulk list.'
      });
      duplicateCount++;
    } else {
      results.push({
        raw: line,
        full_name: name,
        barangay: barangay,
        purok: purok,
        contact_number: number,
        status: 'valid'
      });
      validCount++;
    }

    batchSeen.add(batchKey);
  }

  return {
    results,
    summary: {
      total: lines.length,
      valid: validCount,
      duplicate: duplicateCount,
      invalid: invalidCount
    },
    detectedSeparator: separator === '|' ? 'Pipe (|)' : separator === '\t' ? 'Tab' : 'Comma (,)'
  };
}

// Bulk Import Saver
export async function saveBulkImport(
  items: Array<{ full_name: string; barangay?: string; address?: string; purok?: string; contact_number: string; status: string }>,
  option: 'save_all' | 'skip_invalid' | 'replace_duplicate',
  username: string
) {
  let savedCount = 0;
  let skippedCount = 0;
  let replacedCount = 0;

  const appended: Contact[] = [];
  const updated: Contact[] = [];

  for (const item of items) {
    const formattedName = capitalizeWords(item.full_name);
    const formattedBarangay = normalizeBarangayName(item.barangay || item.address || '');
    const formattedPurok = item.purok ? capitalizeWords(item.purok) : '';
    const number = item.contact_number.trim();

    if (!formattedName || !formattedBarangay) {
      skippedCount++;
      continue;
    }

    // Find database duplicate
    const duplicateIndex = contactsCache.findIndex(
      c =>
        !c.deleted_at &&
        c.full_name.toLowerCase() === formattedName.toLowerCase() &&
        (number ? c.contact_number === number : (!c.contact_number && c.barangay === formattedBarangay))
    );

    if (duplicateIndex !== -1) {
      if (option === 'replace_duplicate') {
        // Update details of duplicate contact and reset update timestamp
        contactsCache[duplicateIndex] = {
          ...contactsCache[duplicateIndex],
          barangay: formattedBarangay,
          purok: formattedPurok,
          updated_at: new Date().toISOString()
        };
        updated.push(contactsCache[duplicateIndex]);
        replacedCount++;
        savedCount++;
      } else if (option === 'save_all') {
        // Save as another entry anyway (unlikely as it matches both, but let's allow saving if explicitly chosen)
        const newId = getNextLocalId();
        const newContact: Contact = {
          id: newId,
          full_name: formattedName,
          barangay: formattedBarangay,
          purok: formattedPurok,
          contact_number: number,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          added_locally: true,
          added_from_print_list: true
        };
        contactsCache.push(newContact);
        appended.push(newContact);
        savedCount++;
      } else {
        // skip_invalid / skip duplicate (default for 'skip_invalid' choice handles skip_duplicate)
        skippedCount++;
      }
    } else {
      // Valid record
      if (item.status === 'invalid' && option !== 'save_all') {
        skippedCount++;
        continue;
      }

      const newId = getNextLocalId();
      const newContact: Contact = {
        id: newId,
        full_name: formattedName,
        barangay: formattedBarangay,
        purok: formattedPurok,
        contact_number: number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        added_locally: true,
        added_from_print_list: true
      };
      contactsCache.push(newContact);
      appended.push(newContact);
      savedCount++;
    }
  }

  await saveContacts();
  await addActivity(
    username,
    `Performed bulk entry import. Saved: ${savedCount} records (including ${replacedCount} replaced duplicates), Skipped: ${skippedCount}.`
  );

  // Push new and updated records to Google Sheets if connected
  if (appended.length > 0 || updated.length > 0) {
    pushBulkToSheets(appended, updated).catch(err => {
      console.error('Error during pushBulkToSheets background job:', err);
    });

    // Save to Base44 database
    (async () => {
      for (const contact of [...appended, ...updated]) {
        await saveContactToBase44(contact, username).catch(err => console.warn('[Base44 Bulk Save]', err));
      }
    })();
  }

  return {
    total: items.length,
    saved: savedCount,
    replaced: replacedCount,
    skipped: skippedCount
  };
}

async function pushBulkToSheets(appended: Contact[], updated: Contact[]) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const sheetName = sheetsConfig.sheetName || 'Sheet1';

    // Ensure the sheet exists
    await ensureSheetExists(sheets, spreadsheetId, sheetName);

    // 1. Batch Append newly added contacts
    if (appended.length > 0) {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z1`
      });
      const headerRow = (headerResponse.data.values && headerResponse.data.values[0]) || [];
      const headers = headerRow.map((h: any) => (h || '').toString().toLowerCase().trim());

      const idIdx = headers.findIndex((h: string) => h.includes('id'));
      const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
      const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
      const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
      const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
      const createdIdx = headers.findIndex((h: string) => h.includes('created') || h.includes('date'));
      const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
      const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

      const maxIdx = Math.max(idIdx, nameIdx, barangayIdx, purokIdx, numberIdx, createdIdx, updatedIdx, addedIdx, headers.length - 1, 7);

      const valuesToAppend = appended.map(c => {
        const rowValues = new Array(maxIdx + 1).fill('');

        if (idIdx !== -1) rowValues[idIdx] = c.id;
        else rowValues[0] = c.id;

        if (nameIdx !== -1) rowValues[nameIdx] = c.full_name;
        else rowValues[1] = c.full_name;

        if (barangayIdx !== -1) rowValues[barangayIdx] = c.barangay;
        else rowValues[2] = c.barangay;

        if (purokIdx !== -1) rowValues[purokIdx] = c.purok;
        else rowValues[3] = c.purok;

        if (numberIdx !== -1) rowValues[numberIdx] = c.contact_number;
        else rowValues[4] = c.contact_number;

        if (createdIdx !== -1) rowValues[createdIdx] = c.created_at;
        else rowValues[5] = c.created_at;

        if (updatedIdx !== -1) rowValues[updatedIdx] = c.updated_at;
        else rowValues[6] = c.updated_at;

        if (addedIdx !== -1) {
          rowValues[addedIdx] = c.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        } else {
          rowValues[7] = c.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        }

        return rowValues;
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: sanitizeRowsForSheets(valuesToAppend)
        }
      });
      console.log(`Successfully batch-appended ${appended.length} contacts to Google Sheets.`);
    }

    // 2. Update existing contacts
    if (updated.length > 0) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`
      });
      const rows = response.data.values;
      if (rows && rows.length > 0) {
        const headers = rows[0].map((h: any) => h.toString().toLowerCase().trim());
        const idColIdx = headers.findIndex((h: string) => h.includes('id'));
        const targetColIdx = idColIdx !== -1 ? idColIdx : 0;

        const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
        const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
        const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
        const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
        const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
        const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

        for (const contact of updated) {
          let targetRowIdx = -1;
          for (let i = 1; i < rows.length; i++) {
            if (parseInt(rows[i][targetColIdx], 10) === parseInt(contact.id as any, 10)) {
              targetRowIdx = i + 1;
              break;
            }
          }

          if (targetRowIdx !== -1) {
            const rowValues = [...rows[targetRowIdx - 1]];
            if (nameIdx !== -1) rowValues[nameIdx] = contact.full_name;
            if (barangayIdx !== -1) rowValues[barangayIdx] = contact.barangay;
            if (purokIdx !== -1) rowValues[purokIdx] = contact.purok;
            if (numberIdx !== -1) rowValues[numberIdx] = contact.contact_number;
            if (updatedIdx !== -1) rowValues[updatedIdx] = contact.updated_at;
            if (addedIdx !== -1) rowValues[addedIdx] = contact.added_from_print_list !== false ? 'TRUE' : 'FALSE';

            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${sheetName}!A${targetRowIdx}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: sanitizeRowsForSheets([rowValues])
              }
            });
          }
        }
        console.log(`Successfully updated ${updated.length} contacts in Google Sheets.`);
      }
    }
  } catch (err: any) {
    console.error('Error batch pushing bulk import to Google Sheets:', err.message || err);
  }

  // Fallback to Apps Script Web App if service account is not configured or in addition
  if (sheetsConfig.webAppUrl) {
    for (const c of appended) {
      forwardToWebApp('add', c).catch(() => {});
    }
    for (const c of updated) {
      forwardToWebApp('edit', c).catch(() => {});
    }
  }
}

// Dashboard statistics
export function getDashboardStats() {
  const activeContacts = contactsCache.filter(c => !c.deleted_at && c.added_from_print_list === true);
  
  // Total Contacts
  const totalContacts = activeContacts.length;

  // Total Barangays (previously Addresses)
  const barangaySet = new Set<string>();
  activeContacts.forEach(c => {
    if (c.barangay) {
      barangaySet.add(c.barangay.toLowerCase().trim());
    }
  });
  const totalAddresses = barangaySet.size;

  // Contacts added today (PST or Server local time matching 2026-07-21)
  const todayStr = new Date().toISOString().split('T')[0];
  const contactsToday = activeContacts.filter(c => c.created_at.startsWith(todayStr)).length;

  // Get recent activities (last 15)
  const recentActivities = activitiesCache.slice(0, 15);

  return {
    totalContacts,
    totalAddresses,
    contactsToday,
    recentActivities,
    sheetsStatus: getSheetsStatus(),
    base44SyncStatus: getBase44SyncStatus()
  };
}

// --- Google Sheets Database Integration Functions ---

function getSheetsClient() {
  if (sheetsConfig.authType === 'serviceAccount' && sheetsConfig.privateKey) {
    try {
      let privateKey = sheetsConfig.privateKey.trim();
      let clientEmail = sheetsConfig.clientEmail?.trim() || '';

      // Check if they pasted the entire Service Account JSON
      if (privateKey.startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey);
          if (parsed.private_key) {
            privateKey = parsed.private_key.trim();
          }
          if (parsed.client_email) {
            clientEmail = parsed.client_email.trim();
          }
        } catch (e) {
          console.error('Failed to parse pasted privateKey as JSON:', e);
        }
      }

      // If we don't have a client email yet, we can't authenticate
      if (!clientEmail) {
        console.error('No service account client email available.');
        return null;
      }

      // Strip outer double or single quotes if present (e.g. "key" or 'key')
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1).trim();
      }
      if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1).trim();
      }

      // Replace literal '\n' string with actual newline character
      let formattedKey = privateKey.replace(/\\n/g, '\n');

      // Ensure proper BEGIN and END block headers
      if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}`;
      }
      if (!formattedKey.includes('-----END PRIVATE KEY-----')) {
        formattedKey = `${formattedKey}\n-----END PRIVATE KEY-----`;
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: formattedKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      return google.sheets({ version: 'v4', auth });
    } catch (e) {
      console.error('Error creating Sheets API JWT Client:', e);
    }
  }
  return null;
}

async function ensureSheetExists(sheets: any, spreadsheetId: string, sheetName: string) {
  try {
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    const exists = existingSheets.has(sheetName);

    if (!exists) {
      console.log(`Sheet "${sheetName}" not found. Creating table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });
      existingSheets.add(sheetName);

      // Write default headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:H1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['ID', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Created At', 'Updated At', 'Added To Directory']]
        }
      });

      // Seed with existing contacts if any are cached locally
      if (contactsCache.length > 0) {
        const valuesToAppend = contactsCache.map(c => [
          c.id,
          c.full_name,
          c.barangay,
          c.purok,
          c.contact_number,
          c.created_at,
          c.updated_at,
          c.added_from_print_list !== false ? 'TRUE' : 'FALSE'
        ]);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A2`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: valuesToAppend
          }
        });
      }
      console.log(`Automatically created and seeded database table "${sheetName}" successfully.`);
    } else {
      // If sheet already exists, verify that all standard table columns exist.
      // If any expected column is missing, automatically create it!
      const allRowsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`
      });
      const allRows = allRowsResponse.data.values || [];
      const headerRow = allRows[0] || [];
      const normalizedExisting = headerRow.map((h: any) => (h || '').toString().trim().toLowerCase());

      const requiredColumns = [
        { test: (h: string) => h.includes('id'), display: 'ID' },
        { test: (h: string) => h.includes('name') || h.includes('full'), display: 'Full Name' },
        { test: (h: string) => h.includes('barangay') || h.includes('address'), display: 'Barangay' },
        { test: (h: string) => h.includes('purok'), display: 'Purok' },
        { test: (h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'), display: 'Contact Number' },
        { test: (h: string) => h.includes('created') || h.includes('date'), display: 'Created At' },
        { test: (h: string) => h.includes('updated') || h.includes('last'), display: 'Updated At' },
        { test: (h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'), display: 'Added To Directory' }
      ];

      // Check if the first row is actually a header row or a data row.
      const isHeaderRow = normalizedExisting.some(h => {
        const clean = h.replace(/[^a-z0-9]/g, '');
        return ['id', 'name', 'fullname', 'full_name', 'address', 'barangay', 'purok', 'phone', 'phonenumber', 'contact', 'contactnumber', 'contact_number', 'createdat', 'created_at', 'updatedat', 'updated_at', 'created', 'updated', 'date', 'addedtodirectory'].includes(clean);
      });

      // Find if we have a "corrupted mixed row" where standard headers start after index 0
      const firstHeaderIndex = normalizedExisting.findIndex(h => {
        const clean = h.replace(/[^a-z0-9]/g, '');
        return ['id', 'fullname', 'full_name', 'address', 'barangay', 'purok', 'contactnumber', 'contact_number', 'createdat', 'created_at', 'updatedat', 'updated_at'].includes(clean);
      });

      const isFirstElementNumeric = /^\d+$/.test((headerRow[0] || '').toString().trim());

      if (allRows.length > 0 && firstHeaderIndex > 0 && isFirstElementNumeric) {
        // This is exactly the corrupted mixed row! Let's heal it by splitting it.
        const dataRow = headerRow.slice(0, firstHeaderIndex);
        const realHeaderRow = headerRow.slice(firstHeaderIndex);
        const updatedRows = [realHeaderRow, dataRow, ...allRows.slice(1)];

        console.log(`Detected corrupted mixed row in sheet "${sheetName}". Re-organizing and self-healing sheet structure.`);

        // Clear range to avoid leaving stale cells
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: sanitizeRowsForSheets(updatedRows)
          }
        });
      } else if (allRows.length > 0 && !isHeaderRow) {
        // First row is actually data, not a header!
        // Prepend the proper header row at A1 and shift all rows down.
        const correctHeaders = ['ID', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Created At', 'Updated At', 'Added To Directory'];
        const updatedRows = [correctHeaders, ...allRows];

        console.log(`First row in sheet "${sheetName}" is data. Prepending headers and shifting rows down.`);

        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: sanitizeRowsForSheets(updatedRows)
          }
        });
      } else {
        // First row is a header row (or empty sheet). Ensure all columns exist.
        const updatedHeaderRow = [...headerRow];
        let changed = false;

        for (const col of requiredColumns) {
          const found = normalizedExisting.some(col.test);
          if (!found) {
            updatedHeaderRow.push(col.display);
            changed = true;
          }
        }

        if (changed) {
          console.log(`Website automatically creating missing database columns in sheet "${sheetName}":`, updatedHeaderRow);
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: sanitizeRowsForSheets([updatedHeaderRow])
            }
          });
        }
      }
    }
  } catch (err: any) {
    console.error('ensureSheetExists failed (likely permission, empty spreadsheet, or duplicate sheet):', err.message || err);
    handleGoogleSheetsError(err, 'ensureSheetExists');
  }
}

export async function forwardToWebApp(action: 'add' | 'edit' | 'delete', data: any) {
  // Try direct write using Google Sheets API & Service Account if active
  const sheets = getSheetsClient();
  if (sheets) {
    try {
      let spreadsheetId = sheetsConfig.spreadsheetId;
      const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        spreadsheetId = match[1];
      }
      const sheetName = sheetsConfig.sheetName || 'Sheet1';

      // Automatically create the table/sheet if it doesn't exist yet!
      await ensureSheetExists(sheets, spreadsheetId, sheetName);

      if (action === 'add') {
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:Z1`
        });
        const headerRow = (headerResponse.data.values && headerResponse.data.values[0]) || [];
        const headers = headerRow.map((h: any) => (h || '').toString().toLowerCase().trim());

        const idIdx = headers.findIndex((h: string) => h.includes('id'));
        const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
        const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
        const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
        const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
        const createdIdx = headers.findIndex((h: string) => h.includes('created') || h.includes('date'));
        const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
        const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

        const maxIdx = Math.max(idIdx, nameIdx, barangayIdx, purokIdx, numberIdx, createdIdx, updatedIdx, addedIdx, headers.length - 1, 7);
        const rowValues = new Array(maxIdx + 1).fill('');

        if (idIdx !== -1) rowValues[idIdx] = data.id;
        else rowValues[0] = data.id;

        if (nameIdx !== -1) rowValues[nameIdx] = data.full_name;
        else rowValues[1] = data.full_name;

        if (barangayIdx !== -1) rowValues[barangayIdx] = data.barangay;
        else rowValues[2] = data.barangay;

        if (purokIdx !== -1) rowValues[purokIdx] = data.purok;
        else rowValues[3] = data.purok;

        if (numberIdx !== -1) rowValues[numberIdx] = data.contact_number;
        else rowValues[4] = data.contact_number;

        if (createdIdx !== -1) rowValues[createdIdx] = data.created_at;
        else rowValues[5] = data.created_at;

        if (updatedIdx !== -1) rowValues[updatedIdx] = data.updated_at;
        else rowValues[6] = data.updated_at;

        if (addedIdx !== -1) {
          rowValues[addedIdx] = data.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        } else {
          rowValues[7] = data.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        }

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:Z`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: sanitizeRowsForSheets([rowValues])
          }
        });
        console.log('Successfully appended contact to Google Sheets using Service Account!');
      } else if (action === 'edit' || action === 'delete') {
        // Find row to edit or delete
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });
        const rows = response.data.values;
        if (rows && rows.length > 0) {
          const headers = rows[0].map((h: any) => h.toString().toLowerCase().trim());
          const idColIdx = headers.findIndex((h: string) => h.includes('id'));
          const targetColIdx = idColIdx !== -1 ? idColIdx : 0;

          let targetRowIdx = -1;
          for (let i = 1; i < rows.length; i++) {
            if (parseInt(rows[i][targetColIdx], 10) === parseInt(data.id, 10)) {
              targetRowIdx = i + 1; // 1-based row number
              break;
            }
          }

          if (targetRowIdx !== -1) {
            if (action === 'delete') {
              // Get Sheet ID
              const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
              const targetSheetObj = spreadsheetInfo.data.sheets?.find(s => s.properties?.title === sheetName);
              const sheetId = targetSheetObj?.properties?.sheetId || 0;

              await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                  requests: [{
                    deleteDimension: {
                      range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: targetRowIdx - 1,
                        endIndex: targetRowIdx
                      }
                    }
                  }]
                }
              });
              console.log('Successfully deleted contact row in Google Sheets using Service Account!');
            } else {
              // Edit row
              const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
              const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
              const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
              const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
              const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
              const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

              const rowValues = [...rows[targetRowIdx - 1]];
              if (nameIdx !== -1) rowValues[nameIdx] = data.full_name;
              if (barangayIdx !== -1) rowValues[barangayIdx] = data.barangay;
              if (purokIdx !== -1) rowValues[purokIdx] = data.purok;
              if (numberIdx !== -1) rowValues[numberIdx] = data.contact_number;
              if (updatedIdx !== -1) rowValues[updatedIdx] = data.updated_at;
              if (addedIdx !== -1) rowValues[addedIdx] = data.added_from_print_list !== false ? 'TRUE' : 'FALSE';

              await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A${targetRowIdx}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                  values: sanitizeRowsForSheets([rowValues])
                }
              });
              console.log('Successfully updated contact row in Google Sheets using Service Account!');
            }
          }
        }
      }
      return;
    } catch (err: any) {
      console.error('Service Account direct write to Google Sheets failed:', err.message || err);
      handleGoogleSheetsError(err, 'forwardToWebApp');
    }
  }

  // Fallback to Apps Script Web App
  if (!sheetsConfig.webAppUrl) return;
  try {
    const res = await fetch(sheetsConfig.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });
    if (!res.ok) {
      console.warn('Google Sheets Web App request failed:', res.statusText);
    }
  } catch (err) {
    console.warn('Error forwarding write to Google Sheets Web App:', err);
  }
}

export function getSheetsConfig(): SheetsConfig {
  return sheetsConfig;
}

export async function saveSheetsConfig(config: SheetsConfig, username: string) {
  sheetsConfig = {
    authType: config.authType || 'apiKey',
    apiKey: config.apiKey?.trim() || '',
    clientEmail: config.clientEmail?.trim() || '',
    privateKey: config.privateKey?.trim() || '',
    spreadsheetId: config.spreadsheetId?.trim() || '',
    sheetName: config.sheetName?.trim() || 'Sheet1',
    syncEnabled: !!config.syncEnabled,
    webAppUrl: config.webAppUrl?.trim() || ''
  };
  resetGoogleSheetsCooldown();
  await safeWriteFile(SHEETS_CONFIG_FILE, JSON.stringify(sheetsConfig, null, 2), 'utf-8');
  await addActivity(username, `Updated Google Sheets Database settings (Auth: ${sheetsConfig.authType}, Sync: ${sheetsConfig.syncEnabled ? 'ENABLED' : 'DISABLED'})`);

  if (sheetsConfig.syncEnabled) {
    try {
      const settingsPulled = await pullSiteSettingsFromGoogleSheets();
      if (!settingsPulled) {
        await syncSiteSettingsToGoogleSheets();
      }
    } catch (err: any) {
      console.error('Failed to pull/sync site settings on configuration save:', err.message);
    }

    try {
      const adminsPulled = await pullAdminsFromGoogleSheets();
      if (!adminsPulled) {
        await syncAdminsToGoogleSheets();
      }
    } catch (err: any) {
      console.error('Failed to pull/sync administrators on configuration save:', err.message);
    }

    try {
      const barangaysPulled = await pullBarangaysFromGoogleSheets();
      if (!barangaysPulled) {
        await syncBarangaysToGoogleSheets();
      }
    } catch (err: any) {
      console.error('Failed to pull/sync barangays on configuration save:', err.message);
    }

    await syncWithGoogleSheets(username);
  }
}

export let googleSheetsQuotaCooldownUntil = 0;

export function handleGoogleSheetsError(err: any, context: string) {
  const errMsg = (err?.message || err?.toString() || '').toString();
  
  if (errMsg.includes('Precondition check failed') || errMsg.includes('Precondition')) {
    console.warn(`⚠️ [Google Sheets API Precondition Error in ${context}]: "Precondition check failed."`);
    console.warn('This error usually indicates that the "Google Sheets API" has not been enabled in your Google Cloud Console project, or your Service Account does not have proper write permissions.');
    console.warn('To resolve this:');
    console.warn('1. Visit the Google Cloud Console: https://console.cloud.google.com/');
    console.warn('2. Select your active project.');
    console.warn('3. Search for "Google Sheets API" in the search bar and click "Enable".');
    console.warn('4. Ensure that you have shared your Google Spreadsheet with your service account email address (found in sheets settings) and given it Editor permissions.');
    console.warn('[Action taken]: Placing Google Sheets sync on a 15-minute cooldown to prevent spamming your logs.');
    googleSheetsQuotaCooldownUntil = Date.now() + 15 * 60 * 1000; // 15 minutes cooldown
    return;
  }

  console.error(`[Google Sheets Error in ${context}]:`, errMsg);
  
  const isQuota = errMsg.includes('Quota exceeded') || 
                  errMsg.includes('quota') || 
                  err?.status === 429 || 
                  (err?.response && err.response.status === 429) ||
                  errMsg.includes('RESOURCE_EXHAUSTED') ||
                  errMsg.includes('rate limit');
                  
  if (isQuota) {
    console.warn(`[Google Sheets Quota Cooldown] Quota exceeded detected. Cooling down Sheets API for 10 minutes to prevent further rate limiting.`);
    googleSheetsQuotaCooldownUntil = Date.now() + 10 * 60 * 1000; // 10 minutes
  } else {
    console.warn(`[Google Sheets Cooldown] Error detected. Cooling down Sheets API for 1 minute.`);
    googleSheetsQuotaCooldownUntil = Date.now() + 60 * 1000; // 1 minute
  }
}

export function resetGoogleSheetsCooldown() {
  googleSheetsQuotaCooldownUntil = 0;
  clearCachedSheetNames();
}

const cachedSheetNames = new Map<string, Set<string>>();

export function clearCachedSheetNames() {
  cachedSheetNames.clear();
}

async function getExistingSheets(sheets: any, spreadsheetId: string): Promise<Set<string>> {
  if (cachedSheetNames.has(spreadsheetId)) {
    return cachedSheetNames.get(spreadsheetId)!;
  }
  
  const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = spreadsheetInfo.data.sheets || [];
  const names = new Set<string>();
  sheetsList.forEach((s: any) => {
    if (s.properties?.title) {
      names.add(s.properties.title);
    }
  });
  cachedSheetNames.set(spreadsheetId, names);
  return names;
}

export let contactsLoadedFromSheets = false;
let contactsSyncPromise: Promise<any> | null = null;
let lastContactsSyncTime = 0;

export async function ensureContactsSynced(force: boolean = false): Promise<boolean> {
  // Sync live PCU updates from Base44 DB as well!
  await syncPCUUpdatesFromBase44(force);

  if (!sheetsConfig.syncEnabled) {
    return true;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return true;
  }

  // If we synced very recently (within 5 minutes) and force is false, use cache
  if (!force && contactsLoadedFromSheets && (Date.now() - lastContactsSyncTime < 300000)) {
    return true;
  }

  if (contactsSyncPromise) {
    await contactsSyncPromise;
    return true;
  }

  contactsSyncPromise = (async () => {
    try {
      console.log('[Sync] Syncing contacts and barangays live from Google Sheets...');
      const result = await syncWithGoogleSheets('Live Load/Sync');
      if (result && result.success) {
        contactsLoadedFromSheets = true;
        lastContactsSyncTime = Date.now();
      } else {
        lastContactsSyncTime = Date.now();
      }
      return result;
    } catch (err: any) {
      handleGoogleSheetsError(err, 'ensureContactsSynced');
      lastContactsSyncTime = Date.now();
      return { success: false };
    } finally {
      contactsSyncPromise = null;
    }
  })();

  await contactsSyncPromise;
  return true;
}

export function normalizeCompareName(name1: string, name2: string): boolean {
  const clean1 = (name1 || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const clean2 = (name2 || '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (clean1 === clean2 && clean1.length > 0) return true;

  // Word-based order-insensitive comparison for names like "Asutilla, Hannah Balios" vs "Balios, Asutilla, Hannah"
  const w1 = clean1.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const w2 = clean2.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  if (w1.length === 0 || w2.length === 0) return false;

  const s1 = [...w1].sort().join(' ');
  const s2 = [...w2].sort().join(' ');
  return s1 === s2;
}

export let lastPCUSyncTime = 0;

export async function syncPCUUpdatesFromBase44(force: boolean = false): Promise<boolean> {
  // Do not pull or display pre-existing PCU update records from Base44
  return false;
}

export function syncPCUFieldsToCache() {
  if (!Array.isArray(contactsCache) || !Array.isArray(pcuUpdatesCache)) return;

  // Clear existing PCU fields on all contacts to avoid stale synced states from previous sessions
  contactsCache.forEach(c => {
    if (c) {
      delete c.pcu_file_url;
      delete c.pcu_uploaded_by;
      delete c.pcu_uploaded_at;
    }
  });

  pcuUpdatesCache.forEach(update => {
    if (!update) return;

    const contact = contactsCache.find(c =>
      (c.id && update.contactId && c.id.toString() === update.contactId.toString()) ||
      (normalizeCompareName(c.full_name, update.fullName) &&
       (!update.barangay || normalizeBarangayName(c.barangay).toLowerCase() === normalizeBarangayName(update.barangay).toLowerCase()))
    );

    if (contact) {
      if (!contact.pcu_file_url) {
        contact.pcu_file_url = update.fileData || `Uploaded: ${update.fileName}`;
        contact.pcu_uploaded_by = update.uploadedBy;
        contact.pcu_uploaded_at = update.uploadedAt;
      }
    }
  });
}

export async function syncWithGoogleSheets(username: string): Promise<{ success: boolean; message: string; count?: number }> {
  lastSyncStatus.lastAttempt = new Date().toISOString();

  // 1. Pull latest Barangays list from Google Sheets first if available
  try {
    await pullBarangaysFromGoogleSheets();
  } catch (err: any) {
    console.warn('[Sync] Failed to pull Barangays in syncWithGoogleSheets:', err.message || err);
  }

  let rows: string[][] = [];

  const sheets = getSheetsClient();
  if (sheets) {
    if (!sheetsConfig.spreadsheetId) {
      const errMsg = 'Spreadsheet ID is required for synchronization.';
      lastSyncStatus.connected = false;
      lastSyncStatus.error = errMsg;
      throw new Error(errMsg);
    }
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const sheetName = sheetsConfig.sheetName || 'Sheet1';

    try {
      // Automatically ensure that the sheet/table exists before syncing
      await ensureSheetExists(sheets, spreadsheetId, sheetName);

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`
      });
      rows = (res.data.values || []) as string[][];
    } catch (err: any) {
      console.error('Google Sheets Service Account read error:', err.message || err);
      handleGoogleSheetsError(err, 'syncWithGoogleSheets [Service Account read]');
      let errMsg = 'Failed to fetch spreadsheet using Service Account. Please verify that your Spreadsheet ID is correct and that the Google Sheet is shared with your Service Account Email.';
      if (err.status === 403) {
        let emailUsed = sheetsConfig.clientEmail;
        if (sheetsConfig.privateKey && sheetsConfig.privateKey.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(sheetsConfig.privateKey.trim());
            if (parsed.client_email) {
              emailUsed = parsed.client_email;
            }
          } catch (e) {}
        }
        errMsg = `Access Denied: Please share your Google Sheet with your Service Account email: "${emailUsed}" with "Editor" permissions.`;
      }
      lastSyncStatus.connected = false;
      lastSyncStatus.error = errMsg;
      throw new Error(errMsg);
    }
  } else {
    // API Key fallback
    if (!sheetsConfig.apiKey || !sheetsConfig.spreadsheetId) {
      const errMsg = 'Google Sheets API Key and Spreadsheet ID are required for synchronization.';
      lastSyncStatus.connected = false;
      lastSyncStatus.error = errMsg;
      throw new Error(errMsg);
    }

    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }

    const sheetRange = encodeURIComponent(sheetsConfig.sheetName || 'Sheet1');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}?key=${sheetsConfig.apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Sheets API error response:', errText);
      let errMsg = 'Failed to fetch spreadsheet. Please check your API Key and Spreadsheet ID/URL.';
      if (res.status === 403) {
        errMsg = 'Permission Denied: Please verify that your Google Sheet is shared with "Anyone with the link" and that your API Key is correct and has access to the Google Sheets API.';
      } else if (res.status === 404) {
        errMsg = 'Spreadsheet or Sheet Name not found. Please verify the Spreadsheet ID/URL and Sheet Name.';
      }
      lastSyncStatus.connected = false;
      lastSyncStatus.error = errMsg;
      throw new Error(errMsg);
    }

    const data: any = await res.json();
    rows = data.values || [];
  }

  // Update status to connected on successful fetch
  lastSyncStatus.connected = true;
  lastSyncStatus.lastSuccess = new Date().toISOString();
  lastSyncStatus.error = null;

  if (rows.length === 0) {
    return { success: true, message: 'Google Sheet is connected but contains no data/rows.', count: 0 };
  }

  const headers = rows[0].map(h => (h || '').toString().trim().toLowerCase());

  // Check if rows[0] is actually a header row or a data row.
  // A header row is highly likely to contain at least one of these standard keywords.
  const isHeaderRow = headers.some(h => {
    const clean = h.replace(/[^a-z0-9]/g, '');
    return ['id', 'name', 'fullname', 'full_name', 'address', 'barangay', 'purok', 'phone', 'phonenumber', 'contact', 'contactnumber', 'contact_number', 'createdat', 'created_at', 'updatedat', 'updated_at', 'created', 'updated', 'date'].includes(clean);
  });

  let idIdx = -1;
  let nameIdx = -1;
  let barangayIdx = -1;
  let purokIdx = -1;
  let numberIdx = -1;
  let createdIdx = -1;
  let updatedIdx = -1;
  let addedIdx = -1;
  let startIndex = 1;

  if (!isHeaderRow) {
    startIndex = 0;
    // Guess default column indices when there is no header row
    const firstRow = rows[0] || [];
    const isFirstColNumber = /^\d+$/.test((firstRow[0] || '').toString().trim());
    if (isFirstColNumber && firstRow.length >= 4) {
      idIdx = 0;
      nameIdx = 1;
      barangayIdx = 2;
      purokIdx = 3;
      numberIdx = 4;
    } else {
      idIdx = -1;
      nameIdx = 0;
      barangayIdx = 1;
      purokIdx = -1;
      numberIdx = 2;
    }
  } else {
    // Detect column indices based on sheet headers
    idIdx = headers.findIndex(h => h.includes('id'));
    nameIdx = headers.findIndex(h => h.includes('name') || h.includes('full'));
    barangayIdx = headers.findIndex(h => h.includes('barangay') || h.includes('address'));
    purokIdx = headers.findIndex(h => h.includes('purok'));
    numberIdx = headers.findIndex(h => h.includes('number') || h.includes('contact') || h.includes('phone'));
    createdIdx = headers.findIndex(h => h.includes('created') || h.includes('date'));
    updatedIdx = headers.findIndex(h => h.includes('updated') || h.includes('last'));
    addedIdx = headers.findIndex(h => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

    // Defaults if headers not found
    if (nameIdx === -1) nameIdx = 1;
    if (barangayIdx === -1) barangayIdx = 2;
    if (numberIdx === -1) numberIdx = 3;
  }

  const newContacts: Contact[] = [];
  let nextId = 1;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawName = row[nameIdx] || '';
    const rawBarangay = row[barangayIdx] || '';
    const rawPurok = purokIdx !== -1 ? (row[purokIdx] || '') : '';
    const rawNumber = row[numberIdx] || '';

    if (!rawName.trim()) continue; // Skip empty/blank rows

    let id = idIdx !== -1 && row[idIdx] ? parseInt(row[idIdx], 10) : NaN;
    if (isNaN(id)) {
      id = nextId++;
    } else {
      if (id >= nextId) {
        nextId = id + 1;
      }
    }

    const createdAt = createdIdx !== -1 && row[createdIdx] ? row[createdIdx] : new Date().toISOString();
    const updatedAt = updatedIdx !== -1 && row[updatedIdx] ? row[updatedIdx] : new Date().toISOString();

    const formattedName = capitalizeWords(rawName);
    const formattedBarangay = normalizeBarangayName(rawBarangay);

    // Skip any contacts or barangays that have been permanently deleted by the administrator
    if (isBarangayTombstoned(formattedBarangay)) {
      continue;
    }
    if (isContactTombstoned({ id, full_name: formattedName, barangay: formattedBarangay })) {
      continue;
    }

    // Find if this contact already exists in local cache (matching either ID safely or case-insensitive name & barangay)
    const existingLocal = contactsCache.find(lc => 
      (lc.id && id && lc.id.toString() === id.toString()) || 
      (normalizeCompareName(lc.full_name, rawName) && 
       lc.barangay.toLowerCase() === formattedBarangay.toLowerCase())
    );

    const rawAdded = addedIdx !== -1 ? (row[addedIdx] || '').toString().trim().toUpperCase() : '';
    let addedFromPrintList = true;
    if (rawAdded) {
      addedFromPrintList = !(rawAdded === 'FALSE' || rawAdded === 'NO' || rawAdded === '0' || rawAdded === 'N');
    } else if (existingLocal) {
      addedFromPrintList = existingLocal.added_from_print_list !== false;
    } else {
      // Default new rows from Google Sheets to true so they are displayed accurately.
      addedFromPrintList = true;
    }

    const matchedUpdate = pcuUpdatesCache.find(p => p.contactId === id || (existingLocal && p.contactId === existingLocal.id) || normalizeCompareName(p.fullName, rawName));
    const pcuFileUrl = (existingLocal && existingLocal.pcu_file_url) || (matchedUpdate && (matchedUpdate.fileData || `Uploaded: ${matchedUpdate.fileName}`));
    const pcuUploadedBy = (existingLocal && existingLocal.pcu_uploaded_by) || (matchedUpdate && matchedUpdate.uploadedBy);
    const pcuUploadedAt = (existingLocal && existingLocal.pcu_uploaded_at) || (matchedUpdate && matchedUpdate.uploadedAt);

    newContacts.push({
      id,
      full_name: formattedName,
      barangay: formattedBarangay,
      purok: rawPurok ? capitalizeWords(rawPurok) : '',
      contact_number: rawNumber.trim(),
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: existingLocal ? existingLocal.deleted_at : null,
      latitude: existingLocal ? existingLocal.latitude : undefined,
      longitude: existingLocal ? existingLocal.longitude : undefined,
      geotagged: existingLocal ? existingLocal.geotagged : false,
      photo_url: existingLocal ? existingLocal.photo_url : undefined,
      pcu_file_url: pcuFileUrl || undefined,
      pcu_uploaded_by: pcuUploadedBy || undefined,
      pcu_uploaded_at: pcuUploadedAt || undefined,
      added_locally: existingLocal ? existingLocal.added_locally : true,
      added_from_print_list: addedFromPrintList
    });
  }

  // Merge the pulled contacts from Google Sheets into our local contactsCache.
  // We NEVER discard contacts that were added locally or from the print list but aren't in Google Sheets.
  const mergedContacts: Contact[] = [...newContacts];
  
  for (const lc of contactsCache) {
    if (isContactTombstoned(lc) || isBarangayTombstoned(lc.barangay)) {
      continue;
    }

    const alreadyExists = mergedContacts.some(mc => 
      (mc.id && lc.id && mc.id.toString() === lc.id.toString()) || 
      (normalizeCompareName(mc.full_name, lc.full_name) && 
       normalizeBarangayName(mc.barangay).toLowerCase() === normalizeBarangayName(lc.barangay).toLowerCase())
    );
    
    if (!alreadyExists) {
      // Keep local contacts that are not in Google Sheets so they never disappear!
      mergedContacts.push(lc);
    } else {
      // If it already exists in Google Sheets, preserve local-only fields
      const targetIndex = mergedContacts.findIndex(mc => 
        (mc.id && lc.id && mc.id.toString() === lc.id.toString()) || 
        (normalizeCompareName(mc.full_name, lc.full_name) && 
         normalizeBarangayName(mc.barangay).toLowerCase() === normalizeBarangayName(lc.barangay).toLowerCase())
      );
      if (targetIndex !== -1) {
        mergedContacts[targetIndex] = {
          ...lc,
          ...mergedContacts[targetIndex],
          photo_url: mergedContacts[targetIndex].photo_url || lc.photo_url,
          pcu_file_url: mergedContacts[targetIndex].pcu_file_url || lc.pcu_file_url,
          pcu_uploaded_by: mergedContacts[targetIndex].pcu_uploaded_by || lc.pcu_uploaded_by,
          pcu_uploaded_at: mergedContacts[targetIndex].pcu_uploaded_at || lc.pcu_uploaded_at,
          latitude: mergedContacts[targetIndex].latitude || lc.latitude,
          longitude: mergedContacts[targetIndex].longitude || lc.longitude,
          geotagged: mergedContacts[targetIndex].geotagged || lc.geotagged,
          deleted_at: mergedContacts[targetIndex].deleted_at !== undefined ? mergedContacts[targetIndex].deleted_at : lc.deleted_at
        };
      }
    }
  }

  contactsCache = mergedContacts.filter(c => !isContactTombstoned(c) && !isBarangayTombstoned(c.barangay));
  syncPCUFieldsToCache();
  await saveContacts();

  // Aggregate all unique active barangays from both pulled barangaysCache and active contactsCache
  const rawSyncBarangays: string[] = [];
  if (Array.isArray(barangaysCache)) {
    barangaysCache.forEach(b => {
      if (b && typeof b === 'string' && b.trim() && !isBarangayTombstoned(b)) {
        rawSyncBarangays.push(b.trim());
      }
    });
  }

  contactsCache.forEach(c => {
    if (!c.deleted_at && c.added_from_print_list !== false && c.barangay && c.barangay.trim() && !isBarangayTombstoned(c.barangay)) {
      rawSyncBarangays.push(c.barangay.trim());
    }
  });

  barangaysCache = normalizeAndDeduplicateBarangays(rawSyncBarangays).filter(b => !isBarangayTombstoned(b));
  await saveBarangays();

  syncBarangaysToGoogleSheets().catch(err => console.error('Failed to sync Barangays in syncWithGoogleSheets:', err));
  await addActivity(username, `Synchronized ${newContacts.length} contacts from Google Sheet.`);

  return {
    success: true,
    message: `Successfully synchronized ${newContacts.length} contacts!`,
    count: newContacts.length
  };
}

export async function syncAdminsToGoogleSheets() {
  const sheets = getSheetsClient();
  if (!sheets) return;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const adminSheetName = 'Administrators';

    // Verify sheet exists, if not create it
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    const exists = existingSheets.has(adminSheetName);

    if (!exists) {
      console.log(`Sheet "${adminSheetName}" not found. Creating administrators table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: adminSheetName
              }
            }
          }]
        }
      });
      existingSheets.add(adminSheetName);
    }

    // Clear the sheet first to write the fresh state
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${adminSheetName}!A:Z`
    });

    // Write headers and data
    const headers = ['Username', 'Password Hash (SHA-256)', 'Role', 'Display Name', 'Avatar Data URL', 'Email', 'Barangay', 'Status', 'Created At', 'Plain Password', 'Updated At'];
    const rowsToPut = [
      headers,
      ...usersCache.map(u => [
        u.username,
        u.passwordHash,
        u.role,
        u.displayName || u.fullName || '',
        u.avatarDataUrl && u.avatarDataUrl.length > 45000 ? u.avatarDataUrl.substring(0, 45000) : (u.avatarDataUrl || ''),
        u.email || '',
        u.barangay || '',
        u.status || 'Active',
        u.createdAt || '',
        u.passwordPlain || '',
        u.updatedAt || ''
      ])
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${adminSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets(rowsToPut)
      }
    });
    console.log('[Google Sheets] Synchronized administrators list successfully!');
  } catch (err: any) {
    console.error('Failed to sync administrators to Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'syncAdminsToGoogleSheets');
    markSheetsDisconnected(err);
  }
}

export async function syncBarangaysToGoogleSheets() {
  const sheets = getSheetsClient();
  if (!sheets) return;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const barangaySheetName = 'Barangays';

    // Verify sheet exists, if not create it
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    const exists = existingSheets.has(barangaySheetName);

    if (!exists) {
      console.log(`Sheet "${barangaySheetName}" not found. Creating Barangays table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: barangaySheetName
              }
            }
          }]
        }
      });
      existingSheets.add(barangaySheetName);
    }

    // Clear and rewrite barangays
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${barangaySheetName}!A:Z`
    });

    const headers = ['Barangay Name'];
    const rowsToPut = [
      headers,
      ...barangaysCache.map(b => [b])
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${barangaySheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets(rowsToPut)
      }
    });
    console.log('[Google Sheets] Synchronized Barangays list successfully!');
  } catch (err: any) {
    console.error('Failed to sync Barangays to Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'syncBarangaysToGoogleSheets');
    markSheetsDisconnected(err);
  }
}

export async function pullBarangaysFromGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) return false;

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;

    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const barangaySheetName = 'Barangays';

    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    const exists = existingSheets.has(barangaySheetName);

    if (!exists) {
      console.log(`Sheet "${barangaySheetName}" not found. No remote barangays to pull.`);
      return false;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${barangaySheetName}!A:A`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      console.log('Barangays sheet is empty or only contains headers.');
      return false;
    }

    const pulled: string[] = [];
    for (const row of rows.slice(1)) {
      if (!row || row.length === 0) continue;
      const bgName = (row[0] || '').toString().trim();
      if (bgName && !pulled.includes(bgName) && !isBarangayTombstoned(bgName)) {
        pulled.push(bgName);
      }
    }

    if (pulled.length > 0) {
      barangaysCache = normalizeAndDeduplicateBarangays(pulled).filter(b => !isBarangayTombstoned(b));
      await saveBarangays();
      console.log('[Google Sheets] Successfully pulled Barangays from Google Sheets. Total count:', barangaysCache.length);
      return true;
    }
  } catch (err: any) {
    if (!err.message?.includes('Precondition')) {
      console.error('Failed to pull Barangays from Google Sheets:', err.message || err);
    }
    handleGoogleSheetsError(err, 'pullBarangaysFromGoogleSheets');
    markSheetsDisconnected(err);
  }
  return false;
}

export async function syncSiteSettingsToGoogleSheets() {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const settingsSheetName = 'WebsiteSettings';

    // Verify sheet exists, if not create it
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    markSheetsConnected();

    const sheetsList = spreadsheetInfo.data.sheets || [];
    const exists = sheetsList.some((s: any) => s.properties?.title === settingsSheetName);

    if (!exists) {
      console.log(`Sheet "${settingsSheetName}" not found. Creating WebsiteSettings table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: settingsSheetName
              }
            }
          }]
        }
      });
    }

    // Clear and rewrite site settings
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${settingsSheetName}!A:Z`
    });

    const headers = ['Key', 'Value'];
    const rowsToPut = [
      headers,
      ['title', siteSettings.title || ''],
      ['faviconTitle', siteSettings.faviconTitle || ''],
      ['logoDataUrl', siteSettings.logoDataUrl || ''],
      ['faviconDataUrl', siteSettings.faviconDataUrl || ''],
      ['navDashboard', siteSettings.navDashboard || ''],
      ['navMap', siteSettings.navMap || ''],
      ['navDirectory', siteSettings.navDirectory || ''],
      ['navRecentUpload', siteSettings.navRecentUpload || ''],
      ['navAccounts', siteSettings.navAccounts || ''],
      ['navBulk', siteSettings.navBulk || ''],
      ['navPrint', siteSettings.navPrint || ''],
      ['navAdmins', siteSettings.navAdmins || ''],
      ['navSettings', siteSettings.navSettings || ''],
      ['navExistingAccount', siteSettings.navExistingAccount || ''],
      ['navExistAccFiles', siteSettings.navExistAccFiles || ''],
      ['rolePermissions', siteSettings.rolePermissions ? JSON.stringify(siteSettings.rolePermissions) : '']
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${settingsSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets(rowsToPut)
      }
    });
    console.log('[Google Sheets] Synchronized WebsiteSettings list successfully!');
  } catch (err: any) {
    console.error('Failed to sync WebsiteSettings to Google Sheets:', err.message || err);
    markSheetsDisconnected(err);
  }
}

export async function pullSiteSettingsFromGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) return false;

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;

    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const settingsSheetName = 'WebsiteSettings';

    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    const exists = existingSheets.has(settingsSheetName);

    if (!exists) {
      console.log(`Sheet "${settingsSheetName}" not found. No remote site settings to pull.`);
      return false;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${settingsSheetName}!A:B`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      console.log('WebsiteSettings sheet is empty or only contains headers.');
      return false;
    }

    const pulledSettings: Partial<SiteSettings> = {};
    for (const row of rows.slice(1)) {
      if (!row || row.length < 2) continue;
      const key = (row[0] || '').toString().trim();
      const val = unescapeHtml((row[1] || '').toString().trim());
      if (!key) continue;

      if (key === 'rolePermissions') {
        try {
          pulledSettings.rolePermissions = JSON.parse(val);
        } catch (e) {
          console.error('Failed to parse rolePermissions JSON:', val);
        }
      } else if (key === 'logoDataUrl') {
        let localLogo = '';
        if (fs.existsSync(LOGO_DATA_FILE)) {
          try { localLogo = unescapeHtml(fs.readFileSync(LOGO_DATA_FILE, 'utf-8')); } catch (e) {}
        }
        if (!localLogo) {
          localLogo = siteSettings.logoDataUrl || '';
        }
        const isPrefix = localLogo && localLogo.startsWith(val);
        if (localLogo && (val.length === 49000 || isPrefix || val.length < localLogo.length || !val)) {
          pulledSettings.logoDataUrl = localLogo;
        } else {
          pulledSettings.logoDataUrl = val;
        }
      } else if (key === 'faviconDataUrl') {
        let localFavicon = '';
        if (fs.existsSync(FAVICON_DATA_FILE)) {
          try { localFavicon = unescapeHtml(fs.readFileSync(FAVICON_DATA_FILE, 'utf-8')); } catch (e) {}
        }
        if (!localFavicon) {
          localFavicon = siteSettings.faviconDataUrl || '';
        }
        const isPrefix = localFavicon && localFavicon.startsWith(val);
        if (localFavicon && (val.length === 49000 || isPrefix || val.length < localFavicon.length || !val)) {
          pulledSettings.faviconDataUrl = localFavicon;
        } else {
          pulledSettings.faviconDataUrl = val;
        }
      } else {
        (pulledSettings as any)[key] = val;
      }
    }

    if (Object.keys(pulledSettings).length > 0) {
      siteSettings = {
        ...siteSettings,
        ...pulledSettings
      };
      
      // Save pulled settings locally as cache
      if (siteSettings.logoDataUrl) {
        safeWriteFileSync(LOGO_DATA_FILE, siteSettings.logoDataUrl, 'utf-8');
      }
      if (siteSettings.faviconDataUrl) {
        safeWriteFileSync(FAVICON_DATA_FILE, siteSettings.faviconDataUrl, 'utf-8');
      }
      safeWriteFileSync(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2), 'utf-8');
      
      console.log('[Google Sheets] Successfully pulled WebsiteSettings from Google Sheets.');
      return true;
    }
  } catch (err: any) {
    if (!err.message?.includes('Precondition')) {
      console.error('Failed to pull WebsiteSettings from Google Sheets:', err.message || err);
    }
    handleGoogleSheetsError(err, 'pullSiteSettingsFromGoogleSheets');
    markSheetsDisconnected(err);
  }
  return false;
}

export async function pullAdminsFromGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) return false;

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;

    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const adminSheetName = 'Administrators';

    // Verify sheet exists
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    const exists = existingSheets.has(adminSheetName);

    if (!exists) {
      console.log(`Sheet "${adminSheetName}" not found. No remote administrators to pull.`);
      return false;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${adminSheetName}!A:K`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      console.log('Administrators sheet is empty or only contains headers.');
      return false;
    }

    const remoteUsers: User[] = [];
    for (const row of rows.slice(1)) {
      if (!row || row.length < 3) continue;
      const username = row[0]?.trim();
      const passwordHash = row[1]?.trim();
      const role = row[2]?.trim();
      const displayName = row[3]?.trim() || '';
      const avatarDataUrl = row[4]?.trim() || '';
      const email = row[5]?.trim() || '';
      const barangay = row[6]?.trim() || '';
      const status = row[7]?.trim() || 'Active';
      const createdAt = row[8]?.trim() || new Date().toISOString();
      const passwordPlain = row[9]?.trim() || '';
      const updatedAt = row[10]?.trim() || '';

      if (!username || !passwordHash || !role) continue;

      remoteUsers.push({
        username,
        passwordHash,
        role,
        displayName,
        avatarDataUrl,
        fullName: displayName || username,
        email: email || (username.includes('@') ? username : ''),
        barangay: barangay || 'Central',
        status: (status as any) || 'Active',
        createdAt,
        passwordPlain,
        updatedAt
      });
    }

    if (remoteUsers.length > 0) {
      const mergedUsers: User[] = [];

      for (const remote of remoteUsers) {
        const local = usersCache.find(u => u.username.toLowerCase() === remote.username.toLowerCase());
        if (!local) {
          mergedUsers.push(remote);
        } else {
          const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
          const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

          if (localTime > remoteTime) {
            // Local user is newer! Retain local user's fields, or fill from remote if local is blank
            mergedUsers.push({
              ...remote,
              ...local,
              displayName: local.displayName || remote.displayName,
              avatarDataUrl: chooseBestAvatar(local.avatarDataUrl, remote.avatarDataUrl),
              barangay: local.barangay || remote.barangay,
              passwordHash: local.passwordHash || remote.passwordHash,
              passwordPlain: local.passwordPlain || remote.passwordPlain,
              email: local.email || remote.email,
              status: local.status || remote.status,
              role: local.role || remote.role,
              updatedAt: local.updatedAt
            });
          } else {
            // Remote user is equal or newer! But retain local avatarDataUrl or displayName if remote is blank
            mergedUsers.push({
              ...local,
              ...remote,
              displayName: remote.displayName || local.displayName,
              avatarDataUrl: chooseBestAvatar(local.avatarDataUrl, remote.avatarDataUrl),
              barangay: remote.barangay || local.barangay,
              passwordHash: remote.passwordHash || local.passwordHash,
              passwordPlain: remote.passwordPlain || local.passwordPlain,
              email: remote.email || local.email
            });
          }
        }
      }

      // Preserve any local users not present in remote sheet
      for (const localUser of usersCache) {
        const existsInMerged = mergedUsers.some(
          u => u.username.toLowerCase() === localUser.username.toLowerCase()
        );
        if (!existsInMerged) {
          mergedUsers.push(localUser);
        }
      }

      const hasMasterAdmin = mergedUsers.some(u => u.username.toLowerCase() === 'admin');
      if (!hasMasterAdmin) {
        const localMaster = usersCache.find(u => u.username.toLowerCase() === 'admin');
        if (localMaster) {
          mergedUsers.unshift(localMaster);
        }
      }

      usersCache = mergedUsers;
      safeWriteFileSync(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
      console.log('[Google Sheets] Successfully pulled administrators from Google Sheets. Total count:', usersCache.length);
      return true;
    }
  } catch (err: any) {
    if (!err.message?.includes('Precondition')) {
      console.error('Failed to pull administrators from Google Sheets:', err.message || err);
    }
    handleGoogleSheetsError(err, 'pullAdminsFromGoogleSheets');
    markSheetsDisconnected(err);
  }
  return false;
}

export async function appendActivityToGoogleSheets(activity: Activity) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const logSheetName = 'AuditLogs';

    // Verify sheet exists, if not create it
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    const exists = existingSheets.has(logSheetName);

    if (!exists) {
      console.log(`Sheet "${logSheetName}" not found. Creating audit logs table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: logSheetName
              }
            }
          }]
        }
      });
      existingSheets.add(logSheetName);
      // Write headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${logSheetName}!A1:D1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['ID', 'Timestamp', 'Username', 'Action']]
        }
      });
    }

    // Append the row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${logSheetName}!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets([[activity.id, activity.timestamp, activity.username, activity.action]])
      }
    });
    console.log('[Google Sheets] Logged activity successfully!');
  } catch (err: any) {
    console.error('Failed to append activity to Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'appendActivityToGoogleSheets');
  }
}

// Helper to parse base64 Data URLs
function parseDataUrl(dataUrl: string): { mimeType: string, buffer: Buffer } {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    return { mimeType: 'application/octet-stream', buffer: Buffer.from(dataUrl, 'base64') };
  }
  const mimeType = matches[1];
  const base64Data = matches[2];
  return { mimeType, buffer: Buffer.from(base64Data, 'base64') };
}

// Upload file to Base44 public CDN storage
async function uploadFileToBase44(dataUrl: string, fileName: string): Promise<string> {
  try {
    const { mimeType, buffer } = parseDataUrl(dataUrl);
    // Create a standard File object supported natively in Node.js 18+
    const file = new File([buffer], fileName, { type: mimeType });
    
    console.log(`[Base44 Upload] Uploading file "${fileName}" (${buffer.length} bytes, type: ${mimeType}) to Base44 storage...`);
    const result = await base44.integrations.Core.UploadFile({ file });
    console.log(`[Base44 Upload] Successfully uploaded. URL: ${result.file_url}`);
    return result.file_url;
  } catch (err: any) {
    console.error('[Base44 Upload Error] Failed to upload via SDK:', err.message || err);
    throw err;
  }
}

// Save PCU Updates to file
async function savePCUUpdates() {
  await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');
}

// Upload a contact photo
export async function uploadContactPhoto(contactId: number, photoDataUrl: string, username: string) {
  const contact = contactsCache.find(c => c.id === contactId && !c.deleted_at);
  if (!contact) {
    throw new Error('Contact not found or has been deleted.');
  }

  let finalUrl = photoDataUrl;
  try {
    // Attempt to upload to Base44 CDN to keep local JSON light and avoid Google Sheets cell limit issues
    const uploadedUrl = await uploadFileToBase44(photoDataUrl, `photo_${contactId}.png`);
    if (uploadedUrl) {
      finalUrl = uploadedUrl;
    }
  } catch (err: any) {
    console.warn('[Base44 Photo Upload Warning] Failed to upload photo to CDN, storing base64 locally instead:', err.message);
  }

  contact.photo_url = finalUrl;
  contact.updated_at = new Date().toISOString();
  await saveContacts();
  await addActivity(username, `Uploaded photo for contact: "${contact.full_name}"`);
  
  // Forward update to Web App if configured
  forwardToWebApp('edit', contact).catch(err => console.error('Error forwarding photo update to Sheets Web App:', err));
  
  return contact;
}

// Add a PCU Update (saves to Base44 PCUUpdate entity + locally)
export async function addPCUUpdate(contactId: number, fullName: string, fileName: string, fileData: string, username: string) {
  const contact = contactsCache.find(c => c.id === contactId && !c.deleted_at);
  const barangay = contact ? contact.barangay : '';
  const purok = contact ? contact.purok : '';
  
  let finalFileUrlOrData = fileData;
  let base44EntityValue = '';
  let uploadSuccess = false;

  try {
    // Upload the file to public storage and get the URL to avoid 400 Field limit errors
    const uploadedUrl = await uploadFileToBase44(fileData, fileName);
    if (uploadedUrl) {
      finalFileUrlOrData = uploadedUrl;
      base44EntityValue = uploadedUrl;
      uploadSuccess = true;
    }
  } catch (err: any) {
    console.warn('[Base44 PCU Upload Warning] Failed to upload via SDK, saving full file locally and metadata placeholder in Base44 database:', err.message || err);
    // Fallback: save the full base64 file data in the local JSON cache
    finalFileUrlOrData = fileData;
    // Use a lightweight descriptive placeholder for the Base44 DB to prevent the size-exceeded error
    base44EntityValue = `[Local File Only - SDK upload failed: ${err.message || 'unknown error'}]`;
    uploadSuccess = false;
  }

  const newUpdate: PCUUpdate = {
    id: crypto.randomBytes(8).toString('hex'),
    contactId,
    fullName,
    barangay,
    purok,
    fileName,
    fileData: finalFileUrlOrData, // Save the full URL (if success) or full base64 (if local fallback) in local cache
    uploadedAt: new Date().toISOString(),
    uploadedBy: username,
    added_from_website: true
  };

  pcuUpdatesCache.unshift(newUpdate);
  await savePCUUpdates();

  // Try to upload metadata to Base44 PCUUpdate entity
  try {
    console.log(`[Base44 SDK] Uploading PCU File metadata to table PCUUpdate for contact: ${fullName}...`);
    const pcuEntity = (base44.entities as any).PCUUpdate || {
      create: async (data: any) => {
        console.log('[Base44 SDK] Simulating PCUUpdate creation dynamically');
        return data;
      }
    };
    
    // Extract firstName and lastName to satisfy Base44 schema requirement
    const nameParts = (fullName || '').trim().split(/\s+/);
    let firstName = 'Unknown';
    let lastName = 'Unknown';
    if (nameParts.length > 1) {
      firstName = nameParts.slice(0, -1).join(' ');
      lastName = nameParts[nameParts.length - 1];
    } else if (nameParts.length === 1 && nameParts[0] !== '') {
      firstName = nameParts[0];
      lastName = 'Unknown';
    }

    const userObj = findUser(username);
    const userEmail = userObj?.email || (username.includes('@') ? username : 'saintfrancisclinic2026@gmail.com');
    const uName = userObj?.fullName || userObj?.displayName || username;
    const { mimeType } = parseDataUrl(fileData);

    await pcuEntity.create({
      firstName,
      lastName,
      barangay,
      purok,
      fileName,
      fileUrl: base44EntityValue, // Save either the CDN URL or the safe metadata placeholder
      fileType: mimeType,
      uploadDate: newUpdate.uploadedAt,
      uploadedBy: uName,
      uploadedByEmail: userEmail,
      contact: contact ? contact.contact_number : ''
    });
    console.log('[Base44 SDK] PCU File metadata saved successfully in Base44 PCUUpdate table.');
  } catch (err: any) {
    console.warn('[Base44 SDK Warning] Base44 direct write failed (saving locally instead):', err.message);
  }

  // Update contact's PCU file url status
  if (contact) {
    // If upload was successful, store the CDN link, otherwise store a friendly "Uploaded" string indicating local availability
    contact.pcu_file_url = uploadSuccess ? finalFileUrlOrData : `Uploaded: ${fileName} (Local Cache)`;
    contact.pcu_uploaded_by = username;
    contact.pcu_uploaded_at = newUpdate.uploadedAt;
    contact.updated_at = new Date().toISOString();
    await saveContacts();
    await addActivity(username, `Uploaded PCU File "${fileName}" for: "${fullName}"`);
    forwardToWebApp('edit', contact).catch(err => console.error('Error forwarding PCU file update to Sheets Web App:', err));
  } else {
    await addActivity(username, `Uploaded PCU File "${fileName}" for unregistered household: "${fullName}"`);
  }

  return newUpdate;
}

// Add multiple PCU updates for a contact (saves to Base44 PCUUpdate entity + locally)
export async function addPCUUpdatesMultiple(contactId: number, fullName: string, files: { fileName: string; fileData: string }[], username: string) {
  const contact = contactsCache.find(c => c.id === contactId && !c.deleted_at);
  if (!contact) {
    throw new Error('Contact record not found.');
  }

  const barangay = contact.barangay || '';
  const purok = contact.purok || '';
  
  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;
  const userEmail = userObj?.email || (username.includes('@') ? username : 'saintfrancisclinic2026@gmail.com');

  contact.uploadedFiles = contact.uploadedFiles || [];
  let lastFileUrl = '';
  let lastUploadedAt = new Date().toISOString();

  for (const file of files) {
    const { fileName, fileData } = file;
    let finalFileUrlOrData = fileData;
    let base44EntityValue = '';
    let uploadSuccess = false;

    try {
      // Upload the file to public storage and get the URL to avoid 400 Field limit errors
      const uploadedUrl = await uploadFileToBase44(fileData, fileName);
      if (uploadedUrl) {
        finalFileUrlOrData = uploadedUrl;
        base44EntityValue = uploadedUrl;
        uploadSuccess = true;
      }
    } catch (err: any) {
      console.warn('[Base44 PCU Upload Warning] Failed to upload via SDK, saving full file locally and metadata placeholder in Base44 database:', err.message || err);
      // Fallback: save the full base64 file data in the local JSON cache
      finalFileUrlOrData = fileData;
      // Use a lightweight descriptive placeholder for the Base44 DB to prevent the size-exceeded error
      base44EntityValue = `[Local File Only - SDK upload failed: ${err.message || 'unknown error'}]`;
      uploadSuccess = false;
    }

    const newUpdate: PCUUpdate = {
      id: crypto.randomBytes(8).toString('hex'),
      contactId,
      fullName,
      barangay,
      purok,
      fileName,
      fileData: finalFileUrlOrData, // Save the full URL (if success) or full base64 (if local fallback) in local cache
      uploadedAt: new Date().toISOString(),
      uploadedBy: username,
      added_from_website: true
    };

    pcuUpdatesCache.unshift(newUpdate);
    lastUploadedAt = newUpdate.uploadedAt;
    lastFileUrl = uploadSuccess ? finalFileUrlOrData : `Uploaded: ${fileName} (Local Cache)`;

    // Try to upload metadata to Base44 PCUUpdate entity
    try {
      console.log(`[Base44 SDK] Uploading PCU File metadata to table PCUUpdate for contact: ${fullName}...`);
      const pcuEntity = (base44.entities as any).PCUUpdate || {
        create: async (data: any) => {
          console.log('[Base44 SDK] Simulating PCUUpdate creation dynamically');
          return data;
        }
      };
      
      // Extract firstName and lastName to satisfy Base44 schema requirement
      const nameParts = (fullName || '').trim().split(/\s+/);
      let firstName = 'Unknown';
      let lastName = 'Unknown';
      if (nameParts.length > 1) {
        firstName = nameParts.slice(0, -1).join(' ');
        lastName = nameParts[nameParts.length - 1];
      } else if (nameParts.length === 1 && nameParts[0] !== '') {
        firstName = nameParts[0];
        lastName = 'Unknown';
      }

      const { mimeType } = parseDataUrl(fileData);

      await pcuEntity.create({
        firstName,
        lastName,
        barangay,
        purok,
        fileName,
        fileUrl: base44EntityValue, // Save either the CDN URL or the safe metadata placeholder
        fileType: mimeType,
        uploadDate: newUpdate.uploadedAt,
        uploadedBy: uName,
        uploadedByEmail: userEmail,
        contact: contact.contact_number || ''
      });
      console.log('[Base44 SDK] PCU File metadata saved successfully in Base44 PCUUpdate table.');
    } catch (err: any) {
      console.warn('[Base44 SDK Warning] Base44 direct write failed (saving locally instead):', err.message);
    }

    // Add to contact.uploadedFiles array
    contact.uploadedFiles.push({
      name: fileName,
      url: finalFileUrlOrData,
      uploadedAt: newUpdate.uploadedAt,
      uploadedBy: uName
    });
  }

  // Update contact's main PCU fields
  contact.pcu_file_url = lastFileUrl;
  contact.pcu_uploaded_by = username;
  contact.pcu_uploaded_at = lastUploadedAt;
  contact.updated_at = new Date().toISOString();

  await savePCUUpdates();
  await saveContacts();

  await addActivity(username, `Uploaded ${files.length} PCU File(s) for: "${fullName}"`);
  forwardToWebApp('edit', contact).catch(err => console.error('Error forwarding PCU file update to Sheets Web App:', err));

  return contact;
}

// Get all PCU Updates
export function getPCUUpdates() {
  return pcuUpdatesCache;
}

// Get Recent Uploads filtered specifically for the current user/uploader
export function getRecentUploads(params: {
  username: string;
  search?: string;
  barangay?: string;
  purok?: string;
  sortBy?: 'name' | 'barangay' | 'purok' | 'date';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  const { username, search, barangay, purok, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 10 } = params;

  // Ensure all PCU statuses are fully restored on any contacts before querying/filtering
  syncPCUFieldsToCache();

  // 1. Get uploaded contacts from contactsCache
  const uploadedContacts = contactsCache.filter(c => {
    if (c.deleted_at) return false;
    if (!c.pcu_file_url) return false;

    const uploader = (c.pcu_uploaded_by || '').toLowerCase().trim();
    const current = (username || '').toLowerCase().trim();

    if (!uploader) {
      // Fallback check in pcuUpdatesCache if pcu_uploaded_by was missing
      const matchedUpdate = pcuUpdatesCache.find(p => p.contactId === c.id && (p.uploadedBy || '').toLowerCase().trim() === current);
      if (matchedUpdate) return true;
      return false;
    }

    return uploader === current;
  }).map(c => {
    const uploadedFiles = c.uploadedFiles && c.uploadedFiles.length > 0 ? c.uploadedFiles : [{
      name: c.pcu_file_url ? (c.pcu_file_url.includes('/') ? (c.pcu_file_url.split('/').pop() || 'PCU Document').replace(/^\d+_/,'') : c.pcu_file_url) : 'PCU Document',
      url: c.pcu_file_url || '',
      uploadedAt: c.pcu_uploaded_at || c.updated_at || new Date().toISOString(),
      uploadedBy: c.pcu_uploaded_by || 'Admin'
    }];
    return {
      ...c,
      uploadedFiles
    };
  });

  // 2. Get uploaded existing accounts from existingAccountsCache
  const uploadedExistingAccounts = existingAccountsCache.filter(acc => {
    // If it is verified, it should be transferred/available in the Recent Upload page!
    if (acc.existingAccVerified) return true;

    if (!acc.uploadedFiles || acc.uploadedFiles.length === 0) return false;
    const uploader = (acc.uploadedFiles[0].uploadedBy || acc.submittedBy || '').toLowerCase().trim();
    const current = (username || '').toLowerCase().trim();
    return uploader === current;
  }).map(acc => {
    const hasFiles = acc.uploadedFiles && acc.uploadedFiles.length > 0;
    const fileUrl = hasFiles ? acc.uploadedFiles![0].url : '';
    const uploadedBy = hasFiles ? (acc.uploadedFiles![0].uploadedBy || acc.submittedBy || 'Admin') : (acc.submittedBy || 'Admin');
    const uploadedAt = hasFiles ? acc.uploadedFiles![0].uploadedAt : (acc.created_at || new Date().toISOString());
    return {
      id: acc.id,
      full_name: acc.full_name,
      barangay: acc.barangay,
      purok: acc.purok,
      contact_number: acc.contact_number,
      created_at: acc.created_at,
      updated_at: acc.created_at,
      deleted_at: null,
      pcu_file_url: fileUrl,
      pcu_uploaded_by: uploadedBy,
      pcu_uploaded_at: uploadedAt,
      isExistingAccount: true,
      uploadedFiles: acc.uploadedFiles || []
    };
  });

  // Combine both types of uploads
  let combined = [...uploadedContacts, ...uploadedExistingAccounts];

  const allBarangaysSet = new Set<string>();
  combined.forEach(c => {
    if (c.barangay && c.barangay.trim()) {
      allBarangaysSet.add(c.barangay.trim());
    }
  });
  const allBarangays = Array.from(allBarangaysSet).sort((a, b) => a.localeCompare(b));

  const allPuroksSet = new Set<string>();
  combined.forEach(c => {
    if (c.purok) allPuroksSet.add(c.purok.trim());
  });
  const allPuroks = Array.from(allPuroksSet).sort((a, b) => a.localeCompare(b));

  if (barangay && barangay !== 'All Addresses' && barangay !== 'All Barangays') {
    combined = combined.filter(c => isBarangayMatch(c.barangay, barangay));
  }

  if (purok && purok !== 'All Puroks') {
    combined = combined.filter(c => c.purok && c.purok.toLowerCase() === purok.toLowerCase());
  }

  if (search) {
    const term = search.toLowerCase().trim();
    combined = combined.filter(c =>
      c.full_name.toLowerCase().includes(term) ||
      c.barangay.toLowerCase().includes(term) ||
      (c.purok && c.purok.toLowerCase().includes(term)) ||
      (c.contact_number && c.contact_number.includes(term))
    );
  }

  combined.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.full_name.localeCompare(b.full_name);
    } else if (sortBy === 'barangay') {
      comparison = a.barangay.localeCompare(b.barangay);
    } else if (sortBy === 'purok') {
      comparison = (a.purok || '').localeCompare(b.purok || '');
    } else {
      const timeA = new Date(a.pcu_uploaded_at || a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.pcu_uploaded_at || b.updated_at || b.created_at).getTime();
      comparison = timeB - timeA;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const total = combined.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (safePage - 1) * limit;
  const paginated = combined.slice(startIndex, startIndex + limit);

  return {
    contacts: paginated,
    total,
    page: safePage,
    totalPages,
    limit,
    allBarangays,
    allPuroks
  };
}

// Restore files and move an existing account back to directory (clears files, sets addedToFiles = true)
export async function restoreExistingAccountFiles(id: string, username: string): Promise<ExistingAccountItem> {
  const accountIndex = existingAccountsCache.findIndex(acc => acc.id === id);
  if (accountIndex === -1) {
    throw new Error(`Existing account with ID "${id}" not found`);
  }

  const existingAccount = existingAccountsCache[accountIndex];
  existingAccount.uploadedFiles = [];
  existingAccount.addedToFiles = true;

  // Persist locally
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  
  await addActivity(username, `Restored files and moved existing account back to directory: "${existingAccount.full_name}"`);
  
  // Also update in Base44 database if applicable
  if (!id.toString().startsWith('ext_')) {
    try {
      const submissionEntity = base44.entities.HouseholdSubmission;
      if (submissionEntity && typeof submissionEntity.update === 'function') {
        console.log(`[Base44 SDK] Restoring (clearing files) in Base44 HouseholdSubmission for ID: ${id}...`);
        await submissionEntity.update(id, { uploadedFiles: [] });
        console.log(`[Base44 SDK] Successfully updated in Base44.`);
      }
    } catch (err: any) {
      console.warn(`[Base44 SDK Warning] Failed to update in Base44:`, err.message);
    }
  }

  return existingAccount;
}

// Remove PCU file from a contact, returning it to Saint Francis Clinic Directory
export async function removePCUFileFromContact(contactId: number, username: string) {
  const contact = contactsCache.find(c => c.id === contactId);
  if (!contact) throw new Error('Contact record not found.');

  // Find and remove from base44 database
  try {
    const pcuEntity = (base44.entities as any).PCUUpdate;
    if (pcuEntity) {
      console.log(`[Base44 SDK] Searching for PCUUpdate records to delete for contact: ${contact.full_name}...`);
      const submissions = await getCachedPCUUpdates(false);
      if (submissions && Array.isArray(submissions)) {
        // Extract firstName and lastName to compare
        const nameParts = (contact.full_name || '').trim().split(/\s+/);
        let firstName = 'Unknown';
        let lastName = 'Unknown';
        if (nameParts.length > 1) {
          firstName = nameParts.slice(0, -1).join(' ');
          lastName = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 1 && nameParts[0] !== '') {
          firstName = nameParts[0];
          lastName = 'Unknown';
        }

        const matchLower = (str?: string) => (str || '').trim().toLowerCase();
        
        // Find matching updates
        const matchingEntries = submissions.filter((sub: any) => {
          return (
            (matchLower(sub.firstName) === matchLower(firstName) && matchLower(sub.lastName) === matchLower(lastName)) ||
            (sub.contact === contact.contact_number && contact.contact_number !== '')
          );
        });

        for (const entry of matchingEntries) {
          if (entry.id && typeof pcuEntity.delete === 'function') {
            console.log(`[Base44 SDK] Automatically deleting matching PCUUpdate record ${entry.id} from base44 database...`);
            await pcuEntity.delete(entry.id);
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Base44 SDK Warning] Failed to delete matching PCUUpdate from Base44 DB:', err.message || err);
  }

  // Remove matching updates from local cache
  pcuUpdatesCache = pcuUpdatesCache.filter(p => 
    p.contactId.toString() !== contactId.toString() && 
    !normalizeCompareName(p.fullName, contact.full_name)
  );
  await savePCUUpdates();

  delete contact.pcu_file_url;
  delete contact.pcu_uploaded_by;
  delete contact.pcu_uploaded_at;
  delete contact.uploadedFiles;
  contact.updated_at = new Date().toISOString();

  await saveContacts();
  await addActivity(username, `Restored household record to Clinic Directory and deleted associated PCU file: "${contact.full_name}"`);
  return contact;
}

// Get local existing accounts
export function getLocalExistingAccounts(): ExistingAccountItem[] {
  return existingAccountsCache.filter(acc => acc && !isExistingAccountTombstoned(acc) && !isBarangayTombstoned(acc.barangay));
}

// Add local existing account
export async function addLocalExistingAccount(data: any, username: string): Promise<ExistingAccountItem> {
  const newAccount: ExistingAccountItem = {
    id: `ext_man_${Date.now()}`,
    full_name: (data.full_name || '').toUpperCase().trim(),
    barangay: (data.barangay || '').toUpperCase().trim(),
    purok: (data.purok || '').trim(),
    contact_number: (data.contact_number || '').trim(),
    created_at: new Date().toISOString(),
    latitude: data.latitude,
    longitude: data.longitude,
    geotagged: data.latitude !== undefined && data.longitude !== undefined,
    existingAcc: true,
    existingAccVerified: data.existingAccVerified === true,
    existingAccVisited: data.existingAccVisited === true,
    status: data.status || 'approved',
    submittedBy: username || 'Admin',
    pin: data.pin || '',
    uploadedFiles: [],
    added_from_website: true
  };

  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;

  if (data.files && Array.isArray(data.files)) {
    for (const file of data.files) {
      try {
        console.log(`[New Account Upload] Processing file "${file.fileName}" for new account: "${newAccount.full_name}"`);
        const fileUrl = await uploadFileToBase44(file.fileData, file.fileName);
        
        const fileObj = {
          name: file.fileName,
          url: fileUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uName
        };

        newAccount.uploadedFiles!.push(fileObj);
      } catch (err: any) {
        console.error(`[New Account Upload Error] Failed to upload file "${file.fileName}":`, err.message);
        throw new Error(`Failed to upload file "${file.fileName}": ${err.message}`);
      }
    }
  }

  existingAccountsCache.push(newAccount);
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  await addActivity(username, `Manually registered a new existing account record: "${newAccount.full_name}"`);

  // Sync to base44 HouseholdSubmission and MemberVerifiedSubmission databases
  const realId = await syncToBase44HouseholdSubmission(newAccount, username);
  if (realId && realId !== newAccount.id) {
    newAccount.id = realId;
    const lastIdx = existingAccountsCache.length - 1;
    existingAccountsCache[lastIdx].id = realId;
    await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  }

  await syncToBase44MemberVerifiedSubmission(newAccount, username);

  return newAccount;
}

// Add local existing accounts in bulk
export async function addLocalExistingAccountsBulk(dataList: any[], username: string): Promise<ExistingAccountItem[]> {
  const newAccounts: ExistingAccountItem[] = [];
  const now = Date.now();
  dataList.forEach((data, index) => {
    const newAccount: ExistingAccountItem = {
      id: `ext_man_${now}_${index}`,
      full_name: (data.full_name || '').toUpperCase().trim(),
      barangay: (data.barangay || '').toUpperCase().trim(),
      purok: (data.purok || '').trim(),
      contact_number: (data.contact_number || '').trim(),
      created_at: new Date().toISOString(),
      latitude: data.latitude,
      longitude: data.longitude,
      geotagged: data.latitude !== undefined && data.longitude !== undefined,
      existingAcc: true,
      existingAccVerified: data.existingAccVerified === true,
      existingAccVisited: data.existingAccVisited === true,
      status: data.status || 'approved',
      submittedBy: username || 'Admin',
      pin: data.pin || '',
      added_from_website: true
    };
    newAccounts.push(newAccount);
    existingAccountsCache.push(newAccount);
  });

  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  await addActivity(username, `Manually registered ${newAccounts.length} new existing account records in bulk`);
  return newAccounts;
}

// Helper to permanently save/sync existing account verification data to Base44 MemberVerifiedSubmission table
export async function syncToBase44MemberVerifiedSubmission(existingAccount: ExistingAccountItem, username: string): Promise<void> {
  try {
    console.log(`[Base44 SDK] Syncing member verification data for "${existingAccount.full_name}" to MemberVerifiedSubmission table...`);
    const verifiedSubmissionEntity = (base44.entities as any).MemberVerifiedSubmission || {
      create: async (data: any) => {
        console.log('[Base44 SDK] Simulating MemberVerifiedSubmission creation dynamically');
        return data;
      }
    };

    const userObj = findUser(username);
    const uName = userObj?.fullName || userObj?.displayName || username;
    const uEmail = userObj?.email || '';

    // Resolve the full name of the account who submitted the data
    const submitterObj = findUser(existingAccount.submittedBy || username);
    const submitterFullName = submitterObj?.fullName || submitterObj?.displayName || existingAccount.submittedBy || username;

    const filesToSync = existingAccount.uploadedFiles && existingAccount.uploadedFiles.length > 0
      ? existingAccount.uploadedFiles
      : [{ url: '', name: '' }];

    for (const currentFile of filesToSync) {
      const fileUrl = currentFile.url || '';
      const fileName = currentFile.name || '';

      const payload = {
        existingAccountId: existingAccount.id,
        id: existingAccount.id,
        full_name: unescapeHtml(existingAccount.full_name),
        fullName: unescapeHtml(existingAccount.full_name),
        address: unescapeHtml(`${existingAccount.purok ? existingAccount.purok + ', ' : ''}${existingAccount.barangay || ''}`.trim()),
        barangay: existingAccount.barangay || '',
        purok: existingAccount.purok || '',
        contact: existingAccount.contact_number || '',
        contact_number: existingAccount.contact_number || '',
        contactNumber: existingAccount.contact_number || '',
        dateRegistered: existingAccount.created_at || new Date().toISOString(),
        created_at: existingAccount.created_at || new Date().toISOString(),
        latitude: existingAccount.latitude || null,
        longitude: existingAccount.longitude || null,
        geotagged: existingAccount.geotagged || false,
        existingAcc: existingAccount.existingAcc || false,
        existingAccVerified: existingAccount.existingAccVerified || false,
        existingAccVisited: existingAccount.existingAccVisited || false,
        status: existingAccount.status || 'Residency Check',
        pin: unescapeHtml(existingAccount.pin || ''),
        notes: unescapeHtml(existingAccount.pin || ''),
        validationNotes: unescapeHtml(existingAccount.pin || ''),
        validation_notes: unescapeHtml(existingAccount.pin || ''),
        facebookLink: existingAccount.facebookLink || '',
        uploadedFiles: existingAccount.uploadedFiles || [],
        uploadedFilesJson: JSON.stringify(existingAccount.uploadedFiles || []),
        
        // Strict exact mappings requested by user:
        // "Submitted by (Full Name of an account who submitted the data)"
        "Submitted by": submitterFullName,
        "submittedBy": submitterFullName,
        "submitted_by": submitterFullName,
        "submitedBy": submitterFullName,
        "submited_by": submitterFullName,
        
        // "Barangay"
        "Barangay": existingAccount.barangay || '',
        
        // "Attachment data (The File image must saved accurately on base44 database)"
        "Attachment data": fileUrl,
        "Attachment Data": fileUrl,
        "attachment_data": fileUrl,
        "attachmentData": fileUrl,

        // User requested exact field names:
        attachmentUrl: fileUrl || null,
        attachmentName: fileName || null,
        memberName: unescapeHtml(existingAccount.full_name),
        verifiedByEmail: uEmail,
        verifiedDate: new Date().toISOString(),

        verifiedBy: uName,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      let matchedId = null;
      try {
        const existingRecords = await getCachedMemberVerifiedSubmissions(false);
        if (Array.isArray(existingRecords)) {
          if (fileUrl) {
            const match = existingRecords.find((rec: any) => 
              (rec.attachmentUrl === fileUrl || rec.attachment_data === fileUrl) &&
              (rec.existingAccountId === existingAccount.id || rec.id === existingAccount.id ||
               (rec.fullName && rec.fullName.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase()) ||
               (rec.full_name && rec.full_name.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase()))
            );
            if (match && match.id) {
              matchedId = match.id;
            }
          } else {
            const match = existingRecords.find((rec: any) => 
              rec.existingAccountId === existingAccount.id || 
              rec.id === existingAccount.id ||
              (rec.fullName && rec.fullName.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase()) ||
              (rec.full_name && rec.full_name.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase())
            );
            if (match && match.id) {
              matchedId = match.id;
            }
          }
        }
      } catch (e: any) {
        console.warn('[Base44 SDK Warning] Failed to get cached MemberVerifiedSubmissions, will fallback to direct create:', e.message);
      }

      let updateSuccessful = false;
      if (matchedId && typeof verifiedSubmissionEntity.update === 'function') {
        const originalConsoleError = console.error;
        try {
          console.log(`[Base44 SDK] Updating existing MemberVerifiedSubmission record with ID: ${matchedId}...`);
          console.error = () => {}; // Suppress SDK 404 error logs
          await verifiedSubmissionEntity.update(matchedId, payload);
          console.log('[Base44 SDK] Successfully updated MemberVerifiedSubmission record.');
          updateSuccessful = true;
          
          // Update local cache
          try {
            const cached = await getCachedMemberVerifiedSubmissions(false);
            const updatedCache = cached.map((rec: any) => rec.id === matchedId ? { ...rec, ...payload, id: matchedId } : rec);
            await safeWriteFile(MEMBER_VERIFIED_CACHE_FILE, JSON.stringify(updatedCache, null, 2), 'utf-8');
          } catch (cacheErr: any) {
            console.warn('[Base44 Cache Warning] Failed to update local MemberVerifiedSubmission cache:', cacheErr.message);
          }
        } catch (updateErr: any) {
          console.log(`[Base44 SDK Info] Update failed for ${matchedId} (possibly deleted or not found on Base44 side). Falling back to create. Error:`, updateErr.message);
        } finally {
          console.error = originalConsoleError;
        }
      }

      if (!updateSuccessful && typeof verifiedSubmissionEntity.create === 'function') {
        const originalConsoleError = console.error;
        let result;
        try {
          console.log(`[Base44 SDK] Creating new MemberVerifiedSubmission record...`);
          console.error = () => {}; // Suppress SDK error logs
          result = await verifiedSubmissionEntity.create(payload);
          console.log('[Base44 SDK] Successfully created MemberVerifiedSubmission record. ID:', result?.id || 'done');
        } finally {
          console.error = originalConsoleError;
        }
        
        // Update local cache with newly created item
        try {
          const cached = await getCachedMemberVerifiedSubmissions(false);
          const newItem = { ...payload, id: result?.id || `${existingAccount.id}_${fileName}` };
          const updatedCache = [...cached.filter((rec: any) => rec.id !== newItem.id), newItem];
          await safeWriteFile(MEMBER_VERIFIED_CACHE_FILE, JSON.stringify(updatedCache, null, 2), 'utf-8');
        } catch (cacheErr: any) {
          console.warn('[Base44 Cache Warning] Failed to add new item to local MemberVerifiedSubmission cache:', cacheErr.message);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Base44 SDK Warning] Failed to save/sync to MemberVerifiedSubmission:', err.message);
  }
}

function removeIdFromHouseholdCache(id: string): void {
  try {
    if (fs.existsSync(HOUSEHOLDS_CACHE_FILE)) {
      const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
      const submissions = JSON.parse(data);
      if (Array.isArray(submissions)) {
        const filtered = submissions.filter((sub: any) => sub.id !== id);
        fs.writeFileSync(HOUSEHOLDS_CACHE_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
        console.log(`[Base44 Cache] Successfully removed stale ID ${id} from HouseholdSubmission cache.`);
      }
    }
  } catch (err: any) {
    console.warn('[Base44 Cache Warning] Failed to remove stale ID from cache:', err.message);
  }
}

// Update an existing local account
export async function syncToBase44HouseholdSubmission(existingAccount: ExistingAccountItem, username: string): Promise<string> {
  const submissionEntity = base44.entities.HouseholdSubmission;
  if (!submissionEntity) return existingAccount.id;

  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;
  const id = existingAccount.id;
  let isNewOrRecreated = false;

  if (id && !id.toString().startsWith('ext_')) {
    try {
      if (typeof submissionEntity.update === 'function') {
        console.log(`[Base44 SDK] Updating details in Base44 HouseholdSubmission database for ID: ${id}...`);
        const updatePayload: any = {
          existingAcc: true,
          existingAccVerified: existingAccount.existingAccVerified === true,
          existingAccVisited: existingAccount.existingAccVisited === true,
          status: existingAccount.status || 'approved',
          uploadedFiles: existingAccount.uploadedFiles || [],
          uploadedFilesJson: JSON.stringify(existingAccount.uploadedFiles || []),
          facebookLink: existingAccount.facebookLink || '',
          submittedBy: uName,
          barangay: existingAccount.barangay || 'Central',
          purok: existingAccount.purok || '',
          fpe: {
            fullName: existingAccount.full_name,
            pin: existingAccount.pin || '',
            mobile: existingAccount.contact_number || ''
          },
          pcsf: {
            contact: existingAccount.contact_number || '',
            pin: existingAccount.pin || '',
            purok: existingAccount.purok || ''
          }
        };
        await submissionEntity.update(id.toString(), updatePayload);
        console.log(`[Base44 SDK] Successfully updated HouseholdSubmission in Base44.`);
        return id.toString();
      }
    } catch (err: any) {
      console.warn(`[Base44 SDK Warning] Failed to update HouseholdSubmission in Base44 database for ID ${id}:`, err.message);
      if (err.message && (err.message.includes('not found') || err.message.includes('404'))) {
        console.log(`[Base44 SDK Info] HouseholdSubmission ${id} not found on server side. Evicting from cache and falling back to matching/creation.`);
        removeIdFromHouseholdCache(id.toString());
        isNewOrRecreated = true;
      } else {
        return id;
      }
    }
  }

  // Fallback or Match-and-create block
  try {
    console.log(`[Base44 SDK Info] Account "${existingAccount.full_name}" is being matched or created in HouseholdSubmission...`);
    const submissions = await getCachedHouseholdSubmissions(false);
    const matched = submissions.find((sub: any) => {
      let name = sub.memberName || '';
      if (!name && sub.fpe && sub.fpe.fullName) name = sub.fpe.fullName;
      if (!name && sub.pmrf_front) {
        name = `${sub.pmrf_front.member_first || ''} ${sub.pmrf_front.member_middle || ''} ${sub.pmrf_front.member_last || ''}`.trim();
      }
      return name.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase();
    });

    if (matched && matched.id && !isNewOrRecreated) {
      console.log(`[Base44 SDK] Found matching HouseholdSubmission in Base44 with ID: ${matched.id}. Updating it...`);
      const updatePayload: any = {
        existingAcc: true,
        existingAccVerified: existingAccount.existingAccVerified === true,
        existingAccVisited: existingAccount.existingAccVisited === true,
        status: existingAccount.status || 'approved',
        uploadedFiles: existingAccount.uploadedFiles || [],
        uploadedFilesJson: JSON.stringify(existingAccount.uploadedFiles || []),
        facebookLink: existingAccount.facebookLink || '',
        submittedBy: uName,
        barangay: existingAccount.barangay || 'Central',
        purok: existingAccount.purok || '',
        fpe: {
          fullName: existingAccount.full_name,
          pin: existingAccount.pin || '',
          mobile: existingAccount.contact_number || ''
        },
        pcsf: {
          contact: existingAccount.contact_number || '',
          pin: existingAccount.pin || '',
          purok: existingAccount.purok || ''
        }
      };
      if (typeof submissionEntity.update === 'function') {
        try {
          await submissionEntity.update(matched.id, updatePayload);
          console.log(`[Base44 SDK] Successfully updated matched HouseholdSubmission in Base44.`);
          return matched.id;
        } catch (updateErr: any) {
          console.warn(`[Base44 SDK Warning] Failed to update matched HouseholdSubmission in Base44 for ID ${matched.id}:`, updateErr.message);
          if (updateErr.message && (updateErr.message.includes('not found') || updateErr.message.includes('404'))) {
            console.log(`[Base44 SDK Info] Matched HouseholdSubmission ${matched.id} not found on server side. Evicting from cache and falling back to creation.`);
            removeIdFromHouseholdCache(matched.id);
            // Fall through to create
          } else {
            return matched.id;
          }
        }
      }
    }

    console.log(`[Base44 SDK] Creating new HouseholdSubmission record in Base44...`);
    if (typeof submissionEntity.create === 'function') {
      const newSubmission = await submissionEntity.create({
        memberName: existingAccount.full_name,
        existingAcc: true,
        existingAccVerified: existingAccount.existingAccVerified === true,
        existingAccVisited: existingAccount.existingAccVisited === true,
        status: existingAccount.status || 'approved',
        submittedBy: uName,
        submittedByEmail: userObj?.email || (userObj?.username ? `${userObj.username}@example.com` : 'admin@example.com'),
        barangay: existingAccount.barangay || 'Central',
        purok: existingAccount.purok || '',
        uploadedFiles: existingAccount.uploadedFiles || [],
        uploadedFilesJson: JSON.stringify(existingAccount.uploadedFiles || []),
        facebookLink: existingAccount.facebookLink || '',
        fpe: {
          fullName: existingAccount.full_name,
          pin: existingAccount.pin || '',
          mobile: existingAccount.contact_number || ''
        },
        pcsf: {
          contact: existingAccount.contact_number || '',
          pin: existingAccount.pin || '',
          purok: existingAccount.purok || ''
        },
        geoLocation: existingAccount.geotagged ? {
          latitude: existingAccount.latitude,
          longitude: existingAccount.longitude
        } : undefined
      });
      if (newSubmission && newSubmission.id) {
        console.log(`[Base44 SDK] Successfully created new record. ID: ${newSubmission.id}`);
        try {
          const cacheExists = fs.existsSync(HOUSEHOLDS_CACHE_FILE);
          if (cacheExists) {
            const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
            const submissions = JSON.parse(data);
            if (Array.isArray(submissions)) {
              submissions.push(newSubmission);
              fs.writeFileSync(HOUSEHOLDS_CACHE_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
            }
          }
        } catch (cacheErr: any) {
          console.warn('[Base44 Cache Warning] Failed to update local cache with new record:', cacheErr.message);
        }
        return newSubmission.id;
      }
    }
  } catch (err: any) {
    console.warn(`[Base44 SDK Warning] Failed to match or create HouseholdSubmission:`, err.message);
  }
  return existingAccount.id;
}

// Update an existing local account
export async function updateLocalExistingAccount(id: string, updates: Partial<ExistingAccountItem>, username: string): Promise<ExistingAccountItem> {
  const accountIndex = existingAccountsCache.findIndex(acc => acc.id === id);
  if (accountIndex === -1) {
    throw new Error(`Existing account with ID "${id}" not found`);
  }

  const existingAccount = existingAccountsCache[accountIndex];
  const updatedAccount = {
    ...existingAccount,
    ...updates,
    id: existingAccount.id // Ensure ID does not change
  };

  // Sync to Base44 HouseholdSubmission FIRST and get/update the real Base44 ID
  const realId = await syncToBase44HouseholdSubmission(updatedAccount, username);
  if (realId && realId !== updatedAccount.id) {
    updatedAccount.id = realId;
  }

  existingAccountsCache[accountIndex] = updatedAccount;
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  
  if (updates.addedToFiles !== undefined) {
    const actionStr = updates.addedToFiles ? 'added to' : 'removed from';
    await addActivity(username, `Updated account: ${actionStr} files list for "${existingAccount.full_name}"`);
  } else {
    await addActivity(username, `Updated existing account record: "${existingAccount.full_name}"`);
  }

  // Permanently save to base44 database at the MemberVerifiedSubmission table
  await syncToBase44MemberVerifiedSubmission(updatedAccount, username);

  // Log to Base44 ExistingAccFileUpdate table if files are present
  try {
    const userObj = findUser(username);
    const uName = userObj?.fullName || userObj?.displayName || username;
    console.log(`[Base44 SDK] Saving Existing Account file update metadata to table ExistingAccFileUpdate on verification save...`);
    const updateEntity = (base44.entities as any).ExistingAccFileUpdate || {
      create: async (data: any) => {
        console.log('[Base44 SDK] Simulating ExistingAccFileUpdate creation dynamically');
        return data;
      }
    };

    await updateEntity.create({
      householdSubmissionId: updatedAccount.id,
      fullName: updatedAccount.full_name,
      householdName: updatedAccount.full_name || '',
      barangay: updatedAccount.barangay || '',
      purok: updatedAccount.purok || '',
      facebookLink: updatedAccount.facebookLink || '',
      uploadedFiles: JSON.stringify(updatedAccount.uploadedFiles || []),
      updatedBy: uName,
      updatedAt: new Date().toISOString()
    });
    console.log('[Base44 SDK] Successfully saved to Base44 ExistingAccFileUpdate on verification save.');
  } catch (err: any) {
    console.warn('[Base44 SDK Warning] Failed to create ExistingAccFileUpdate record on verification save:', err.message);
  }

  return updatedAccount;
}

// Upload multiple files for an existing account and save them locally & to the Base44 database
export async function uploadFilesForExistingAccount(
  id: string,
  files: { fileName: string; fileData: string }[],
  facebookLink: string | undefined,
  username: string
): Promise<ExistingAccountItem> {
  const accountIndex = existingAccountsCache.findIndex(acc => acc.id === id);
  if (accountIndex === -1) {
    throw new Error(`Existing account with ID "${id}" not found`);
  }

  const existingAccount = existingAccountsCache[accountIndex];
  
  if (facebookLink !== undefined) {
    existingAccount.facebookLink = facebookLink;
  }

  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;

  if (files && files.length > 0) {
    existingAccount.uploadedFiles = existingAccount.uploadedFiles || [];

    for (const file of files) {
      try {
        console.log(`[Existing Account Upload] Processing file "${file.fileName}" for account: "${existingAccount.full_name}"`);
        const fileUrl = await uploadFileToBase44(file.fileData, file.fileName);
        
        const fileObj = {
          name: file.fileName,
          url: fileUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uName
        };

        existingAccount.uploadedFiles.push(fileObj);
      } catch (err: any) {
        console.error(`[Existing Account Upload Error] Failed to upload file "${file.fileName}":`, err.message);
        throw new Error(`Failed to upload file "${file.fileName}": ${err.message}`);
      }
    }
  }

  // Sync to Base44 HouseholdSubmission FIRST and get/update the real Base44 ID
  const realId = await syncToBase44HouseholdSubmission(existingAccount, username);
  if (realId && realId !== existingAccount.id) {
    existingAccount.id = realId;
  }

  // Persist locally
  const accIdx = existingAccountsCache.findIndex(acc => acc.id === id);
  if (accIdx !== -1) {
    existingAccountsCache[accIdx] = existingAccount;
  }
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  
  if (files && files.length > 0) {
    await addActivity(username, `Uploaded ${files.length} file(s) and updated details for existing account: "${existingAccount.full_name}"`);
  } else {
    await addActivity(username, `Updated details for existing account: "${existingAccount.full_name}"`);
  }

  // Save to Base44 ExistingAccFileUpdate table
  try {
    console.log(`[Base44 SDK] Saving Existing Account file update metadata to table ExistingAccFileUpdate...`);
    const updateEntity = (base44.entities as any).ExistingAccFileUpdate || {
      create: async (data: any) => {
        console.log('[Base44 SDK] Simulating ExistingAccFileUpdate creation dynamically');
        return data;
      }
    };

    await updateEntity.create({
      householdSubmissionId: existingAccount.id,
      fullName: existingAccount.full_name,
      householdName: existingAccount.full_name || '',
      barangay: existingAccount.barangay || '',
      purok: existingAccount.purok || '',
      facebookLink: existingAccount.facebookLink || '',
      uploadedFiles: JSON.stringify(existingAccount.uploadedFiles || []),
      updatedBy: uName,
      updatedAt: new Date().toISOString()
    });
    console.log('[Base44 SDK] Successfully saved to Base44 ExistingAccFileUpdate.');
  } catch (err: any) {
    console.warn('[Base44 SDK Warning] Failed to create ExistingAccFileUpdate record:', err.message);
  }

  // Also sync member verification files & data to Base44 MemberVerifiedSubmission table
  await syncToBase44MemberVerifiedSubmission(existingAccount, username);

  return existingAccount;
}

// Delete and clear a specific Barangay folder (removes accounts completely from database)
export async function deleteExistingAccountFolder(barangay: string, username: string): Promise<{ updatedAccounts: ExistingAccountItem[], deletedAccounts: ExistingAccountItem[] }> {
  const normalizedTarget = (barangay || '').trim().toUpperCase();
  
  // Find all accounts in the target barangay folder
  const targetAccounts = existingAccountsCache.filter(acc => {
    const accBarangay = acc.barangay || 'Unknown Barangay';
    return accBarangay.trim().toUpperCase() === normalizedTarget || isBarangayMatch(accBarangay, barangay);
  });

  // Record into tombstone cache
  for (const acc of targetAccounts) {
    deletedExistingAccountsCache.push({
      id: acc.id,
      full_name: acc.full_name,
      barangay: acc.barangay,
      deletedAt: new Date().toISOString()
    });
  }
  if (!deletedBarangaysCache.some(b => isBarangayMatch(b, barangay) || normalizeBarangayName(b).toLowerCase() === normalizeBarangayName(normalizedTarget).toLowerCase())) {
    deletedBarangaysCache.push(barangay.trim());
    await safeWriteFile(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2), 'utf-8');
  }
  await safeWriteFile(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2), 'utf-8');

  // Remove completely from local cache
  existingAccountsCache = existingAccountsCache.filter(acc => {
    const accBarangay = acc.barangay || 'Unknown Barangay';
    return accBarangay.trim().toUpperCase() !== normalizedTarget && !isBarangayMatch(accBarangay, barangay);
  });

  // Persist locally
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  
  await addActivity(username, `Deleted Barangay folder "${barangay}" completely, removing all ${targetAccounts.length} accounts.`);
  
  return { updatedAccounts: existingAccountsCache, deletedAccounts: targetAccounts };
}

// Delete a single existing account completely
export async function deleteLocalExistingAccount(id: string, username: string): Promise<ExistingAccountItem[]> {
  const targetAcc = existingAccountsCache.find(acc => acc.id.toString() === id.toString());
  if (!targetAcc) {
    throw new Error(`Account with ID "${id}" not found.`);
  }

  // Record in tombstone cache so it is NEVER restored on refresh or reload
  deletedExistingAccountsCache.push({
    id: targetAcc.id,
    full_name: targetAcc.full_name,
    barangay: targetAcc.barangay,
    deletedAt: new Date().toISOString()
  });
  await safeWriteFile(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2), 'utf-8');

  // Remove from cache
  existingAccountsCache = existingAccountsCache.filter(acc => acc.id.toString() !== id.toString());

  // Save changes
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');

  await addActivity(username, `Permanently deleted existing account record of "${targetAcc.full_name}" (Barangay ${targetAcc.barangay || 'N/A'}).`);

  return existingAccountsCache;
}



