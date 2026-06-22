import { NextRequest, NextResponse } from 'next/server';
import { verifyManageToken } from '@/lib/auth';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const info = verifyManageToken(token);
  if (!info) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  try {
    const res = await getCalendar().events.get({ calendarId: CALENDAR_ID, eventId: info.eventId });
    return NextResponse.json({ event: res.data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const info = verifyManageToken(token);
  if (!info) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  try {
    const { studentName, studentEmail, notes, isoStart, isoEnd, tz } = await request.json();
    const calendar = getCalendar();
    const fields: Record<string, unknown> = {};
    if (studentName) fields.summary = `Spanish Lesson - ${studentName}`;
    if (notes !== undefined) fields.description = `Goals: ${notes}`;
    if (studentEmail) fields.attendees = [{ email: studentEmail }];

    if (isoStart && isoEnd) {
      const existing = await calendar.events.get({ calendarId: CALENDAR_ID, eventId: info.eventId });
      const fb = await calendar.freebusy.query({
        requestBody: { timeMin: isoStart, timeMax: isoEnd, items: [{ id: CALENDAR_ID }] },
      });
      const busy = (fb.data.calendars ?? {})[CALENDAR_ID]?.busy ?? [];
      const onlySelf = busy.length === 1 && busy[0].start === existing.data.start?.dateTime && busy[0].end === existing.data.end?.dateTime;
      if (busy.length > 0 && !onlySelf) {
        return NextResponse.json({ error: 'Desired slot is not available' }, { status: 409 });
      }
      fields.start = { dateTime: isoStart, timeZone: tz || 'UTC' };
      fields.end = { dateTime: isoEnd, timeZone: tz || 'UTC' };
    }

    const res = await calendar.events.patch({ calendarId: CALENDAR_ID, eventId: info.eventId, requestBody: fields, sendUpdates: 'all' });
    return NextResponse.json({ event: res.data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const info = verifyManageToken(token);
  if (!info) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  try {
    await getCalendar().events.delete({ calendarId: CALENDAR_ID, eventId: info.eventId, sendUpdates: 'all' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
