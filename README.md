# Miki's Spanish Lesson Scheduler

Lightweight booking platform that uses Google Calendar as the scheduling engine.

Quick start

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:

```bash
npm install
```

3. Run in dev:

```bash
npm run dev
```

Open http://localhost:5000

Env variables

- `PORT` (optional)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MIKI_REFRESH_TOKEN` (persistent refresh token for instructor account)
- `MIKI_PRIMARY_CALENDAR_ID` (default: `primary`)
- `LESSON_DURATION_MINUTES` (default: 60)
- `BUFFER_TIME_MINUTES` (default: 10)
- `WORK_DAY_START` (hour, default 9)
- `WORK_DAY_END` (hour, default 17)
- `LEAD_TIME_HOURS` (default 24)
- `SLOT_STEP_MINUTES` (default: 15)

Notes

- This is a minimal prototype wiring the Google Calendar API. You must obtain OAuth credentials and a refresh token for Miki's account.
- The backend enforces lead time, buffer, and re-checks availability before inserting events.
