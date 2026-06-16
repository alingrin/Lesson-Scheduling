const { google } = require('googleapis');

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.MIKI_REFRESH_TOKEN });
  return auth;
}

function getCalendar() {
  const auth = getAuth();
  return google.calendar({ version: 'v3', auth });
}

module.exports = { getCalendar };
