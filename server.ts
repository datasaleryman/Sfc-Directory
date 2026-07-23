import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  initDb,
  getContacts,
  getAllFilteredContacts,
  addContact,
  editContact,
  deleteContact,
  previewBulkImport,
  saveBulkImport,
  getDashboardStats,
  findUser,
  hashPassword,
  addActivity,
  getUsers,
  getBarangayList,
  registerUser,
  updateUserRole,
  updateUserStatus,
  createAdminUser,
  deleteAdminUser,
  getSheetsConfig,
  saveSheetsConfig,
  syncWithGoogleSheets,
  getSiteSettings,
  saveSiteSettings,
  updateUserProfile,
  syncBase44Contacts,
  getBase44Roles,
  editUserAccount,
  fetchHouseholdSubmissionsFromBase44,
  addHouseholdToDirectory,
  clearAllDirectoryContacts
} from './server/db.js';
import {
  createToken,
  requireAuth,
  sanitizeInput,
  AuthenticatedRequest
} from './server/auth.js';

export async function getApp() {
  // Initialize the fast file-backed database cache
  await initDb();

  // Run initial sync from Base44 on startup to ensure the latest database cache is populated
  console.log('[Startup] Initiating startup synchronization with Base44 Database...');
  syncBase44Contacts()
    .then((success) => {
      console.log('[Startup] Initial Base44 sync finished. Success:', success);
    })
    .catch((err) => {
      console.error('[Startup] Initial Base44 sync error:', err);
    });

  // Set up periodic background synchronization with Base44 Database every 10 minutes (only in non-serverless environments)
  if (process.env.NETLIFY !== 'true' && !process.env.LAMBDA_TASK_ROOT) {
    const BASE44_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    setInterval(() => {
      console.log('[Background Sync] Initiating background periodic sync with Base44 Database...');
      syncBase44Contacts()
        .then((success) => {
          console.log('[Background Sync] Background Base44 sync finished. Success:', success);
        })
        .catch((err) => {
          console.error('[Background Sync] Background Base44 sync error:', err);
        });
    }, BASE44_SYNC_INTERVAL_MS);
  }

  const app = express();
  const PORT = 3000;

  // Security: Max payload limit (set to 50mb to preserve original high-quality uploads) & XSS sanitization
  app.use(express.json({ limit: '50mb' }));
  app.use(sanitizeInput);

  // --- API Endpoints ---

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Public endpoint for barangay list
  app.get('/api/public/barangays', (req: Request, res: Response) => {
    try {
      const barangays = getBarangayList();
      res.json({ barangays });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Registration
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { fullName, email, password, barangay } = req.body;
      const registered = await registerUser({ fullName, email, password, barangay });
      const token = createToken(registered.username, registered.role as any);
      res.json({
        token,
        user: registered
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    const user = findUser(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    if (user.status === 'Suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact the administrator.' });
    }

    const inputHash = hashPassword(password);
    if (user.passwordHash !== inputHash) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Success - create cryptographic session token
    const token = createToken(user.username, user.role as any);

    addActivity(user.username, 'Logged in to dashboard successfully.');

    res.json({
      token,
      user: {
        username: user.username,
        email: user.email || user.username,
        fullName: user.fullName || user.displayName || user.username,
        barangay: user.barangay || 'Central',
        role: user.role,
        status: user.status || 'Active'
      }
    });
  });

  // Current session details
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.user) {
      const userObj = findUser(req.user.username);
      res.json({
        user: {
          username: req.user.username,
          role: req.user.role,
          displayName: userObj?.displayName || '',
          avatarDataUrl: userObj?.avatarDataUrl || '',
          barangay: userObj?.barangay || ''
        }
      });
    } else {
      res.status(401).json({ error: 'Unauthorized.' });
    }
  });

  // Update profile details
  app.post('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const { username, displayName, avatarDataUrl, password } = req.body;
      const currentUsername = req.user.username;

      const updatedUser = await updateUserProfile(currentUsername, {
        username,
        displayName,
        avatarDataUrl,
        password
      });

      // If username has changed, generate a new token for the user so they stay logged in
      let token: string | undefined;
      if (updatedUser.username !== currentUsername.toLowerCase()) {
        token = createToken(updatedUser.username, updatedUser.role);
      }

      res.json({
        user: updatedUser,
        token
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Get contacts list (paginated, sorted, searched, filtered)
  app.get('/api/contacts', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const userObj = req.user ? findUser(req.user.username) : null;
      const userRole = (userObj?.role || req.user?.role || '').toUpperCase();
      const userBarangay = userObj?.barangay || '';
      const isLeaderRole = userRole === 'LEADER' || userRole === 'CO-LEADER' || userRole.includes('LEADER');

      let address = req.query.address as string | undefined;
      if (isLeaderRole && userBarangay) {
        address = userBarangay;
      }

      const search = req.query.search as string | undefined;
      const purok = req.query.purok as string | undefined;
      const sortBy = req.query.sortBy as 'name' | 'barangay' | 'purok' | 'date' | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const results = getContacts({
        search,
        barangay: address, // Map legacy address filter parameter to barangay
        purok,
        sortBy,
        sortOrder,
        page,
        limit
      });

      // If Leader/Co-Leader, filter returned folders list so they only see their assigned barangay folder
      if (isLeaderRole && userBarangay && Array.isArray(results.barangayFolders)) {
        results.barangayFolders = results.barangayFolders.filter(
          (f) => f.barangay.trim().toLowerCase() === userBarangay.trim().toLowerCase()
        );
      }

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all filtered contacts without pagination (for CSV/Excel/PDF print and exports)
  app.get('/api/contacts/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const userObj = req.user ? findUser(req.user.username) : null;
      const userRole = (userObj?.role || req.user?.role || '').toUpperCase();
      const userBarangay = userObj?.barangay || '';
      const isLeaderRole = userRole === 'LEADER' || userRole === 'CO-LEADER' || userRole.includes('LEADER');

      let address = req.query.address as string | undefined;
      if (isLeaderRole && userBarangay) {
        address = userBarangay;
      }

      const search = req.query.search as string | undefined;
      const purok = req.query.purok as string | undefined;
      const sortBy = req.query.sortBy as 'name' | 'barangay' | 'purok' | 'date' | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

      const contacts = getAllFilteredContacts({
        search,
        barangay: address, // Map legacy address filter parameter to barangay
        purok,
        sortBy,
        sortOrder
      });

      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get raw Base44 Household Submissions list for Print List page
  app.get('/api/base44/households', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const households = await fetchHouseholdSubmissionsFromBase44();
      res.json(households);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add household from Print List to Saint Francis Clinic Directory
  app.post('/api/contacts/add-from-household', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const contact = await addHouseholdToDirectory(req.body, username);
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Clear all contacts in directory
  app.delete('/api/contacts/clear-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      await clearAllDirectoryContacts(username);
      res.json({ message: 'All contacts removed from Saint Francis Clinic Directory.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manual trigger to sync from Base44 Database
  app.post('/api/contacts/sync-base44', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const success = await syncBase44Contacts();
      if (success) {
        await addActivity(username, 'Manually synchronized clinic directory with Base44 Database.');
        res.json({ success: true, message: 'Contacts successfully synced from Base44 Database.' });
      } else {
        res.status(500).json({ error: 'Failed to sync with Base44 Database. Please check server logs.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add single contact
  app.post('/api/contacts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { full_name, barangay, purok, address, contact_number } = req.body;
      const username = req.user?.username || 'Admin';

      const contact = await addContact({
        full_name,
        barangay: barangay || address || '',
        purok,
        contact_number
      }, username);
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Edit contact
  app.put('/api/contacts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { full_name, barangay, purok, address, contact_number } = req.body;
      const username = req.user?.username || 'Admin';

      const contact = await editContact(id, {
        full_name,
        barangay: barangay || address || '',
        purok,
        contact_number
      }, username);
      res.json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Soft delete contact
  app.delete('/api/contacts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const username = req.user?.username || 'Admin';

      await deleteContact(id, username);
      res.json({ success: true, message: 'Contact successfully soft-deleted.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk entries - step 1: Parse and generate validation preview
  app.post('/api/contacts/bulk-preview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text content cannot be empty.' });
      }

      const preview = previewBulkImport(text);
      res.json(preview);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk entries - step 2: Save bulk entries under a specified action
  app.post('/api/contacts/bulk-save', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { items, option } = req.body;
      const username = req.user?.username || 'Admin';

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided to import.' });
      }

      if (!option || !['save_all', 'skip_invalid', 'replace_duplicate'].includes(option)) {
        return res.status(400).json({ error: 'Invalid or missing import option selection.' });
      }

      const summary = await saveBulkImport(items, option, username);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Dashboard Metrics & logs
  app.get('/api/dashboard/stats', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = getDashboardStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Google Sheets Integration Endpoints ---

  // Get Google Sheets configuration
  app.get('/api/sheets/config', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = getSheetsConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save Google Sheets configuration
  app.post('/api/sheets/config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      await saveSheetsConfig(req.body, username);
      res.json({ success: true, message: 'Google Sheets Database configuration saved successfully!' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Force sync from Google Sheets
  app.post('/api/sheets/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const result = await syncWithGoogleSheets(username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Site Settings Endpoints ---

  // Get current site settings (public)
  app.get('/api/site/settings', (req: Request, res: Response) => {
    try {
      const settings = getSiteSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save site settings (admin only)
  app.post('/api/site/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const updated = saveSiteSettings(req.body);
      addActivity(username, 'Updated website customization and settings.');
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Account Management Endpoints ---

  // Get Base44 database roles list
  app.get('/api/base44/roles', async (req: Request, res: Response) => {
    try {
      const roles = await getBase44Roles();
      res.json({ roles });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all registered user accounts
  app.get('/api/users', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = getUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Edit user account
  app.put('/api/users/:username', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username } = req.params;
      const actor = req.user?.username || 'admin';
      const updated = await editUserAccount(username, req.body, actor);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update user role
  app.put('/api/users/:username/role', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username } = req.params;
      const { role } = req.body;
      const actor = req.user?.username || 'admin';
      const updated = await updateUserRole(username, role, actor);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update user status
  app.put('/api/users/:username/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username } = req.params;
      const { status } = req.body;
      const actor = req.user?.username || 'admin';
      const updated = await updateUserStatus(username, status, actor);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete user account
  app.delete('/api/users/:username', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUsername = req.params.username;
      const actor = req.user?.username || 'admin';
      await deleteAdminUser(targetUsername, actor);
      res.json({ success: true, message: `Account "${targetUsername}" successfully deleted.` });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Administrator Management Endpoints ---

  // List all registered admins
  app.get('/api/admins', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const admins = getUsers();
      res.json(admins);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new admin
  app.post('/api/admins', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, password } = req.body;
      const creator = req.user?.username || 'admin';
      const newAdmin = await createAdminUser(username, password, creator);
      res.json(newAdmin);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete an admin
  app.delete('/api/admins/:username', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUsername = req.params.username;
      const creator = req.user?.username || 'admin';
      await deleteAdminUser(targetUsername, creator);
      res.json({ success: true, message: `Administrator "${targetUsername}" deleted.` });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Serve Frontend Application ---

  if (process.env.NODE_ENV !== 'production') {
    // Integrate Vite development server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production serving of built client-side static bundle
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

if (process.env.NETLIFY !== 'true' && !process.env.LAMBDA_TASK_ROOT) {
  getApp().then((app) => {
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[FULLSTACK SERVER] Running on http://0.0.0.0:${PORT} under environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }).catch((err) => {
    console.error('[FULLSTACK SERVER] Failed to start:', err);
  });
}
