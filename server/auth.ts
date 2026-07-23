import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { findUser, hashPassword } from './db.js';

// Random secret secured via environment variable, or falling back to a stable key for serverless persistence
const SESSION_SECRET = process.env.SESSION_SECRET || 'saint_francis_clinic_secret_key_2026';

export interface SessionPayload {
  username: string;
  role: string;
  expiresAt: number;
}

/**
 * Creates a cryptographically signed session token.
 * Structured similarly to JWT but entirely dependency-free.
 */
export function createToken(username: string, role: string = 'Staff'): string {
  const payload: SessionPayload = {
    username,
    role,
    expiresAt: Date.now() + 1000 * 60 * 60 * 2 // 2 Hours Session Timeout
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('hex');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies a cryptographically signed token.
 */
export function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadBase64)
      .digest('hex');

    if (signature !== expectedSignature) return null;

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString('utf-8')
    );

    if (Date.now() > payload.expiresAt) {
      return null; // Session Expired
    }

    return payload;
  } catch {
    return null;
  }
}

// Extend Express Request interface to store user info
export interface AuthenticatedRequest extends Request {
  user?: SessionPayload;
}

/**
 * Middleware to protect routes, enforcing authentication.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }

  req.user = payload;
  next();
}

/**
 * Basic XSS Sanitizer for incoming bodies
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  const sanitize = (val: any): any => {
    if (typeof val === 'string') {
      // Do not sanitize base64 data URLs of images to avoid corrupting image quality/binary data
      if (val.startsWith('data:image/') && val.includes(';base64,')) {
        return val;
      }
      // Basic escaping of < > & " ' and / to prevent script injection (XSS protection)
      return val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (Array.isArray(val)) {
      return val.map(sanitize);
    } else if (typeof val === 'object' && val !== null) {
      const sanitized: any = {};
      for (const key of Object.keys(val)) {
        sanitized[key] = sanitize(val[key]);
      }
      return sanitized;
    }
    return val;
  };

  req.body = sanitize(req.body);
  next();
}
