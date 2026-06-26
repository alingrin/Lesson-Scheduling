import { google } from 'googleapis';
import { loadTeacherCredentials } from './teacher-credentials';

export const CALENDAR_ID = process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary';

export async function getCalendar() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  const stored = await loadTeacherCredentials();
  const refreshToken = stored?.refreshToken ?? process.env.MIKI_REFRESH_TOKEN;
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth });
}
