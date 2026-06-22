import fs from 'fs/promises';
import path from 'path';
import { Slot } from './slots';

const FILE = path.join(process.cwd(), 'src', 'data', 'exposed-slots.json');

export async function readExposedSlots(): Promise<Slot[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Slot[];
  } catch {
    return [];
  }
}

export async function writeExposedSlots(slots: Slot[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(slots, null, 2), 'utf8');
}
