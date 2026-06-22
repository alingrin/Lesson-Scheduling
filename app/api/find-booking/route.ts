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
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const calendar = getCalendar();
    const now = DateTime.utc();

    const res = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: now.toISO()!,
      timeMax: now.plus({ months: 6 }).toISO()!,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = (res.data.items ?? []).filter((e) =>
      e.status !== 'cancelled' &&
      e.start?.dateTime &&
      (e.attendees ?? []).some((a) => a.email?.toLowerCase() === email.toLowerCase())
    );

    if (events.length === 0) {
      return NextResponse.json({ error: 'No upcoming bookings found for that email.' }, { status: 404 });
    }

    const bookings = events.map((e) => {
      const token = signManageToken({
        eventId: e.id!,
        email,
        exp: DateTime.utc().plus({ hours: MANAGE_TOKEN_HOURS }).toISO()!,
      });
      return {
        summary: e.summary ?? 'Spanish Lesson',
        start: e.start!.dateTime!,
        manageUrl: `${BASE_URL}/manage?token=${encodeURIComponent(token)}`,
      };
    });

    if (mailer) {
      const rows = bookings.map((b) => {
        const time = new Date(b.start).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `<li>${time} — <a href="${b.manageUrl}">Manage</a></li>`;
      }).join('');
      await mailer.sendMail({
        from: FROM_EMAIL,
        to: email,
        subject: 'Your upcoming Spanish lessons',
        html: `<p>Here are your upcoming lessons and manage links:</p><ul>${rows}</ul>`,
      }).catch((e) => console.error('Failed to send find-booking email', e));
    }

    return NextResponse.json({ bookings });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to look up bookings' }, { status: 500 });
  }
}
