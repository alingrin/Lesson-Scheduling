import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${BASE_URL}/api/teacher/auth/callback`,
  );
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.send',
      'email',
      'profile',
    ],
  });
  return NextResponse.redirect(url);
}
