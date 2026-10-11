/** Where generated audio lives, relative to the site root / public folder. */
export type Voice = 'f' | 'm';
export const VOICES: Voice[] = ['f', 'm'];

export function audioPath(id: string, voice: Voice, slow = false): string {
  return `audio/${voice}/${id}${slow ? '.slow' : ''}.mp3`;
}

/** All files that should exist for an item. Sentences also get a slow version. */
export function audioFilesFor(id: string, withSlow: boolean): string[] {
  return VOICES.flatMap((v) => (withSlow ? [audioPath(id, v), audioPath(id, v, true)] : [audioPath(id, v)]));
}
