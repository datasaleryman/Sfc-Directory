import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import {
  getSheetsConfig,
  getAllContactsRaw,
  getAllExistingAccountsRaw,
  getUsers,
  getAllBarangaysRaw,
  getSiteSettings,
  getAllActivitiesRaw,
  deletedContactsCache,
  deletedBarangaysCache,
  deletedExistingAccountsCache,
  deletedUsersCache,
  Contact,
  ExistingAccountItem,
  User,
  DeletedContactRecord,
  DeletedExistingAccountRecord,
  DeletedUserRecord,
  addActivity
} from './db.js';

export interface SheetBackupEntry {
  sheetName: string;
  tableName: string;
  headers: string[];
  rowCount: number;
  rows: any[][];
  records: Record<string, any>[];
}

export interface BackupMetadata {
  title: string;
  timestamp: string;
  source: string;
  spreadsheetId: string;
  exportedBy: string;
  totalSheets: number;
  totalRecords: number;
  isLiveSheetsData: boolean;
  sheetSummaries: Array<{
    sheetName: string;
    tableName: string;
    rowCount: number;
    columnCount: number;
  }>;
}

export interface BackupResult {
  metadata: BackupMetadata;
  sheets: SheetBackupEntry[];
  tables: Record<string, any[]>;
}

/**
 * Creates Google Sheets client using existing service account credentials
 */
function getBackupSheetsClient() {
  const sheetsConfig = getSheetsConfig();
  if (sheetsConfig.authType === 'serviceAccount' && sheetsConfig.privateKey) {
    try {
      let privateKey = sheetsConfig.privateKey.trim();
      let clientEmail = sheetsConfig.clientEmail?.trim() || '';

      if (privateKey.startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey);
          if (parsed.private_key) privateKey = parsed.private_key.trim();
          if (parsed.client_email) clientEmail = parsed.client_email.trim();
        } catch (e) {}
      }

      if (!clientEmail) return null;

      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1).trim();
      }
      if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1).trim();
      }

      let formattedKey = privateKey.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
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
    } catch (err) {
      console.warn('[Backup] Could not initialize Google Sheets client:', err);
      return null;
    }
  }
  return null;
}

/**
 * Helper to normalize string to valid SQL table/column identifier
 */
function toSqlIdentifier(str: string): string {
  let cleaned = str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!cleaned || /^[0-9]/.test(cleaned)) {
    cleaned = 'col_' + (cleaned || 'val');
  }
  // Reserved SQL keywords handling
  const reserved = new Set(['user', 'group', 'order', 'table', 'select', 'from', 'where', 'limit', 'key', 'status', 'index', 'check', 'default']);
  if (reserved.has(cleaned)) {
    cleaned = cleaned + '_val';
  }
  return cleaned;
}

/**
 * Safely escape string literals for SQL insert statements
 */
