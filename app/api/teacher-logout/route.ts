import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/session';

function sessionCookie(request: NextRequest): string {
  return request.cookies.get('teacher_session')?.value ?? '';
}

export async function POST(request: NextRequest) {
  const id = sessionCookie(request);
  if (id) await deleteSession(id);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('teacher_session');
  return res;
}
