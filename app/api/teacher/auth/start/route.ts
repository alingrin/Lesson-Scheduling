import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${origin}/api/teacher/auth/callback`,
  );
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.send',
      'email',
      'profile',
    ],
  });
  return NextResponse.redirect(url);
}
