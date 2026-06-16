const express = require('express');
const { DateTime, Interval } = require('luxon');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { getCalendar } = require('../calendar');

const crypto = require('crypto');
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || `no-reply@${process.env.DOMAIN || 'localhost'}`;

let mailer = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({ host: SMTP_HOST, port: parseInt(SMTP_PORT, 10), secure: SMTP_PORT === '465', auth: { user: SMTP_USER, pass: SMTP_PASS } });
}

async function sendManageEmail(manageToken, toEmail) {
  if (!mailer) return false;
  const url = `${process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`}/manage.html?token=${encodeURIComponent(manageToken)}`;
  const info = await mailer.sendMail({ from: FROM_EMAIL, to: toEmail, subject: `Manage your Miki lesson`, html: `<p>Manage your lesson using this link (expires in ${MANAGE_TOKEN_HOURS} hours):</p><p><a href="${url}">${url}</a></p>` });
  return !!info;
}

const MANAGE_TOKEN_HOURS = parseInt(process.env.MANAGE_TOKEN_HOURS || '72', 10);
const MANAGE_SECRET = process.env.MANAGE_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'dev-secret-change-me';

const DATA_DIR = path.join(__dirname, '..', 'data');
const EXPOSED_FILE = path.join(DATA_DIR, 'exposed-slots.json');

async function readExposedSlots() {
  try {
    const txt = await fs.readFile(EXPOSED_FILE, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (e) {
    return [];
  }
}

async function writeExposedSlots(slots) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EXPOSED_FILE, JSON.stringify(slots || [], null, 2), 'utf8');
}

function signManageToken(payload) {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', MANAGE_SECRET).update(body).digest('hex');
  const token = Buffer.from(body).toString('base64') + '.' + sig;
  return token;
}

function verifyManageToken(token) {
  try {
    const [b64, sig] = token.split('.');
    const body = Buffer.from(b64, 'base64').toString('utf8');
    const expected = crypto.createHmac('sha256', MANAGE_SECRET).update(body).digest('hex');
    if (expected !== sig) return null;
    const obj = JSON.parse(body);
    // check expiry
    if (obj.exp && DateTime.fromISO(obj.exp) < DateTime.utc()) return null;
    return obj;
  } catch (err) {
    return null;
  }
}

const LESSON_MINUTES = parseInt(process.env.LESSON_DURATION_MINUTES || '60', 10);
const BUFFER_MINUTES = parseInt(process.env.BUFFER_TIME_MINUTES || '10', 10);
const LEAD_HOURS = parseInt(process.env.LEAD_TIME_HOURS || '24', 10);
const SLOT_STEP_MINUTES = parseInt(process.env.SLOT_STEP_MINUTES || '15', 10);
function generateCandidateSlots(startDate, days, startHour = 9, endHour = 17) {
  const slots = [];
  for (let d = 0; d < days; d++) {
    const day = startDate.plus({ days: d });
    const latestEnd = day.set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_STEP_MINUTES) {
        const start = day.set({ hour, minute, second: 0, millisecond: 0 });
        const end = start.plus({ minutes: LESSON_MINUTES });
        if (end > latestEnd || end <= start) continue;
        slots.push({ start: start.toUTC().toISO(), end: end.toUTC().toISO() });
      }
    }
  }
  return slots;
}

function overlaps(aStartISO, aEndISO, bStartISO, bEndISO) {
  const a = Interval.fromISO(`${aStartISO}/${aEndISO}`);
  const b = Interval.fromISO(`${bStartISO}/${bEndISO}`);
  return a.overlaps(b);
}

router.get('/availability', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const tz = req.query.tz || 'UTC';
    const teacherView = req.query.teacher === 'true';
    const calendar = getCalendar();

    const now = DateTime.utc();
    const requestedStart = req.query.start ? DateTime.fromISO(req.query.start, { zone: tz }) : null;
    const startDate = requestedStart && requestedStart.isValid ? requestedStart.startOf('day') : DateTime.now().setZone(tz).startOf('day');
    const timeMin = startDate.toUTC().toISO();
    const timeMax = startDate.plus({ days }).toUTC().toISO();

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary' }],
      },
    });

    const busy = (freeBusyResponse.data.calendars || {})[process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary']?.busy || [];

    const leadLimit = now.plus({ hours: LEAD_HOURS });

    const candidates = generateCandidateSlots(startDate, days, parseInt(process.env.WORK_DAY_START || '9', 10), parseInt(process.env.WORK_DAY_END || '17', 10));

    const available = candidates.filter((s) => {
      const slotStart = DateTime.fromISO(s.start);
      const slotEnd = DateTime.fromISO(s.end);
      if (slotStart < leadLimit) return false; // enforce 24h lead time
      // check busy overlaps and buffer
      for (const b of busy) {
        const busyStart = DateTime.fromISO(b.start);
        const busyEnd = DateTime.fromISO(b.end);
        const paddedBusyEnd = busyEnd.plus({ minutes: BUFFER_MINUTES });
        if (overlaps(s.start, s.end, busyStart.toISO(), paddedBusyEnd.toISO())) return false;
      }
      return true;
    });

    // convert to client timezone representation (ISO + timezone)
    const out = available.map((s) => ({
      start: s.start,
      end: s.end,
    }));
    // If requesting teacher view, return full candidate list.
    if (teacherView) return res.json({ timezone: tz, slots: out });

    // For student-facing availability, limit to slots that the teacher has exposed if configured.
    const exposed = await readExposedSlots().catch(() => []);
    let filtered = out;
    if (Array.isArray(exposed) && exposed.length > 0) {
      filtered = out.filter((s) => exposed.some((e) => e.start === s.start && e.end === s.end));
    }
    res.json({ timezone: tz, slots: filtered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute availability' });
  }
});

router.post('/book', async (req, res) => {
  try {
    const { studentName, studentEmail, notes, isoStart, isoEnd } = req.body;
    if (!studentName || !studentEmail || !isoStart || !isoEnd) {
      return res.status(400).json({ error: 'Missing booking fields' });
    }

    const calendar = getCalendar();

    // Concurrency guard: re-run freeBusy for this slot range
    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin: isoStart,
        timeMax: isoEnd,
        items: [{ id: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary' }],
      },
    });
    const busy = (fb.data.calendars || {})[process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary']?.busy || [];
    if (busy.length > 0) return res.status(409).json({ error: 'Slot no longer available' });

    const timeZone = req.body?.tz || 'UTC';
    const eventPayload = {
      summary: `Spanish Lesson - ${studentName}`,
      description: `Goals: ${notes || ''}`,
      start: { dateTime: isoStart, timeZone },
      end: { dateTime: isoEnd, timeZone },
      attendees: [{ email: studentEmail }],
      conferenceData: {
        createRequest: {
          requestId: `miki-lesson-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary',
      resource: eventPayload,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    // create a short-lived manage token for the attendee
    const managePayload = {
      eventId: response.data.id,
      email: studentEmail,
      exp: DateTime.utc().plus({ hours: MANAGE_TOKEN_HOURS }).toISO(),
    };
    const manageToken = signManageToken(managePayload);

    // attempt to email the manage link if mailer configured
    if (mailer && studentEmail) {
      try {
        await sendManageEmail(manageToken, studentEmail);
      } catch (e) {
        console.error('Failed to send manage email', e);
      }
    }

    res.json({ event: response.data, manageToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Request a manage link by eventId + email (sends signed token to email)
router.post('/send-manage-link', async (req, res) => {
  try {
    const { eventId, email } = req.body || {};
    if (!eventId || !email) return res.status(400).json({ error: 'Missing eventId or email' });
    // create token
    const payload = { eventId, email, exp: DateTime.utc().plus({ hours: MANAGE_TOKEN_HOURS }).toISO() };
    const token = signManageToken(payload);
    if (mailer) {
      await sendManageEmail(token, email);
      return res.json({ ok: true });
    }
    // fallback: return token in response (for dev)
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create or send manage link' });
  }
});

// Exposed slots management (teacher)
function parseCookieHeader(cookieHeader, name) {
  if (!cookieHeader) return undefined;
  const pairs = cookieHeader.split(';').map(p => p.trim());
  for (const p of pairs) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx);
    const v = decodeURIComponent(p.slice(idx + 1));
    if (k === name) return v;
  }
  return undefined;
}

