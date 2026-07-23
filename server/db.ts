import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { google } from 'googleapis';
import { createClient } from '@base44/sdk';

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
  displayName?: string;
  avatarDataUrl?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SHEETS_CONFIG_FILE = path.join(DATA_DIR, 'sheets_config.json');

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

let lastSyncStatus = {
  connected: false,
  lastAttempt: null as string | null,
  lastSuccess: null as string | null,
  error: null as string | null
};

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
  return {
    connected: lastSyncStatus.connected,
    lastAttempt: lastSyncStatus.lastAttempt,
    lastSuccess: lastSyncStatus.lastSuccess,
    error: lastSyncStatus.error,
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
  'MASTER ADMIN': ['dashboard', 'map', 'directory', 'accounts', 'bulk', 'print', 'settings'],
  'IT': ['dashboard', 'map', 'directory', 'accounts', 'bulk', 'print', 'settings'],
  'ADMIN': ['dashboard', 'map', 'directory', 'accounts', 'bulk', 'print', 'settings'],
  'Administrator': ['dashboard', 'map', 'directory', 'accounts', 'bulk', 'print', 'settings'],
  'LEADER': ['dashboard', 'map', 'directory', 'bulk', 'print'],
  'CO-LEADER': ['dashboard', 'map', 'directory', 'bulk', 'print'],
  'ENCODER': ['dashboard', 'map', 'directory', 'bulk', 'print'],
  'STAFF': ['dashboard', 'map', 'directory', 'bulk', 'print']
};

export interface SiteSettings {
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
  rolePermissions?: Record<string, string[]>;
}

let siteSettings: SiteSettings = {
  title: 'Saint Francis Clinic Directory',
  faviconTitle: 'Saint Francis Clinic',
  logoDataUrl: '',
  faviconDataUrl: '',
  navDashboard: 'Dashboard',
  navDirectory: 'Clinic Directory',
  navBulk: 'Bulk Entry',
  navPrint: 'Print List',
  navAdmins: 'Admin Credentials',
  navSettings: 'Website Settings',
  rolePermissions: DEFAULT_ROLE_PERMISSIONS
};

export function getSiteSettings() {
  return siteSettings;
}

export function saveSiteSettings(settings: Partial<SiteSettings>) {
  siteSettings = { ...siteSettings, ...settings };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2), 'utf-8');
    syncSiteSettingsToGoogleSheets().catch(err => console.error('Failed to sync site settings to Sheets:', err));
  } catch (err) {
    console.error('Failed to write settings file:', err);
  }
  return siteSettings;
}

function unescapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x2F;/g, '/')
    .replace(/&#x3D;/g, '=')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

    // Ensure master admin exists with password "2026"
    const masterAdmin = usersCache.find(u => u.username.toLowerCase() === 'admin');
    const masterHash = hashPassword('2026');
    if (!masterAdmin) {
      usersCache.unshift({
        username: 'admin',
        passwordHash: masterHash,
        role: 'Administrator'
      });
    } else {
      masterAdmin.passwordHash = masterHash;
      masterAdmin.role = 'Administrator';
    }
    safeWriteFileSync(USERS_FILE, JSON.stringify(usersCache, null, 2));

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
      // Migrate legacy cache entries from address -> barangay & purok
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
        if (updated) migrated = true;
        return anyC as Contact;
      });
      // Filter out auto-synced base44 items; only keep contacts added locally/manually or from Print List
      contactsCache = contactsCache.filter(c => c && (c.added_locally || c.id >= 100000));
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
        siteSettings = {
          title: unescapeHtml(parsed.title || 'Saint Francis Clinic Directory'),
          faviconTitle: unescapeHtml(parsed.faviconTitle || 'Saint Francis Clinic'),
          logoDataUrl: unescapeHtml(parsed.logoDataUrl || ''),
          faviconDataUrl: unescapeHtml(parsed.faviconDataUrl || ''),
          navDashboard: unescapeHtml(parsed.navDashboard || 'Dashboard'),
          navDirectory: unescapeHtml(parsed.navDirectory || 'Clinic Directory'),
          navBulk: unescapeHtml(parsed.navBulk || 'Bulk Entry'),
          navPrint: unescapeHtml(parsed.navPrint || 'Print List'),
          navAdmins: unescapeHtml(parsed.navAdmins || 'Admin Credentials'),
          navSettings: unescapeHtml(parsed.navSettings || 'Website Settings'),
          rolePermissions: parsed.rolePermissions || DEFAULT_ROLE_PERMISSIONS
        };
      } catch (e) {
        console.error('Error parsing site settings:', e);
      }
    } else {
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

    console.log('Database initialized successfully. Contacts:', contactsCache.length);

    // Run background sheets sync if enabled
    if (sheetsConfig.syncEnabled) {
      setTimeout(() => {
        syncWithGoogleSheets('System Background Sync').catch(err => {
          console.error('Background Google Sheets Sync failed on startup:', err.message);
        });
        syncAdminsToGoogleSheets().catch(err => {
          console.error('Background Administrators Sync failed on startup:', err.message);
        });
        syncSiteSettingsToGoogleSheets().catch(err => {
          console.error('Background Site Settings Sync failed on startup:', err.message);
        });
      }, 1000);
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Clean and extract precise Barangay names instead of Team titles
function getExactBarangay(sub: any): string {
  // 1. Try pmrf_front (highly reliable)
  if (sub.pmrf_front) {
    if (sub.pmrf_front.perm_Barangay && typeof sub.pmrf_front.perm_Barangay === 'string' && sub.pmrf_front.perm_Barangay.trim()) {
      return sub.pmrf_front.perm_Barangay.trim().toUpperCase();
    }
    if (sub.pmrf_front.mail_Barangay && typeof sub.pmrf_front.mail_Barangay === 'string' && sub.pmrf_front.mail_Barangay.trim()) {
      return sub.pmrf_front.mail_Barangay.trim().toUpperCase();
    }
    if (sub.pmrf_front.barangay && typeof sub.pmrf_front.barangay === 'string' && sub.pmrf_front.barangay.trim()) {
      return sub.pmrf_front.barangay.trim().toUpperCase();
    }
  }

  // 2. Try pcsf
  if (sub.pcsf) {
    if (sub.pcsf.barangay && typeof sub.pcsf.barangay === 'string' && sub.pcsf.barangay.trim()) {
      return sub.pcsf.barangay.trim().toUpperCase();
    }
    if (sub.pcsf.addr_BARANGAYTOWN && typeof sub.pcsf.addr_BARANGAYTOWN === 'string' && sub.pcsf.addr_BARANGAYTOWN.trim()) {
      const addr = sub.pcsf.addr_BARANGAYTOWN.toUpperCase();
      if (addr.includes('NAPOLAN')) return 'NAPOLAN';
      if (addr.includes('BALANGASAN')) return 'BALANGASAN';
      if (addr.includes('BANALE')) return 'BANALE';
      if (addr.includes('SAN FRANCISCO')) return 'SAN FRANCISCO';
    }
  }

  // 3. Try fpe
  if (sub.fpe && sub.fpe.barangay && typeof sub.fpe.barangay === 'string' && sub.fpe.barangay.trim()) {
    return sub.fpe.barangay.trim().toUpperCase();
  }

  // 4. Fallback to sub.barangay with abbreviations dictionary
  const rawBarangay = sub.barangay || '';
  if (typeof rawBarangay === 'string' && rawBarangay.trim()) {
    const bUpper = rawBarangay.toUpperCase().trim();
    if (bUpper.includes('BLNGSN') || bUpper.includes('BALANGASAN')) return 'BALANGASAN';
    if (bUpper.includes('NPLN') || bUpper.includes('NAPOLAN')) return 'NAPOLAN';
    if (bUpper.includes('BNL') || bUpper.includes('BANALE')) return 'BANALE';
    if (bUpper.includes('SFC') || bUpper.includes('SAN FRANCISCO')) return 'SAN FRANCISCO';
    if (bUpper.includes('POB') || bUpper.includes('POBLACION')) return 'POBLACION';
    if (bUpper.includes('CENTRAL')) return 'BARANGAY CENTRAL';
    
    // Clean up "TEAM X" strings
    const cleaned = bUpper.replace(/\bTEAM\s+[A-Z0-9]+\b/gi, '').trim();
    if (cleaned && cleaned !== 'UNKNOWN' && cleaned !== 'N/A') {
      return cleaned;
    }
  }

  return 'BARANGAY CENTRAL';
}

// Sync from Base44 HouseholdSubmission entity
export async function syncBase44Contacts() {
  base44SyncStatus.lastAttempt = new Date().toISOString();
  try {
    console.log('[Base44 Sync] Connecting to Base44 HouseholdSubmissions...');
    const submissions = await base44.entities.HouseholdSubmission.list(undefined, 5000);
    console.log(`[Base44 Sync] Successfully connected. Found ${submissions ? submissions.length : 0} submissions in Base44 database.`);
    
    if (submissions && Array.isArray(submissions)) {
      base44SyncStatus.lastSuccess = new Date().toISOString();
      base44SyncStatus.count = submissions.length;
      base44SyncStatus.error = null;
      return true;
    }
    base44SyncStatus.error = 'No items found in Base44.';
    return false;
  } catch (err: any) {
    console.error('[Base44 Sync] Failed to connect to Base44:', err.message);
    base44SyncStatus.error = err.message || 'Unknown Base44 Sync error.';
    return false;
  }
}

// Save helpers
async function saveContacts() {
  await safeWriteFile(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2), 'utf-8');
}

// Fetch raw Base44 Household Submissions for Print List page
export async function fetchHouseholdSubmissionsFromBase44() {
  try {
    const submissions = await base44.entities.HouseholdSubmission.list(undefined, 5000);
    if (!submissions || !Array.isArray(submissions)) {
      return [];
    }

    // Map each submission to a standard Household object
    const households = submissions.map((sub: any, idx: number) => {
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

      // Check if already in contactsCache (added to directory)
      const isAlreadyAdded = contactsCache.some(c => 
        !c.deleted_at &&
        c.full_name.toLowerCase() === name.toLowerCase() && 
        c.barangay.toLowerCase() === barangay.toLowerCase()
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

    return households;
  } catch (err: any) {
    console.error('[Base44] Failed to fetch household submissions:', err.message);
    throw new Error('Failed to load Base44 Household Submissions: ' + err.message);
  }
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
  const trimmedName = household.full_name ? household.full_name.trim() : '';
  const trimmedBarangay = household.barangay ? household.barangay.trim().toUpperCase() : 'BARANGAY CENTRAL';
  const trimmedPurok = household.purok ? household.purok.trim() : '';
  const trimmedContact = household.contact_number ? household.contact_number.trim() : '';

  if (!trimmedName) {
    throw new Error('Household full name is required.');
  }

  // Check if contact already exists in directory
  const existing = contactsCache.find(
    c => !c.deleted_at && c.full_name.toLowerCase() === trimmedName.toLowerCase() && c.barangay.toLowerCase() === trimmedBarangay.toLowerCase()
  );

  if (existing) {
    return existing;
  }

  const newId = Date.now() + Math.floor(Math.random() * 1000);
  const newContact: Contact = {
    id: newId,
    full_name: trimmedName,
    barangay: trimmedBarangay,
    purok: trimmedPurok,
    contact_number: trimmedContact,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    latitude: household.latitude,
    longitude: household.longitude,
    geotagged: Boolean(household.geotagged || (household.latitude && household.longitude)),
    added_locally: true
  };

  contactsCache.unshift(newContact);
  await saveContacts();
  await addActivity(actorUsername, `Added household "${trimmedName}" to Clinic Directory under Barangay ${trimmedBarangay}`);

  // Async sync to Google Sheets if configured
  forwardToWebApp('add', newContact).catch(err => console.error('Failed to sync contact to Sheets:', err));

  return newContact;
}

// Clear all contacts from the directory
export async function clearAllDirectoryContacts(actorUsername: string) {
  contactsCache = [];
  await saveContacts();
  await addActivity(actorUsername, 'Cleared all contacts from Saint Francis Clinic Directory');
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
  const defaultBarangays = ['BARANGAY CENTRAL', 'BALANGASAN', 'BANALE', 'NAPOLAN', 'SAN FRANCISCO', 'POBLACION'];
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
    u => u.username.toLowerCase() === target || (u.email && u.email.toLowerCase() === target)
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
    avatarDataUrl: u.avatarDataUrl || ''
  }));
}

export function getBarangayList(): string[] {
  const set = new Set<string>();
  const defaultBarangays = ['BARANGAY CENTRAL', 'BALANGASAN', 'BANALE', 'NAPOLAN', 'SAN FRANCISCO', 'POBLACION'];
  
  defaultBarangays.forEach(b => set.add(b));

  if (Array.isArray(contactsCache)) {
    contactsCache.forEach(c => {
      if (!c.deleted_at && c.barangay && c.barangay.trim()) {
        const bUpper = c.barangay.trim().toUpperCase();
        if (bUpper !== 'UNKNOWN' && bUpper !== 'N/A' && bUpper !== 'NONE') {
          set.add(bUpper);
        }
      }
    });
  }

  return Array.from(set).filter(b => b !== 'UNKNOWN' && b !== 'N/A').sort();
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

  const roleSet = new Set<string>(defaultRoles);

  // Collect roles from existing accounts cache
  if (Array.isArray(usersCache)) {
    usersCache.forEach(u => {
      if (u.role && u.role.trim()) {
        roleSet.add(u.role.trim());
      }
    });
  }

  // Collect roles from siteSettings.rolePermissions
  if (siteSettings && siteSettings.rolePermissions) {
    Object.keys(siteSettings.rolePermissions).forEach(r => {
      if (r && r.trim()) {
        roleSet.add(r.trim());
      }
    });
  }

  return Array.from(roleSet).sort((a, b) => a.localeCompare(b));
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

  // Derive username from email or name
  const username = trimmedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '');

  // Check if email or username already exists
  const existing = usersCache.find(
    u => u.username.toLowerCase() === username || (u.email && u.email.toLowerCase() === trimmedEmail)
  );
  if (existing) {
    throw new Error('An account with this email address already exists. Please log in.');
  }

  const newUser: User = {
    username,
    email: trimmedEmail,
    fullName: trimmedName,
    displayName: trimmedName,
    barangay: trimmedBarangay,
    passwordHash: hashPassword(trimmedPass),
    role: trimmedRole,
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  usersCache.push(newUser);
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(username, `Registered new account (${trimmedName} - ${trimmedBarangay}) with role ${trimmedRole}`);
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

  if (targetUsername.toLowerCase() === 'admin' && updates.role && updates.role !== 'Administrator') {
    throw new Error('Master admin role cannot be changed.');
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
  }

  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(actorUsername, `Edited user account details for "@${targetUsername}" (${user.fullName || targetUsername})`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync users to Sheets:', err));

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

export async function updateUserProfile(
  currentUsername: string,
  updates: { username?: string; displayName?: string; avatarDataUrl?: string; password?: string }
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
    user.displayName = updates.displayName.trim();
  }

  if (updates.avatarDataUrl !== undefined) {
    user.avatarDataUrl = updates.avatarDataUrl;
  }

  if (updates.password) {
    const trimmedPass = updates.password.trim();
    if (trimmedPass.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }
    user.passwordHash = hashPassword(trimmedPass);
  }

  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  await addActivity(finalUsername, `Updated admin profile settings (Username: @${finalUsername}, Name: ${user.displayName || 'not set'}).`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync admins to Sheets:', err));

  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName || '',
    avatarDataUrl: user.avatarDataUrl || ''
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

// Get contacts with flexible pagination, sorting, searching, and filtering
export function getContacts(params: {
  search?: string;
  barangay?: string;
  address?: string;
  purok?: string;
  sortBy?: 'name' | 'barangay' | 'purok' | 'date';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  const { search, barangay, address, purok, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 10 } = params;
  const filterBarangay = barangay || address;

  // Only query active (non-soft-deleted) contacts
  let filtered = contactsCache.filter(c => c.deleted_at === null);

  // Get ALL unique barangays for filtering sidebar/dropdown before search filters are applied
  const allBarangaysSet = new Set<string>();
  contactsCache.forEach(c => {
    if (c.deleted_at === null && c.barangay && c.barangay.trim()) {
      const bUpper = c.barangay.trim().toUpperCase();
      if (bUpper !== 'UNKNOWN' && bUpper !== 'N/A' && bUpper !== 'NONE') {
        allBarangaysSet.add(c.barangay.trim());
      }
    }
  });
  const allBarangays = Array.from(allBarangaysSet).filter(b => b.toUpperCase() !== 'UNKNOWN' && b.toUpperCase() !== 'N/A').sort((a, b) => a.localeCompare(b));

  // Get ALL unique non-empty puroks for filtering dropdown before search filters are applied
  const allPuroksSet = new Set<string>();
  contactsCache.forEach(c => {
    if (c.deleted_at === null && c.purok) {
      allPuroksSet.add(c.purok.trim());
    }
  });
  const allPuroks = Array.from(allPuroksSet).sort((a, b) => a.localeCompare(b));

  // Apply Barangay Filter
  if (filterBarangay && filterBarangay !== 'All Addresses' && filterBarangay !== 'All Barangays') {
    filtered = filtered.filter(c => c.barangay.toLowerCase() === filterBarangay.toLowerCase());
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
    const bgContacts = contactsCache.filter(c => c.deleted_at === null && c.barangay.toLowerCase() === bg.toLowerCase());
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
  });

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
  const filterBarangay = barangay || address;
  let filtered = contactsCache.filter(c => c.deleted_at === null);

  if (filterBarangay && filterBarangay !== 'All Addresses' && filterBarangay !== 'All Barangays') {
    filtered = filtered.filter(c => c.barangay.toLowerCase() === filterBarangay.toLowerCase());
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
  const formattedBarangay = capitalizeWords(rawBarangay);
  const formattedPurok = rawPurok ? capitalizeWords(rawPurok) : '';

  // Check for duplicate among active records
  const isDuplicate = contactsCache.some(
    c =>
      c.deleted_at === null &&
      c.full_name.toLowerCase() === formattedName.toLowerCase() &&
      c.contact_number === rawNumber
  );

  if (isDuplicate) {
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
    added_locally: true
  };

  contactsCache.push(newContact);
  await saveContacts();
  await addActivity(username, `Added contact: "${formattedName}" (${rawNumber})`);

  // Forward write operation to Apps Script Web App if configured
  forwardToWebApp('add', newContact).catch(err => console.error('Error forwarding add to Sheets Web App:', err));

  return newContact;
}

// Edit a contact
export async function editContact(
  id: number,
  contact: { full_name: string; barangay: string; purok?: string; address?: string; contact_number: string },
  username: string
) {
  const index = contactsCache.findIndex(c => c.id === id && c.deleted_at === null);
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
  const formattedBarangay = capitalizeWords(rawBarangay);
  const formattedPurok = rawPurok ? capitalizeWords(rawPurok) : '';

  // Check for duplicate in other active records
  const isDuplicate = contactsCache.some(
    c =>
      c.id !== id &&
      c.deleted_at === null &&
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

  return contactsCache[index];
}

// Delete a contact (Soft Delete)
export async function deleteContact(id: number, username: string) {
  const index = contactsCache.findIndex(c => c.id === id && c.deleted_at === null);
  if (index === -1) {
    throw new Error('Contact not found or already deleted.');
  }

  contactsCache[index].deleted_at = new Date().toISOString();
  contactsCache[index].updated_at = new Date().toISOString();

  await saveContacts();
  await addActivity(username, `Deleted contact (soft-delete): "${contactsCache[index].full_name}"`);

  // Forward write operation to Apps Script Web App if configured
  forwardToWebApp('delete', { id }).catch(err => console.error('Error forwarding delete to Sheets Web App:', err));

  return true;
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
      barangay = capitalizeWords(parts[1]);
      purok = capitalizeWords(parts[2]);
      number = parts[3];
    } else if (parts.length === 3) {
      name = capitalizeWords(parts[0]);
      barangay = capitalizeWords(parts[1]);
      purok = '';
      number = parts[2];
    } else {
      results.push({
        raw: line,
        full_name: parts[0] || '',
        barangay: parts[1] || '',
        purok: '',
        contact_number: parts[2] || '',
        status: 'invalid',
        reason: 'Invalid format. Use format: Full Name | Barangay | Purok | Contact Number'
      });
      invalidCount++;
      continue;
    }

    if (!name || !barangay || !number) {
      results.push({
        raw: line,
        full_name: name,
        barangay: barangay,
        purok: purok,
        contact_number: number,
        status: 'invalid',
        reason: 'Full Name, Barangay, and Contact Number are all required and cannot be blank.'
      });
      invalidCount++;
      continue;
    }

    // Check duplicate in database
    const dbDuplicate = contactsCache.some(
      c =>
        c.deleted_at === null &&
        c.full_name.toLowerCase() === name.toLowerCase() &&
        c.contact_number === number
    );

    const batchKey = `${name.toLowerCase()}|||${number}`;
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
    const formattedBarangay = capitalizeWords(item.barangay || item.address || '');
    const formattedPurok = item.purok ? capitalizeWords(item.purok) : '';
    const number = item.contact_number.trim();

    if (!formattedName || !formattedBarangay || !number) {
      skippedCount++;
      continue;
    }

    // Find database duplicate
    const duplicateIndex = contactsCache.findIndex(
      c =>
        c.deleted_at === null &&
        c.full_name.toLowerCase() === formattedName.toLowerCase() &&
        c.contact_number === number
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
          added_locally: true
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
        added_locally: true
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

      const maxIdx = Math.max(idIdx, nameIdx, barangayIdx, purokIdx, numberIdx, createdIdx, updatedIdx, headers.length - 1, 6);

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

        return rowValues;
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: valuesToAppend
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

            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${sheetName}!A${targetRowIdx}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [rowValues]
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
}

// Dashboard statistics
export function getDashboardStats() {
  const activeContacts = contactsCache.filter(c => c.deleted_at === null);
  
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
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = spreadsheetInfo.data.sheets || [];
    const exists = sheetsList.some((s: any) => s.properties?.title === sheetName);

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

      // Write default headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:G1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['ID', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Created At', 'Updated At']]
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
          c.updated_at
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
        { test: (h: string) => h.includes('updated') || h.includes('last'), display: 'Updated At' }
      ];

      // Check if the first row is actually a header row or a data row.
      const isHeaderRow = normalizedExisting.some(h => {
        const clean = h.replace(/[^a-z0-9]/g, '');
        return ['id', 'name', 'fullname', 'full_name', 'address', 'barangay', 'purok', 'phone', 'phonenumber', 'contact', 'contactnumber', 'contact_number', 'createdat', 'created_at', 'updatedat', 'updated_at', 'created', 'updated', 'date'].includes(clean);
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
            values: updatedRows
          }
        });
      } else if (allRows.length > 0 && !isHeaderRow) {
        // First row is actually data, not a header!
        // Prepend the proper header row at A1 and shift all rows down.
        const correctHeaders = ['ID', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Created At', 'Updated At'];
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
            values: updatedRows
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
              values: [updatedHeaderRow]
            }
          });
        }
      }
    }
  } catch (err: any) {
    console.error('ensureSheetExists failed (likely permission, empty spreadsheet, or duplicate sheet):', err.message || err);
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

        const maxIdx = Math.max(idIdx, nameIdx, barangayIdx, purokIdx, numberIdx, createdIdx, updatedIdx, headers.length - 1, 6);
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

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:Z`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [rowValues]
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

              const rowValues = [...rows[targetRowIdx - 1]];
              if (nameIdx !== -1) rowValues[nameIdx] = data.full_name;
              if (barangayIdx !== -1) rowValues[barangayIdx] = data.barangay;
              if (purokIdx !== -1) rowValues[purokIdx] = data.purok;
              if (numberIdx !== -1) rowValues[numberIdx] = data.contact_number;
              if (updatedIdx !== -1) rowValues[updatedIdx] = data.updated_at;

              await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A${targetRowIdx}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                  values: [rowValues]
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
  await safeWriteFile(SHEETS_CONFIG_FILE, JSON.stringify(sheetsConfig, null, 2), 'utf-8');
  await addActivity(username, `Updated Google Sheets Database settings (Auth: ${sheetsConfig.authType}, Sync: ${sheetsConfig.syncEnabled ? 'ENABLED' : 'DISABLED'})`);

  if (sheetsConfig.syncEnabled) {
    await syncWithGoogleSheets(username);
    syncAdminsToGoogleSheets().catch(err => console.error('Error background syncing admins:', err));
    syncSiteSettingsToGoogleSheets().catch(err => console.error('Error background syncing site settings:', err));
  }
}

export async function syncWithGoogleSheets(username: string): Promise<{ success: boolean; message: string; count?: number }> {
  lastSyncStatus.lastAttempt = new Date().toISOString();
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

    newContacts.push({
      id,
      full_name: capitalizeWords(rawName),
      barangay: capitalizeWords(rawBarangay),
      purok: rawPurok ? capitalizeWords(rawPurok) : '',
      contact_number: rawNumber.trim(),
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: null
    });
  }

  contactsCache = newContacts;
  await saveContacts();
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

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const adminSheetName = 'Administrators';

    // Verify sheet exists, if not create it
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = spreadsheetInfo.data.sheets || [];
    const exists = sheetsList.some((s: any) => s.properties?.title === adminSheetName);

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
    }

    // Clear the sheet first to write the fresh state
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${adminSheetName}!A:Z`
    });

    // Write headers and data
    const headers = ['Username', 'Password Hash (SHA-256)', 'Role', 'Display Name', 'Avatar Data URL'];
    const rowsToPut = [
      headers,
      ...usersCache.map(u => [
        u.username,
        u.passwordHash,
        u.role,
        u.displayName || '',
        u.avatarDataUrl || ''
      ])
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${adminSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToPut
      }
    });
    console.log('[Google Sheets] Synchronized administrators list successfully!');
  } catch (err: any) {
    console.error('Failed to sync administrators to Google Sheets:', err.message || err);
  }
}

