import crypto from 'crypto';
import { DateTime } from 'luxon';

const SECRET = process.env.MANAGE_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'dev-secret-change-me';
export const MANAGE_TOKEN_HOURS = parseInt(process.env.MANAGE_TOKEN_HOURS || '72', 10);

export interface ManagePayload {
  eventId: string;
  email: string;
  exp: string;
}

export function signManageToken(payload: ManagePayload): string {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return Buffer.from(body).toString('base64') + '.' + sig;
}

export function verifyManageToken(token: string): ManagePayload | null {
  try {
    const [b64, sig] = token.split('.');
    const body = Buffer.from(b64, 'base64').toString('utf8');
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    if (expected !== sig) return null;
    const obj = JSON.parse(body) as ManagePayload;
    if (obj.exp && DateTime.fromISO(obj.exp) < DateTime.utc()) return null;
    return obj;
  } catch {
    return null;
  }
}