function requireTeacherToken(req, res, next) {
  const headerToken = ((req.headers.authorization || '').replace(/^Bearer\s+/i, '') || '');
  const cookieToken = parseCookieHeader(req.headers.cookie, 'teacher_token') || '';
  const token = headerToken || cookieToken;
  const expected = process.env.TEACHER_TOKEN || '';
  if (!expected) return res.status(403).json({ error: 'Teacher auth not configured' });
  if (token !== expected) return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.get('/exposed-slots', requireTeacherToken, async (req, res) => {
  try {
    const slots = await readExposedSlots();
    res.json({ slots });
  } catch (e) {
    res.json({ slots: [] });
  }
});

router.post('/exposed-slots', requireTeacherToken, async (req, res) => {
  try {
    const slots = req.body?.slots;
    if (!Array.isArray(slots)) return res.status(400).json({ error: 'Missing slots array' });
    // normalize to only contain valid start/end pairs
    const normalized = slots
      .filter((s) => s && typeof s.start === 'string' && typeof s.end === 'string' && s.start && s.end)
      .map((s) => ({ start: s.start, end: s.end }));
    await writeExposedSlots(normalized);
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to write exposed slots', e);
    res.status(500).json({ error: 'Failed to save exposed slots' });
  }
});

// Token-based manage endpoints
router.get('/manage/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const info = verifyManageToken(token);
    if (!info) return res.status(403).json({ error: 'Invalid or expired token' });
    const calendar = getCalendar();
    const response = await calendar.events.get({ calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary', eventId: info.eventId });
    res.json({ event: response.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

router.patch('/manage/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const info = verifyManageToken(token);
    if (!info) return res.status(403).json({ error: 'Invalid or expired token' });
    const eventId = info.eventId;
    const { studentName, studentEmail, notes, isoStart, isoEnd } = req.body;
    const fields = {};
    if (studentName) fields.summary = `Spanish Lesson - ${studentName}`;
    if (notes !== undefined) fields.description = `Goals: ${notes}`;
    if (studentEmail) fields.attendees = [{ email: studentEmail }];

    // If moving the event, run same checks as event patch
    if (isoStart && isoEnd) {
      const existing = await getCalendar().events.get({ calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary', eventId });
      const fb = await getCalendar().freebusy.query({
        requestBody: {
          timeMin: isoStart,
          timeMax: isoEnd,
          items: [{ id: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary' }],
        },
      });
      const busy = (fb.data.calendars || {})[process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary']?.busy || [];
      const onlySelf = busy.length === 1 && existing.data.start && existing.data.end && busy[0].start === existing.data.start.dateTime && busy[0].end === existing.data.end.dateTime;
      if (busy.length > 0 && !onlySelf) return res.status(409).json({ error: 'Desired slot is not available' });
      const timeZone = req.body?.tz || 'UTC';
      fields.start = { dateTime: isoStart, timeZone };
      fields.end = { dateTime: isoEnd, timeZone };
    }

    const response = await getCalendar().events.patch({ calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary', eventId, resource: fields, sendUpdates: 'all' });
    res.json({ event: response.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/manage/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const info = verifyManageToken(token);
    if (!info) return res.status(403).json({ error: 'Invalid or expired token' });
    const eventId = info.eventId;
    await getCalendar().events.delete({ calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary', eventId, sendUpdates: 'all' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;

// GET an event by ID
router.get('/event/:id', async (req, res) => {
  try {
    const calendar = getCalendar();
    const eventId = req.params.id;
    const response = await calendar.events.get({
      calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary',
      eventId,
    });
    res.json({ event: response.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// PATCH: update event (notes/name/email) - simple modifications
router.patch('/event/:id', async (req, res) => {
  try {
    const calendar = getCalendar();
    const eventId = req.params.id;
    const { studentName, studentEmail, notes, isoStart, isoEnd } = req.body;
    const fields = {};
    if (studentName) fields.summary = `Spanish Lesson - ${studentName}`;
    if (notes !== undefined) fields.description = `Goals: ${notes}`;
    if (studentEmail) fields.attendees = [{ email: studentEmail }];

    // If moving the event, check new slot availability
    if (isoStart && isoEnd) {
      // fetch existing event
      const existing = await calendar.events.get({ calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary', eventId });
      // check freebusy for proposed time
      const fb = await calendar.freebusy.query({
        requestBody: {
          timeMin: isoStart,
          timeMax: isoEnd,
          items: [{ id: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary' }],
        },
      });
      const busy = (fb.data.calendars || {})[process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary']?.busy || [];
      // allow if busy is empty OR busy only equals the existing event's own interval
      const onlySelf = busy.length === 1 && existing.data.start && existing.data.end && busy[0].start === existing.data.start.dateTime && busy[0].end === existing.data.end.dateTime;
      if (busy.length > 0 && !onlySelf) return res.status(409).json({ error: 'Desired slot is not available' });
      const timeZone = req.body?.tz || 'UTC';
      fields.start = { dateTime: isoStart, timeZone };
      fields.end = { dateTime: isoEnd, timeZone };
    }

    const response = await calendar.events.patch({
      calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary',
      eventId,
      resource: fields,
      sendUpdates: 'all',
    });
    res.json({ event: response.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// GET reschedule options for an event (returns candidate slots excluding the event itself)
router.get('/reschedule-options/:id', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '14', 10);
    const calendar = getCalendar();
    const eventId = req.params.id;

    const existing = await calendar.events.get({ calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary', eventId });
    const now = DateTime.utc();
    const timeMin = now.toISO();
    const timeMax = now.plus({ days }).toISO();

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary' }],
      },
    });

    let busy = (freeBusyResponse.data.calendars || {})[process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary']?.busy || [];
    // remove the event's own busy interval if present (match by timestamps)
    if (existing.data.start && existing.data.end) {
      const es = existing.data.start.dateTime || existing.data.start.date;
      const ee = existing.data.end.dateTime || existing.data.end.date;
      busy = busy.filter((b) => !(b.start === es && b.end === ee));
    }

    const candidates = generateCandidateSlots(now.startOf('day'), days, parseInt(process.env.WORK_DAY_START || '9', 10), parseInt(process.env.WORK_DAY_END || '17', 10));

    const available = candidates.filter((s) => {
      const slotStart = DateTime.fromISO(s.start);
      const slotEnd = DateTime.fromISO(s.end);
      // enforce lead time
      const leadLimit = now.plus({ hours: LEAD_HOURS });
      if (slotStart < leadLimit) return false;
      for (const b of busy) {
        const busyStart = DateTime.fromISO(b.start);
        const busyEnd = DateTime.fromISO(b.end).plus({ minutes: BUFFER_MINUTES });
        if (overlaps(s.start, s.end, busyStart.toISO(), busyEnd.toISO())) return false;
      }
      return true;
    });

    res.json({ slots: available });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute reschedule options' });
  }
});

// DELETE: cancel (delete) an event. Optionally require attendee email in body for simple authorization.
router.delete('/event/:id', async (req, res) => {
  try {
    const calendar = getCalendar();
    const eventId = req.params.id;
    const { email } = req.body || {};

    // Basic guard: ensure the provided email is an attendee on the event
    try {
      const existing = await calendar.events.get({
        calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary',
        eventId,
      });
      if (email) {
        const attendees = existing.data.attendees || [];
        const found = attendees.find((a) => a.email && a.email.toLowerCase() === (email || '').toLowerCase());
        if (!found) return res.status(403).json({ error: 'Email not authorized to cancel this event' });
      }
    } catch (err) {
      // fallthrough to delete attempt
    }

    await calendar.events.delete({
      calendarId: process.env.MIKI_PRIMARY_CALENDAR_ID || 'primary',
      eventId,
      sendUpdates: 'all',
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});
