require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const bookings = require('./routes/bookings');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Teacher auth middleware: checks TEACHER_TOKEN env var against query, Authorization header, or cookie
const TEACHER_TOKEN = process.env.TEACHER_TOKEN || '';
function parseCookie(cookieHeader, name) {
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

function requireTeacherAuth(req, res, next) {
  if (!TEACHER_TOKEN) return res.status(403).send('Teacher auth not configured');
  const headerToken = ((req.headers.authorization || '').replace(/^Bearer\s+/i, '') || '').toString();
  const cookieToken = parseCookie(req.headers.cookie, 'teacher_token') || '';
  const token = headerToken || cookieToken; // do NOT accept token via URL query param
  if (token !== TEACHER_TOKEN) return res.status(403).send('Forbidden');
  next();
}

// Convenience admin redirect: if TEACHER_TOKEN is set in the environment, redirect
// to /teacher.html with the token query param so teacher can access the admin UI.
app.get('/teacher-admin', (req, res) => {
  if (!TEACHER_TOKEN) return res.status(403).send('Teacher auth not configured');
  // Only allow this convenience on localhost to avoid exposing an easy public entrypoint.
  const ip = req.ip || req.connection?.remoteAddress || '';
  const localIps = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];
  if (!localIps.includes(ip)) return res.status(403).send('Teacher admin only accessible from the server host');
  // set token in httpOnly cookie so it is not exposed in the URL
  res.cookie('teacher_token', TEACHER_TOKEN, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 });
  res.redirect('/teacher.html');
});

// Teacher login page (public). Renders a simple form; on POST it sets the cookie.
app.get('/teacher-login', async (req, res) => {
  try {
    const file = await fs.readFile(path.join(__dirname, '..', 'public', 'teacher-login.html'), 'utf8');
    const err = req.query.error ? '<strong>Invalid token</strong>' : '';
    const out = file.replace('%ERROR%', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(out);
  } catch (e) {
    return res.status(500).send('Failed to load login page');
  }
});

app.post('/teacher-login', (req, res) => {
  const token = (req.body && (req.body.token || req.body.teacherToken)) || '';
  if (!TEACHER_TOKEN) return res.status(403).send('Teacher auth not configured');
  if (token !== TEACHER_TOKEN) {
    return res.redirect('/teacher-login?error=1');
  }
  // set httpOnly cookie for the teacher session
  res.cookie('teacher_token', token, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 });
  return res.redirect('/teacher.html');
});

// Logout: clear teacher token cookie and redirect to the site root
app.get('/teacher-logout', (req, res) => {
  res.clearCookie('teacher_token');
  res.redirect('/');
});

app.use('/api', bookings);

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: 0,
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
