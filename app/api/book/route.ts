import { NextRequest, NextResponse } from 'next/server';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';
import { signManageToken, MANAGE_TOKEN_HOURS } from '@/lib/auth';
import { DateTime } from 'luxon';
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || `no-reply@${process.env.DOMAIN || 'localhost'}`;
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const mailer = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({ host: SMTP_HOST, port: parseInt(SMTP_PORT, 10), secure: SMTP_PORT === '465', auth: { user: SMTP_USER, pass: SMTP_PASS } })
  : null;

export async function POST(request: NextRequest) {
  try {
    const { studentName, studentEmail, notes, isoStart, isoEnd, tz } = await request.json();
    if (!studentName || !studentEmail || !isoStart || !isoEnd) {
      return NextResponse.json({ error: 'Missing booking fields' }, { status: 400 });
    }

    const calendar = getCalendar();

    const fb = await calendar.freebusy.query({
      requestBody: { timeMin: isoStart, timeMax: isoEnd, items: [{ id: CALENDAR_ID }] },
    });
    const busy = (fb.data.calendars ?? {})[CALENDAR_ID]?.busy ?? [];
    if (busy.length > 0) {
      return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 });
    }

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `Spanish Lesson - ${studentName}`,
        description: `Goals: ${notes || ''}`,
        start: { dateTime: isoStart, timeZone: tz || 'UTC' },
        end: { dateTime: isoEnd, timeZone: tz || 'UTC' },
        attendees: [{ email: studentEmail }],
        conferenceData: {
          createRequest: { requestId: `miki-lesson-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
        },
      },
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    const manageToken = signManageToken({
      eventId: response.data.id!,
      email: studentEmail,
      exp: DateTime.utc().plus({ hours: MANAGE_TOKEN_HOURS }).toISO()!,
    });

    if (mailer) {
      const url = `${BASE_URL}/manage?token=${encodeURIComponent(manageToken)}`;
      await mailer.sendMail({
        from: FROM_EMAIL, to: studentEmail,
        subject: 'Manage your Miki lesson',
        html: `<p>Manage your lesson: <a href="${url}">${url}</a></p>`,
      }).catch((e) => console.error('Failed to send manage email', e));
    }

    return NextResponse.json({ event: response.data, manageToken });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
