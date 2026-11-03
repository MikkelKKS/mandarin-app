import { describe, expect, it } from 'vitest';
import { blockedSpeaker, openLicence, plainArtist, textOfTitle } from './real-audio';

describe('real speakers from Wikimedia Commons (IDEAS #20)', () => {
  it('reads the Chinese text from Lingua Libre and older Commons titles', () => {
    expect(textOfTitle('File:LL-Q9192 (cmn)-Luilui6666-银行.wav')).toBe('银行');
    expect(textOfTitle('File:LL-Q9192 (cmn)-Some-User-朋友.wav')).toBe('朋友');
    expect(textOfTitle('File:Zh-你好.ogg')).toBe('你好');
    expect(textOfTitle('File:Zh-ba1.ogg')).toBeNull(); // pinyin title, not characters
    expect(textOfTitle('File:LL-Q9192 (cmn)-Luilui6666-102块钱.wav')).toBeNull(); // digits: not a plain word
  });
  it('only accepts licences that allow reuse', () => {
    for (const ok of ['CC BY-SA 4.0', 'CC BY 3.0', 'CC0', 'Public domain', 'CC-BY-SA-3.0']) expect(openLicence(ok), ok).toBe(true);
    for (const no of ['CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'CC BY-ND 4.0', '', 'All rights reserved']) expect(openLicence(no), no).toBe(false);
  });
  it('turns the HTML artist field into a plain name', () => {
    expect(plainArtist('<a href="//commons.wikimedia.org/wiki/User:X">X</a>')).toBe('X');
    expect(plainArtist('')).toBe('unknown');
    expect(plainArtist('Speaker: <a>CanonNi</a> Recorder: CanonNi')).toBe('CanonNi');
    expect(plainArtist('Speaker: A Recorder: B')).toBe('A, recorded by B');
  });

  it('leaves out blocked speakers (Jouketou)', () => {
    expect(blockedSpeaker('File:LL-Q9192 (cmn)-Jouketou-办法.wav')).toBe(true);
    expect(blockedSpeaker('File:x.wav', 'Jouketou, recorded by Y')).toBe(true);
    expect(blockedSpeaker('File:LL-Q9192 (cmn)-CanonNi-办法.wav', 'CanonNi')).toBe(false);
  });
});
