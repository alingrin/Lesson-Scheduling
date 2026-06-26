import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/auth';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';

export async function GET(request: NextRequest) {
  if (!await getTeacherSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const res = await getCalendar().events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date().toISOString(),
      q: 'Spanish Lesson',
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });
    const bookings = (res.data.items ?? []).map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      studentEmail: e.attendees?.[0]?.email ?? null,
    }));
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
