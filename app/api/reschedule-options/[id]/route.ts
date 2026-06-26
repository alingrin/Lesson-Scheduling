import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';
import { generateCandidateSlots, filterAvailable } from '@/lib/slots';
import { readSettings } from '@/lib/settings';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '14', 10);
    const calendar = await getCalendar();
    const now = DateTime.utc();
    const timeMin = now.toISO()!;
    const timeMax = now.plus({ days }).toISO()!;

    const [existingRes, eventsRes] = await Promise.all([
      calendar.events.get({ calendarId: CALENDAR_ID, eventId: id }),
      calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      }),
    ]);

    const es = existingRes.data.start?.dateTime ?? existingRes.data.start?.date;
    const ee = existingRes.data.end?.dateTime ?? existingRes.data.end?.date;
    const esUTC = es ? DateTime.fromISO(es).toUTC().toISO() : null;
    const eeUTC = ee ? DateTime.fromISO(ee).toUTC().toISO() : null;

    const busy = (eventsRes.data.items ?? [])
      .filter((e) => e.status !== 'cancelled' && e.start?.dateTime && e.end?.dateTime)
      .map((e) => ({ start: e.start!.dateTime!, end: e.end!.dateTime! }))
      .filter((b) => {
        if (!esUTC || !eeUTC) return true;
        return !(DateTime.fromISO(b.start).toUTC().toISO() === esUTC &&
                 DateTime.fromISO(b.end).toUTC().toISO() === eeUTC);
      });

    const settings = await readSettings();
    const candidates = generateCandidateSlots(now.startOf('day'), days, settings.workDayStart, settings.workDayEnd, settings.workDays, settings.workTimezone);
    const available = filterAvailable(candidates, busy);

    return NextResponse.json({ slots: available });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to compute reschedule options' }, { status: 500 });
  }
}