export async function syncSiteSettingsToGoogleSheets() {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const settingsSheetName = 'SiteSettings';

    // Verify sheet exists, if not create it
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = spreadsheetInfo.data.sheets || [];
    const exists = sheetsList.some((s: any) => s.properties?.title === settingsSheetName);

    if (!exists) {
      console.log(`Sheet "${settingsSheetName}" not found. Creating website settings table automatically...`);
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

    const headers = ['Setting Key', 'Setting Value'];
    const rowsToPut = [
      headers,
      ['Title', siteSettings.title || ''],
      ['Favicon Title', siteSettings.faviconTitle || ''],
      ['Logo Data URL', siteSettings.logoDataUrl || ''],
      ['Favicon Data URL', siteSettings.faviconDataUrl || ''],
      ['Nav Dashboard', siteSettings.navDashboard || ''],
      ['Nav Directory', siteSettings.navDirectory || ''],
      ['Nav Bulk', siteSettings.navBulk || ''],
      ['Nav Print', siteSettings.navPrint || ''],
      ['Nav Admins', siteSettings.navAdmins || ''],
      ['Nav Settings', siteSettings.navSettings || '']
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${settingsSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToPut
      }
    });
    console.log('[Google Sheets] Synchronized website settings successfully!');
  } catch (err: any) {
    console.error('Failed to sync site settings to Google Sheets:', err.message || err);
  }
}

export async function appendActivityToGoogleSheets(activity: Activity) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const logSheetName = 'AuditLogs';

    // Verify sheet exists, if not create it
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = spreadsheetInfo.data.sheets || [];
    const exists = sheetsList.some((s: any) => s.properties?.title === logSheetName);

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
        values: [[activity.id, activity.timestamp, activity.username, activity.action]]
      }
    });
    console.log('[Google Sheets] Logged activity successfully!');
  } catch (err: any) {
    console.error('Failed to append activity to Google Sheets:', err.message || err);
  }
}
