import { Redis } from '@upstash/redis';
import crypto from 'crypto';

export interface TeacherSession {
  accessToken: string;
  refreshToken: string;
  email: string;
}

const TTL = 60 * 60 * 24 * 30; // 30 days

function redis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function key(sessionId: string) {
  return `teacher_session:${sessionId}`;
}

export async function createSession(session: TeacherSession): Promise<string> {
  const id = crypto.randomBytes(32).toString('hex');
  await redis().set(key(id), session, { ex: TTL });
  return id;
}

export async function getSession(sessionId: string): Promise<TeacherSession | null> {
  return redis().get<TeacherSession>(key(sessionId));
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis().del(key(sessionId));
}
