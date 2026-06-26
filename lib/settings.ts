import { Redis } from '@upstash/redis';

export interface TeacherSettings {
  workDayStart: number;   // hour 0-23
  workDayEnd: number;     // hour 0-23
  workDays: number[];     // 0=Sun … 6=Sat
  workTimezone: string;   // IANA timezone, e.g. "Europe/Madrid"
}

const DEFAULTS: TeacherSettings = {
  workDayStart: parseInt(process.env.WORK_DAY_START || '9', 10),
  workDayEnd: parseInt(process.env.WORK_DAY_END || '17', 10),
  workDays: [1, 2, 3, 4, 5],
  workTimezone: process.env.WORK_TIMEZONE || 'UTC',
};

function redis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function readSettings(): Promise<TeacherSettings> {
  const data = await redis().get<TeacherSettings>('settings');
  return { ...DEFAULTS, ...(data ?? {}) };
}

export async function writeSettings(s: TeacherSettings): Promise<void> {
  await redis().set('settings', s);
}
