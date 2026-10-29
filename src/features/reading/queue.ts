/** The reading queue for now, from the local database (Reading tab rounds and the deep session's Reading block). */
import { db } from '../../db/db';
import { buildReadQueue, newReadToday, type ReadMode, type ReadQueue } from '../../lib/reading';
import { currentSettings } from '../../lib/settings';
import { wordOrder } from '../session/beijing';
import { loadReadData } from './data';

/** The reading queue for now (Reading tab rounds and the deep session's Reading block). */
export async function readingQueue(mode: ReadMode, maxNew?: number): Promise<ReadQueue> {
  const now = Date.now();
  const [d, cards, logs] = await Promise.all([loadReadData(), db.reviewItems.toArray(), db.reviewLogs.where('at').above(now - 2 * 864e5).toArray()]);
  const words = wordOrder(d.vocab.words.map((w) => w.id), currentSettings().beijingPack, currentSettings().nextWords)
    .map((id) => d.vocab.byId.get(id))
    .filter((w): w is NonNullable<typeof w> => !!w);
  return buildReadQueue(d.index, words, cards, { now, mode, newPerDay: currentSettings().readingNewPerDay, newToday: newReadToday(logs, now), maxNew });
}

