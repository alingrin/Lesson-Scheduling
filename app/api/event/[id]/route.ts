import { NextRequest, NextResponse } from 'next/server';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const res = await getCalendar().events.get({ calendarId: CALENDAR_ID, eventId: id });
    return NextResponse.json({ event: res.data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { studentName, studentEmail, notes, isoStart, isoEnd, tz } = await request.json();
    const calendar = getCalendar();
    const fields: Record<string, unknown> = {};
    if (studentName) fields.summary = `Spanish Lesson - ${studentName}`;
    if (notes !== undefined) fields.description = `Goals: ${notes}`;
    if (studentEmail) fields.attendees = [{ email: studentEmail }];

    if (isoStart && isoEnd) {
      const existing = await calendar.events.get({ calendarId: CALENDAR_ID, eventId: id });
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

    const res = await calendar.events.patch({ calendarId: CALENDAR_ID, eventId: id, requestBody: fields, sendUpdates: 'all' });
    return NextResponse.json({ event: res.data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { email } = await request.json().catch(() => ({}));
    const calendar = getCalendar();
    if (email) {
      const existing = await calendar.events.get({ calendarId: CALENDAR_ID, eventId: id });
      const attendees = existing.data.attendees ?? [];
      if (!attendees.find((a) => a.email?.toLowerCase() === email.toLowerCase())) {
        return NextResponse.json({ error: 'Email not authorized to cancel this event' }, { status: 403 });
      }
    }
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: id, sendUpdates: 'all' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
