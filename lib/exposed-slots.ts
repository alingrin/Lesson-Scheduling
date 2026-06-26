import { Redis } from '@upstash/redis';
import { Slot } from './slots';

function redis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function readExposedSlots(): Promise<Slot[]> {
  const data = await redis().get<Slot[]>('exposed-slots');
  return data ?? [];
}

export async function writeExposedSlots(slots: Slot[]): Promise<void> {
  await redis().set('exposed-slots', slots);
}
