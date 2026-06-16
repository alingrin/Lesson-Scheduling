#!/usr/bin/env node
const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');
require('dotenv').config();

const REDIRECT_URI = 'http://localhost:5002/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('Opening browser to authorize...');
console.log('Auth URL:', authUrl);
console.log('\nIf browser does not open, copy and paste the URL above into your browser.\n');

// Try to open browser (best-effort)
try {
  const { execSync } = require('child_process');
  execSync(`open "${authUrl}"`, { stdio: 'ignore' });
} catch (e) {
  // Silently fail if 'open' is not available
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, REDIRECT_URI);
  
  if (!req.url.startsWith('/oauth2callback')) {
    res.writeHead(400);
    res.end('Invalid callback');
    return;
  }

  const code = reqUrl.searchParams.get('code');
  const error = reqUrl.searchParams.get('error');

  if (error) {
    res.writeHead(400);
    res.end(`Error from Google: ${error}`);
    console.error('OAuth error:', error);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400);
    res.end('No authorization code received');
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h1>✓ Authorization successful!</h1>
        <p>Check your terminal for the refresh token.</p>
      </body>
      </html>
    `);

    console.log('\n✓ Authorization successful!\n');
    console.log('Tokens received:');
    console.log(JSON.stringify(tokens, null, 2));
    console.log('\n--- COPY THIS REFRESH TOKEN ---');
    console.log(tokens.refresh_token);
    console.log('--- END ---\n');
    console.log('Add this to your .env file:');
    console.log(`MIKI_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Error exchanging code for tokens:', err);
    res.writeHead(500);
    res.end('Error: ' + err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(5002, () => {
  console.log('Listening for OAuth callback on http://localhost:5002/oauth2callback\n');
});
