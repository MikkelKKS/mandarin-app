/**
 * Words with a real speaker's recording (IDEAS #20): human pronunciation files
 * from Wikimedia Commons / Lingua Libre in public/audio/real/<word id>.mp3,
 * made by scripts/real-audio.ts. Filled when the word list loads; audio.ts
 * plays these before the Azure voice.
 */
const speakers = new Map<string, string>();

export function registerRealAudio(rows: Array<[id: string, speaker: string]>): void {
  for (const [id, who] of rows) if (who) speakers.set(id, who);
}

/** The speaker of a word's real recording (HSK word id), if it has one. */
export function realSpeaker(id: string): string | undefined {
  return speakers.get(id);
}

/** Bump to make devices fetch the real recordings afresh. */
const REAL_VERSION = 1;
export function realUrl(id: string): string {
  return `${import.meta.env.BASE_URL}audio/real/${id}.mp3?v=${REAL_VERSION}`;
}
