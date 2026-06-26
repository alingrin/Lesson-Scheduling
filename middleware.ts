import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.cookies.get('teacher_session')) {
    return NextResponse.redirect(new URL('/teacher-login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/teacher'],
};
