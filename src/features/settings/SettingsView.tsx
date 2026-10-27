import type { ReactNode } from 'react';
import { AudioProgress } from './AudioProgress';
import { micSupported } from '../../lib/pitchTrack';
import { go } from '../../lib/router';
import { setQuietUntil, setSpeakPausedUntil, updateSettings, useQuietUntil, useSettings, useSpeakPausedUntil } from '../../lib/settings';
import type { Settings } from '../../db/db';
import { isStandalone, useInstall } from './install';
import { BackupSection, SyncSection } from './Account';
import { PacksSection } from '../packs/PacksSection';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ v: T; label: string }>; onChange: (v: T) => void; label: string }) {
  const idx = options.findIndex((o) => o.v === value);
  const n = options.length;
  return (
    <div role="radiogroup" aria-label={label} className="relative flex rounded-xl bg-sunk p-1">
      {idx >= 0 && (
        <span
          aria-hidden
          className="absolute inset-y-1 rounded-lg bg-surface shadow-sm transition-[left] duration-300 [transition-timing-function:var(--ease-out)]"
          style={{ left: `calc(4px + ${idx} * (100% - 8px) / ${n})`, width: `calc((100% - 8px) / ${n})` }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`relative flex-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-200 ${value === o.v ? 'text-ink' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="border-b border-line py-4 last:border-0">
      <p className="font-medium">{title}</p>
      {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}


export function SettingsView() {
  const s = useSettings();
  const set = (patch: Partial<Settings>) => void updateSettings(patch);
  const quietUntil = useQuietUntil();
  const speakPaused = useSpeakPausedUntil();
  const quiet = quietUntil > Date.now();
  const { canInstall, install } = useInstall();
  const onOff = [
    { v: 'on', label: 'On' },
    { v: 'off', label: 'Off' },
  ] as const;

  return (
    <div className="pb-10">
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>

      <h2 className="mb-2 mt-2 text-sm font-semibold text-muted">Reviews</h2>
      <section className="mb-6 rounded-2xl bg-surface px-4" aria-label="Review settings">
        <Row
          title="Target retention"
          hint="How often you should still remember a word when it comes back. Higher means more reviews; 90% is the usual balance."
        >
          <Segmented
            label="Target retention"
            value={String(s.retention)}
            onChange={(v) => set({ retention: Number(v) })}
            options={['0.85', '0.9', '0.95'].map((v) => ({ v, label: `${Math.round(Number(v) * 100)}%` }))}
          />
        </Row>
        <Row title="New words per day">
          <Segmented
            label="New words per day"
            value={String(s.newPerDay)}
            onChange={(v) => set({ newPerDay: Number(v) })}
            options={['5', '10', '15', '20'].map((v) => ({ v, label: v }))}
          />
        </Row>
        <Row title="Daily goal" hint="XP a day to keep your streak. A right answer is worth about 10 XP, more with a combo.">
          <Segmented
            label="Daily goal"
            value={String(s.dailyGoal)}
            onChange={(v) => set({ dailyGoal: Number(v) })}
            options={['50', '100', '200', '300'].map((v) => ({ v, label: `${v} XP` }))}
          />
        </Row>
        <Row title="Characters" hint="Pinyin is always shown. Characters are optional and never needed to answer.">
          <Segmented
            label="Characters"
            value={s.showHanzi ? 'on' : 'off'}
            onChange={(v) => set({ showHanzi: v === 'on' })}
            options={[
              { v: 'off', label: 'Hide' },
              { v: 'on', label: 'Show' },
            ]}
          />
        </Row>
        <Row title="Reviews per day" hint="A cap for busy days. Reviews left over wait until tomorrow.">
          <Segmented
            label="Reviews per day"
            value={String(s.reviewsPerDay)}
            onChange={(v) => set({ reviewsPerDay: Number(v) })}
            options={[
              { v: '100', label: '100' },
              { v: '200', label: '200' },
              { v: '500', label: '500' },
              { v: '9999', label: 'No limit' },
            ]}
          />
        </Row>
      </section>

      <section className="rounded-2xl bg-surface px-4">
        <Row title="Pinyin above characters">
          <Segmented
            label="Pinyin above characters"
            value={s.pinyinDisplay}
            onChange={(v) => set({ pinyinDisplay: v })}
            options={[
              { v: 'always', label: 'Always' },
              { v: 'hover', label: 'Hover' },
              { v: 'tap', label: 'Tap' },
              { v: 'never', label: 'Never' },
            ]}
          />
        </Row>
        <Row title="Tone grading" hint="Strict: a wrong or missing tone counts as wrong. Lenient: right syllables with a tone slip count as “Hard”, so the word comes back sooner.">
          <Segmented
            label="Tone grading"
            value={s.strictTones ? 'strict' : 'lenient'}
            onChange={(v) => set({ strictTones: v === 'strict' })}
            options={[
              { v: 'lenient', label: 'Lenient' },
              { v: 'strict', label: 'Strict' },
            ]}
          />
        </Row>
        <Row title="Colour characters by tone" hint="Red 1st, orange 2nd, green 3rd, blue 4th, grey neutral">
          <Segmented label="Tone colours" value={s.toneColors ? 'on' : 'off'} onChange={(v) => set({ toneColors: v === 'on' })} options={[...onOff]} />
        </Row>
        <Row title="Extra tone practice" hint="Adds more tone exercises to every lesson: hearing tones, minimal pairs and dictation with tones.">
          <Segmented label="Extra tone practice" value={s.toneFocus ? 'on' : 'off'} onChange={(v) => set({ toneFocus: v === 'on' })} options={[...onOff]} />
        </Row>
        <Row title="Audio speed" hint="Slow uses a separately recorded slower version. You can always tap the turtle for slow or the speaker for normal.">
          <Segmented
            label="Audio speed"
            value={s.audioSpeed}
            onChange={(v) => set({ audioSpeed: v })}
            options={[
              { v: 'normal', label: 'Normal' },
              { v: 'slow', label: 'Slow' },
            ]}
          />
        </Row>
        <Row title="Sound effects">
          <Segmented label="Sound effects" value={s.sound ? 'on' : 'off'} onChange={(v) => set({ sound: v === 'on' })} options={[...onOff]} />
        </Row>
        <Row title="Appearance">
          <Segmented
            label="Appearance"
            value={s.theme}
            onChange={(v) => set({ theme: v })}
            options={[
              { v: 'system', label: 'Auto' },
              { v: 'light', label: 'Light' },
              { v: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
      </section>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-muted">Situations</h2>
      <section className="rounded-2xl bg-surface px-4">
        <Row title="Can't listen now" hint="Swaps listening exercises for reading ones for an hour.">
          {quiet ? (
            <button onClick={() => setQuietUntil(0)} className="rounded-xl border-2 border-line px-4 py-2 font-medium">
              Turn listening back on (until {new Date(quietUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </button>
          ) : (
            <button onClick={() => setQuietUntil(Date.now() + 3600_000)} className="rounded-xl border-2 border-line px-4 py-2 font-medium">
              Skip listening for 1 hour
            </button>
          )}
        </Row>
        <Row
          title="Use microphone"
          hint={
            micSupported
              ? 'Speaking practice: say words and compare your pitch with the native recording. Recordings stay on this device. When off, speaking is skipped, never failed.'
              : "This browser can't record from the microphone, so speaking practice is unavailable here."
          }
        >
          {micSupported ? (
            <div className="flex flex-col gap-2">
              <Segmented label="Use microphone" value={s.speaking ? 'on' : 'off'} onChange={(v) => set({ speaking: v === 'on' })} options={[...onOff]} />
              {s.speaking &&
                (speakPaused > Date.now() ? (
                  <button onClick={() => setSpeakPausedUntil(0)} className="self-start text-sm font-medium text-jade">
                    Paused until {new Date(speakPaused).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Resume now
                  </button>
                ) : (
                  <button onClick={() => setSpeakPausedUntil(Date.now() + 3600_000)} className="self-start rounded-xl border-2 border-line px-4 py-2 font-medium">
                    No mic right now (1 hour)
                  </button>
                ))}
            </div>
          ) : (
            <Segmented label="Use microphone" value="off" onChange={() => {}} options={[{ v: 'off', label: 'Unavailable' }]} />
          )}
        </Row>
      </section>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-muted">Sync & backup</h2>
      <section className="rounded-2xl bg-surface px-4">
        <div className="border-b border-line">
          <p className="pt-4 font-medium">Sync between devices</p>
          <SyncSection />
        </div>
        <div>
          <p className="pt-4 font-medium">Backup</p>
          <BackupSection />
        </div>
      </section>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-muted">AI practice packs</h2>
      <section className="rounded-2xl bg-surface px-4">
        <PacksSection />
      </section>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-muted">App</h2>
      <section className="rounded-2xl bg-surface px-4">
        {!isStandalone() && (
          <Row title="Install" hint={canInstall ? 'Adds the app to your home screen / start menu and works offline.' : 'Use your browser menu → “Install app” or “Add to Home screen”.'}>
            {canInstall && (
              <button onClick={install} className="rounded-xl bg-jade px-4 py-2 font-semibold text-jade-ink">
                Install app
              </button>
            )}
          </Row>
        )}
        <Row title="Recordings" hint="Azure is recording every word and sentence. Older recordings are used until each one is ready.">
          <AudioProgress />
        </Row>
        <Row title="Voice" hint="Everything is being recorded in one natural voice, Xiaoxiao (Yunxi for the men in the dialogues).">
          <button onClick={() => go('audio-sample')} className="rounded-xl border-2 border-line px-4 py-2 font-medium">
            Audio sample
          </button>
        </Row>
        <Row title="About">
          <button onClick={() => go('about')} className="rounded-xl border-2 border-line px-4 py-2 font-medium">
            Credits & licences
          </button>
        </Row>
      </section>
      <p className="mt-4 text-center text-xs text-muted">
        Version from{' '}
        {new Date(__BUILD_TIME__).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
