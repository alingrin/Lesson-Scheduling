import { getSession, TeacherSession } from './session';

export type { TeacherSession };

export { type ManagePayload, signManageToken, verifyManageToken, MANAGE_TOKEN_HOURS } from './manage-token';

function sessionCookie(request: Request): string {
  const header = request.headers.get('cookie') ?? '';
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    if (pair.slice(0, idx).trim() === 'teacher_session')
      return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return '';
}

export async function getTeacherSession(request: Request): Promise<TeacherSession | null> {
  const id = sessionCookie(request);
  if (!id) return null;
  return getSession(id);
}
