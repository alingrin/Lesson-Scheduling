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
const TEACHER_EMAIL = process.env.TEACHER_EMAIL;
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const mailer = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({ host: SMTP_HOST, port: parseInt(SMTP_PORT, 10), secure: SMTP_PORT === '465', auth: { user: SMTP_USER, pass: SMTP_PASS } })
  : null;

export async function POST(request: NextRequest) {
  try {
    const { studentName, studentEmail, notes, isoStart, isoEnd, tz, lessonType } = await request.json();
    if (!studentName || !studentEmail || !isoStart || !isoEnd) {
      return NextResponse.json({ error: 'Missing booking fields' }, { status: 400 });
    }

    const calendar = getCalendar();
    const isGoogleMeet = lessonType === 'meet';

    const fb = await calendar.freebusy.query({
      requestBody: { timeMin: isoStart, timeMax: isoEnd, items: [{ id: CALENDAR_ID }] },
    });
    const busy = (fb.data.calendars ?? {})[CALENDAR_ID]?.busy ?? [];
    if (busy.length > 0) {
      return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 });
    }

    const typeLabel = isGoogleMeet ? 'Google Meet' : 'In-person';
    const description = [`Type: ${typeLabel}`, notes ? `Goals: ${notes}` : ''].filter(Boolean).join('\n');

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      conferenceDataVersion: isGoogleMeet ? 1 : 0,
      requestBody: {
        summary: `Spanish Lesson - ${studentName}`,
        description,
        start: { dateTime: isoStart, timeZone: tz || 'UTC' },
        end: { dateTime: isoEnd, timeZone: tz || 'UTC' },
        attendees: [{ email: studentEmail }],
        ...(isGoogleMeet && {
          conferenceData: {
            createRequest: {
              requestId: `miki-lesson-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      },
      sendUpdates: 'all',
    });

    const meetLink = isGoogleMeet
      ? (response.data.conferenceData?.entryPoints ?? []).find((ep) => ep.entryPointType === 'video')?.uri ?? null
      : null;

    const manageToken = signManageToken({
      eventId: response.data.id!,
      email: studentEmail,
      exp: DateTime.utc().plus({ hours: MANAGE_TOKEN_HOURS }).toISO()!,
    });

    if (mailer) {
      const manageUrl = `${BASE_URL}/manage?token=${encodeURIComponent(manageToken)}`;
      const meetLine = meetLink ? `<p><strong>Google Meet link:</strong> <a href="${meetLink}">${meetLink}</a></p>` : '';
      const timeStr = new Date(isoStart).toLocaleString(undefined, { timeZone: tz || 'UTC', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      await Promise.allSettled([
        mailer.sendMail({
          from: FROM_EMAIL,
          to: studentEmail,
          subject: `Your Spanish lesson is confirmed — ${timeStr}`,
          html: `
            <p>Hi ${studentName},</p>
            <p>Your <strong>${typeLabel}</strong> Spanish lesson is confirmed for <strong>${timeStr}</strong>.</p>
            ${meetLine}
            <p>To reschedule or cancel: <a href="${manageUrl}">${manageUrl}</a></p>
          `,
        }),
        TEACHER_EMAIL && mailer.sendMail({
          from: FROM_EMAIL,
          to: TEACHER_EMAIL,
          subject: `New booking: ${studentName} — ${timeStr}`,
          html: `
            <p>New <strong>${typeLabel}</strong> lesson booked.</p>
            <p><strong>Student:</strong> ${studentName} (${studentEmail})</p>
            <p><strong>Time:</strong> ${timeStr}</p>
            ${notes ? `<p><strong>Goals:</strong> ${notes}</p>` : ''}
            ${meetLine}
          `,
        }),
      ].filter(Boolean));
    }

    return NextResponse.json({ event: response.data, manageToken, meetLink });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
