import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_TOKEN } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { token } = await request.json().catch(() => ({}));
  if (!TEACHER_TOKEN) return NextResponse.json({ error: 'Teacher auth not configured' }, { status: 403 });
  if (token !== TEACHER_TOKEN) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('teacher_token', token, { httpOnly: true, maxAge: 60 * 60 * 24, path: '/' });
  return res;
}
