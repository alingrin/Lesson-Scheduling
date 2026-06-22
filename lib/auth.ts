import crypto from 'crypto';
import { DateTime } from 'luxon';
import { cookies } from 'next/headers';

const MANAGE_SECRET = process.env.MANAGE_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'dev-secret-change-me';
export const MANAGE_TOKEN_HOURS = parseInt(process.env.MANAGE_TOKEN_HOURS || '72', 10);
export const TEACHER_TOKEN = process.env.TEACHER_TOKEN || '';

export interface ManagePayload {
  eventId: string;
  email: string;
  exp: string;
}

export function signManageToken(payload: ManagePayload): string {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', MANAGE_SECRET).update(body).digest('hex');
  return Buffer.from(body).toString('base64') + '.' + sig;
}

export function verifyManageToken(token: string): ManagePayload | null {
  try {
    const [b64, sig] = token.split('.');
    const body = Buffer.from(b64, 'base64').toString('utf8');
    const expected = crypto.createHmac('sha256', MANAGE_SECRET).update(body).digest('hex');
    if (expected !== sig) return null;
    const obj = JSON.parse(body) as ManagePayload;
    if (obj.exp && DateTime.fromISO(obj.exp) < DateTime.utc()) return null;
    return obj;
  } catch {
    return null;
  }
}

export async function isTeacherAuthed(): Promise<boolean> {
  if (!TEACHER_TOKEN) return false;
  const store = await cookies();
  return store.get('teacher_token')?.value === TEACHER_TOKEN;
}

export function checkTeacherToken(request: Request): boolean {
  if (!TEACHER_TOKEN) return false;
  const header = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const cookie = parseCookieHeader(request.headers.get('cookie') ?? '', 'teacher_token');
  return header === TEACHER_TOKEN || cookie === TEACHER_TOKEN;
}

function parseCookieHeader(cookieHeader: string, name: string): string {
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    if (pair.slice(0, idx).trim() === name) return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return '';
}
