import fs from 'fs/promises';
import path from 'path';

export interface TeacherSettings {
  workDayStart: number;   // hour 0-23
  workDayEnd: number;     // hour 0-23
  workDays: number[];     // 0=Sun … 6=Sat
  workTimezone: string;   // IANA timezone, e.g. "Europe/Madrid"
}

const FILE = path.join(process.cwd(), 'src', 'data', 'settings.json');

const DEFAULTS: TeacherSettings = {
  workDayStart: parseInt(process.env.WORK_DAY_START || '9', 10),
  workDayEnd: parseInt(process.env.WORK_DAY_END || '17', 10),
  workDays: [1, 2, 3, 4, 5],
  workTimezone: process.env.WORK_TIMEZONE || 'UTC',
};

export async function readSettings(): Promise<TeacherSettings> {
  try {
    return { ...DEFAULTS, ...JSON.parse(await fs.readFile(FILE, 'utf8')) };
  } catch {
    return DEFAULTS;
  }
}

export async function writeSettings(s: TeacherSettings): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
}
