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
}

export interface Activity {
  id: string;
  timestamp: string;
  username: string;
  action: string;
}

export interface User {
  username: string;
  role: 'Administrator';
}

export interface SheetsStatus {
  connected: boolean;
  lastAttempt: string | null;
  lastSuccess: string | null;
  error: string | null;
  config: {
    authType: 'apiKey' | 'serviceAccount';
    spreadsheetId: string | null;
    sheetName: string;
    clientEmail?: string;
  };
}

export interface Base44SyncStatus {
  lastAttempt: string | null;
  lastSuccess: string | null;
  count: number;
  error: string | null;
}

export interface DashboardStats {
  totalContacts: number;
  totalAddresses: number;
  contactsToday: number;
  recentActivities: Activity[];
  sheetsStatus?: SheetsStatus;
  base44SyncStatus?: Base44SyncStatus;
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

export interface BulkPreviewResponse {
  results: ParseResult[];
  summary: {
    total: number;
    valid: number;
    duplicate: number;
    invalid: number;
  };
  detectedSeparator: string;
}
