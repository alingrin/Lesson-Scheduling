import { Redis } from '@upstash/redis';

export interface TeacherCredentials {
  refreshToken: string;
  email: string;
}

function redis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function saveTeacherCredentials(creds: TeacherCredentials): Promise<void> {
  await redis().set('teacher_credentials', creds);
}

export async function loadTeacherCredentials(): Promise<TeacherCredentials | null> {
  return redis().get<TeacherCredentials>('teacher_credentials');
}
