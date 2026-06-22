import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('teacher_token')?.value;
  const expected = process.env.TEACHER_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.redirect(new URL('/teacher-login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/teacher'],
};
