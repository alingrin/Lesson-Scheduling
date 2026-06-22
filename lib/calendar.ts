import { google } from 'googleapis';

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.MIKI_REFRESH_TOKEN });
  return auth;
}

export function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuth() });
}

export const CALENDAR_ID = process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary';