function escapeSqlValue(val: any): string {
  if (val === null || val === undefined || val === '') {
    return 'NULL';
  }
  if (typeof val === 'number') {
    return isFinite(val) ? val.toString() : 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (typeof val === 'object') {
    try {
      const jsonStr = JSON.stringify(val);
      return `'${jsonStr.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
    } catch {
      return 'NULL';
    }
  }
  const str = String(val);
  return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

/**
 * Infer SQL column datatype from values
 */
function inferSqlType(colName: string, values: any[]): string {
  const col = colName.toLowerCase();
  if (col === 'id') return 'BIGINT';
  if (col.includes('latitude') || col.includes('longitude') || col === 'lat' || col === 'lng') return 'NUMERIC(11, 8)';
  if (col.includes('date') || col.includes('at') || col.includes('time')) return 'VARCHAR(100)';
  if (col.startsWith('is_') || col.startsWith('has_') || col === 'geotagged' || col === 'locked') return 'BOOLEAN';

  let hasText = false;
  let allNumbers = true;
  let allBooleans = true;
  let maxLen = 0;
  let samples = 0;

  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    samples++;
    const str = String(v).trim();
    if (str.length > maxLen) maxLen = str.length;

    if (str.length > 500) hasText = true;

    if (allNumbers && isNaN(Number(str))) {
      allNumbers = false;
    }
    if (allBooleans && str.toLowerCase() !== 'true' && str.toLowerCase() !== 'false' && str !== '1' && str !== '0') {
      allBooleans = false;
    }
  }

  if (samples === 0) return 'VARCHAR(255)';
  if (hasText || maxLen > 1000) return 'TEXT';
  if (allBooleans) return 'BOOLEAN';
  if (allNumbers) return maxLen > 9 ? 'BIGINT' : 'INTEGER';
  if (maxLen > 255) return 'TEXT';
  return 'VARCHAR(255)';
}

let cachedBackupResult: BackupResult | null = null;
let lastBackupFetchTime = 0;
const BACKUP_CACHE_TTL_MS = 60 * 1000; // 60 seconds snapshot cache

/**
 * Gathers complete Google Sheets data (combining live Google Sheets API & synced local cache)
 */
export async function getFullGoogleSheetsBackupData(
  requestedBy: string = 'admin',
  forceRefresh: boolean = false
): Promise<BackupResult> {
  const now = Date.now();
  if (!forceRefresh && cachedBackupResult && now - lastBackupFetchTime < BACKUP_CACHE_TTL_MS) {
    return cachedBackupResult;
  }

  const sheetsConfig = getSheetsConfig();
  const spreadsheetId = sheetsConfig.spreadsheetId || '';
  const sheetsClient = getBackupSheetsClient();

  let liveSheetsData: Record<string, string[][]> = {};
  let isLive = false;

  // Attempt live pull from Google Sheets if configured
  if (sheetsClient && spreadsheetId) {
    try {
      let cleanSpreadsheetId = spreadsheetId;
      const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) cleanSpreadsheetId = match[1];

      const metaRes = await sheetsClient.spreadsheets.get({ spreadsheetId: cleanSpreadsheetId });
      const availableSheets = (metaRes.data.sheets || [])
        .map(s => s.properties?.title)
        .filter((title): title is string => Boolean(title));

      if (availableSheets.length > 0) {
        // Fetch all sheets using batchGet with reasonable column bounds
        const batchRes = await sheetsClient.spreadsheets.values.batchGet({
          spreadsheetId: cleanSpreadsheetId,
          ranges: availableSheets.map(title => `'${title}'!A:AZ`)
        });

        const valueRanges = batchRes.data.valueRanges || [];
        valueRanges.forEach((vr, idx) => {
          const title = availableSheets[idx];
          if (title && vr.values) {
            liveSheetsData[title] = vr.values as string[][];
          }
        });
        isLive = true;
      }
    } catch (err: any) {
      console.warn('[Backup] Live Google Sheets fetch skipped or quota-limited, using synchronized database cache:', err.message || err);
    }
  }

  // Load in-memory & file-backed database caches
  const contacts = getAllContactsRaw();
  const existingAccounts = getAllExistingAccountsRaw();
  const users = getUsers();
  const barangays = getAllBarangaysRaw();
  const siteSettings = getSiteSettings();
  const activities = getAllActivitiesRaw();
  const deletedContacts = deletedContactsCache || [];
  const deletedBarangays = deletedBarangaysCache || [];
  const deletedExistingAccounts = deletedExistingAccountsCache || [];
  const deletedUsers = deletedUsersCache || [];

  const sheets: SheetBackupEntry[] = [];
  const tables: Record<string, any[]> = {};

  // Standard tables mapping
  tables['contacts'] = contacts;
  tables['existing_accounts'] = existingAccounts;
  tables['administrators'] = users;
  tables['barangays'] = barangays.map(b => ({ barangay_name: b }));
  tables['website_settings'] = Object.entries(siteSettings).map(([key, val]) => ({
    setting_key: key,
    setting_value: typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')
  }));
  tables['audit_logs'] = activities;
  tables['deleted_contacts'] = deletedContacts;
  tables['deleted_barangays'] = deletedBarangays.map(b => ({ barangay_name: b }));
  tables['deleted_existing_accounts'] = deletedExistingAccounts;
  tables['deleted_users'] = deletedUsers;

  // Process live sheets if fetched, else fallback to standard generated sheets
  if (isLive && Object.keys(liveSheetsData).length > 0) {
    for (const [sheetName, rawRows] of Object.entries(liveSheetsData)) {
      if (!rawRows || rawRows.length === 0) continue;
      const headers = (rawRows[0] || []).map(h => String(h || '').trim());
      const dataRows = rawRows.slice(1);

      const records: Record<string, any>[] = [];
      dataRows.forEach(row => {
        const rec: Record<string, any> = {};
        headers.forEach((h, i) => {
          rec[h || `col_${i + 1}`] = row[i] !== undefined ? row[i] : '';
        });
        records.push(rec);
      });

      const tableName = toSqlIdentifier(sheetName);
      sheets.push({
        sheetName,
        tableName,
        headers,
        rowCount: records.length,
        rows: dataRows,
        records
      });
    }
  } else {
    // Construct sheets from local database tables
    // 1. Contacts
    const contactHeaders = [
      'ID', 'Full Name', 'Barangay', 'Purok', 'Contact Number',
      'Created At', 'Updated At', 'Latitude', 'Longitude', 'Geotagged',
      'Status', 'Is Submitted', 'Photo URL', 'PCU File URL', 'PCU Uploaded By', 'PCU Uploaded At'
    ];
    const contactRows = contacts.map(c => [
      c.id, c.full_name, c.barangay, c.purok, c.contact_number,
      c.created_at, c.updated_at, c.latitude ?? '', c.longitude ?? '', c.geotagged ? 'TRUE' : 'FALSE',
      c.status || 'ACTIVE', c.isSubmitted ? 'TRUE' : 'FALSE', c.photo_url || '', c.pcu_file_url || '',
      c.pcu_uploaded_by || '', c.pcu_uploaded_at || ''
    ]);
    sheets.push({
      sheetName: 'Sheet1',
      tableName: 'contacts',
      headers: contactHeaders,
      rowCount: contactRows.length,
      rows: contactRows,
      records: contacts.map(c => ({
        id: c.id,
        full_name: c.full_name,
        barangay: c.barangay,
        purok: c.purok,
        contact_number: c.contact_number,
        created_at: c.created_at,
        updated_at: c.updated_at,
        latitude: c.latitude,
        longitude: c.longitude,
        geotagged: c.geotagged,
        status: c.status,
        is_submitted: c.isSubmitted,
        photo_url: c.photo_url,
        pcu_file_url: c.pcu_file_url,
        pcu_uploaded_by: c.pcu_uploaded_by,
        pcu_uploaded_at: c.pcu_uploaded_at
      }))
    });

    // 2. ExistingAccounts
    const existHeaders = ['ID', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Created At', 'Status', 'Submitted By'];
    const existRows = existingAccounts.map(e => [e.id, e.full_name, e.barangay, e.purok, e.contact_number, e.created_at, e.status, e.submittedBy]);
    sheets.push({
      sheetName: 'ExistingAccounts',
      tableName: 'existing_accounts',
      headers: existHeaders,
      rowCount: existRows.length,
      rows: existRows,
      records: existingAccounts
    });

    // 3. Administrators
    const adminHeaders = ['Username', 'Email', 'Full Name', 'Role', 'Status', 'Barangay', 'Created At'];
    const adminRows = users.map(u => [u.username, u.email || '', u.fullName || u.displayName || '', u.role, u.status || 'Active', u.barangay || '', u.createdAt || '']);
    sheets.push({
      sheetName: 'Administrators',
      tableName: 'administrators',
      headers: adminHeaders,
      rowCount: adminRows.length,
      rows: adminRows,
      records: users.map(u => ({
        username: u.username,
        email: u.email,
        full_name: u.fullName || u.displayName,
        role: u.role,
        status: u.status,
        barangay: u.barangay,
        created_at: u.createdAt
      }))
    });

    // 4. Barangays
    const bgHeaders = ['Barangay Name'];
    const bgRows = barangays.map(b => [b]);
    sheets.push({
      sheetName: 'Barangays',
      tableName: 'barangays',
      headers: bgHeaders,
      rowCount: bgRows.length,
      rows: bgRows,
      records: barangays.map(b => ({ barangay_name: b }))
    });

    // 5. WebsiteSettings
    const settingsHeaders = ['Key', 'Value'];
    const settingsRows = Object.entries(siteSettings).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')]);
    sheets.push({
      sheetName: 'WebsiteSettings',
      tableName: 'website_settings',
      headers: settingsHeaders,
      rowCount: settingsRows.length,
      rows: settingsRows,
      records: tables['website_settings']
    });

    // 6. AuditLogs
    const logHeaders = ['ID', 'Timestamp', 'Username', 'Action'];
    const logRows = activities.map(a => [a.id, a.timestamp, a.username, a.action]);
    sheets.push({
      sheetName: 'AuditLogs',
      tableName: 'audit_logs',
      headers: logHeaders,
      rowCount: logRows.length,
      rows: logRows,
      records: activities
    });

    // 7. DeletedContacts
    const delContactHeaders = ['ID', 'Full Name', 'Barangay', 'Deleted At'];
    const delContactRows = deletedContacts.map(d => [d.id || '', d.full_name, d.barangay, d.deletedAt]);
    sheets.push({
      sheetName: 'DeletedContacts',
      tableName: 'deleted_contacts',
      headers: delContactHeaders,
      rowCount: delContactRows.length,
      rows: delContactRows,
      records: deletedContacts
    });

    // 8. DeletedBarangays
    const delBgHeaders = ['Barangay Name'];
    const delBgRows = deletedBarangays.map(b => [b]);
    sheets.push({
      sheetName: 'DeletedBarangays',
      tableName: 'deleted_barangays',
      headers: delBgHeaders,
      rowCount: delBgRows.length,
      rows: delBgRows,
      records: deletedBarangays.map(b => ({ barangay_name: b }))
    });

    // 9. DeletedExistingAccounts
    const delExistHeaders = ['ID', 'Full Name', 'Barangay', 'Deleted At'];
    const delExistRows = deletedExistingAccounts.map(d => [d.id || '', d.full_name, d.barangay, d.deletedAt]);
    sheets.push({
      sheetName: 'DeletedExistingAccounts',
      tableName: 'deleted_existing_accounts',
      headers: delExistHeaders,
      rowCount: delExistRows.length,
      rows: delExistRows,
      records: deletedExistingAccounts
    });

    // 10. DeletedUsers
    const delUserHeaders = ['Username', 'Email', 'Deleted At'];
    const delUserRows = deletedUsers.map(u => [u.username, u.email || '', u.deletedAt]);
    sheets.push({
      sheetName: 'DeletedUsers',
      tableName: 'deleted_users',
      headers: delUserHeaders,
      rowCount: delUserRows.length,
      rows: delUserRows,
      records: deletedUsers
    });
  }

  const totalRecords = sheets.reduce((sum, s) => sum + s.rowCount, 0);

  const metadata: BackupMetadata = {
    title: 'Google Sheets Database Full Backup',
    timestamp: new Date().toISOString(),
    source: 'Google Sheets Database',
    spreadsheetId: sheetsConfig.spreadsheetId || '',
    exportedBy: requestedBy,
    totalSheets: sheets.length,
    totalRecords,
    isLiveSheetsData: isLive,
    sheetSummaries: sheets.map(s => ({
      sheetName: s.sheetName,
      tableName: s.tableName,
      rowCount: s.rowCount,
      columnCount: s.headers.length
    }))
  };

  addActivity(requestedBy, `Exported Google Sheets database full backup (${sheets.length} tables, ${totalRecords} total records)`);

  const result: BackupResult = {
    metadata,
    sheets,
    tables
  };

  cachedBackupResult = result;
  lastBackupFetchTime = Date.now();

  return result;
}

/**
 * Formats the complete backup as formatted JSON string
 */
export function formatBackupAsJson(backupData: BackupResult): string {
  return JSON.stringify(backupData, null, 2);
}

/**
 * Formats the complete backup as standard SQL dump script (PostgreSQL, MySQL, SQLite compatible)
 */
export function formatBackupAsSql(backupData: BackupResult): string {
  const meta = backupData.metadata;
  const lines: string[] = [];

  lines.push('-- =========================================================================');
  lines.push(`-- GOOGLE SHEETS DATABASE BACKUP (SQL DUMP)`);
  lines.push(`-- Title:        ${meta.title}`);
  lines.push(`-- Exported At:  ${meta.timestamp}`);
  lines.push(`-- Exported By:  ${meta.exportedBy}`);
  lines.push(`-- Source:       ${meta.source}`);
  lines.push(`-- Sheet ID:     ${meta.spreadsheetId || 'N/A'}`);
  lines.push(`-- Live Synced:  ${meta.isLiveSheetsData ? 'YES (Live Google Sheets API)' : 'YES (Synchronized Database Cache)'}`);
  lines.push(`-- Total Sheets: ${meta.totalSheets}`);
  lines.push(`-- Total Rows:   ${meta.totalRecords}`);
  lines.push(`-- Compatibility: PostgreSQL / MySQL / SQLite / ANSI SQL`);
  lines.push('-- =========================================================================\n');

  lines.push('SET FOREIGN_KEY_CHECKS = 0; -- MySQL compatibility\n');
  lines.push('BEGIN; -- Transaction block for transactional engines\n');

  for (const sheet of backupData.sheets) {
    const tableName = toSqlIdentifier(sheet.tableName || sheet.sheetName);
    const headers = sheet.headers.map((h, i) => toSqlIdentifier(h || `col_${i + 1}`));
    const rowCount = sheet.rowCount;

    lines.push(`-- -------------------------------------------------------------------------`);
    lines.push(`-- Table: ${tableName} (Google Sheet: "${sheet.sheetName}")`);
    lines.push(`-- Total Records: ${rowCount}`);
    lines.push(`-- -------------------------------------------------------------------------`);
    lines.push(`DROP TABLE IF EXISTS ${tableName};`);

    // Column type inference
    const colDefinitions: string[] = [];
    headers.forEach((col, idx) => {
      const colValues = sheet.rows.map(r => r[idx]);
      const sqlType = inferSqlType(col, colValues);
      if (col === 'id' && idx === 0) {
        colDefinitions.push(`  ${col} ${sqlType} PRIMARY KEY`);
      } else {
        colDefinitions.push(`  ${col} ${sqlType}`);
      }
    });

    lines.push(`CREATE TABLE ${tableName} (`);
    lines.push(colDefinitions.join(',\n'));
    lines.push(`);\n`);

    if (rowCount > 0 && sheet.rows.length > 0) {
      // Chunk insert statements in batches of 200 rows to ensure universal SQL engine compatibility
      const BATCH_SIZE = 200;
      for (let i = 0; i < sheet.rows.length; i += BATCH_SIZE) {
        const batch = sheet.rows.slice(i, i + BATCH_SIZE);
        lines.push(`INSERT INTO ${tableName} (${headers.join(', ')}) VALUES`);

        const valueTuples = batch.map(row => {
          const escapedValues = headers.map((_, colIdx) => {
            const val = row[colIdx];
            return escapeSqlValue(val);
          });
          return `  (${escapedValues.join(', ')})`;
        });

        lines.push(valueTuples.join(',\n') + ';');
      }
    } else {
      lines.push(`-- (Table "${tableName}" has no records)`);
    }

    lines.push('');
  }

  lines.push('COMMIT;\n');
  lines.push('-- =========================================================================');
  lines.push(`-- End of Backup Dump: ${meta.totalSheets} tables exported successfully.`);
  lines.push('-- =========================================================================');

  return lines.join('\n');
}
