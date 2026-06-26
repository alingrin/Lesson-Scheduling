import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createSession } from '@/lib/session';
import { saveTeacherCredentials } from '@/lib/teacher-credentials';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${BASE_URL}/teacher-login?error=cancelled`);
  }

  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${BASE_URL}/api/teacher/auth/callback`,
    );
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const userinfo = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
    const email = userinfo.data.email ?? '';

    // Persist credentials so calendar + Gmail work without env vars
    if (tokens.refresh_token) {
      await saveTeacherCredentials({ refreshToken: tokens.refresh_token, email });
    }

    const sessionId = await createSession({
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      email,
    });

    const res = NextResponse.redirect(`${BASE_URL}/teacher`);
    res.cookies.set('teacher_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${BASE_URL}/teacher-login?error=auth_failed`);
  }
}
