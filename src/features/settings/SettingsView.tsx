import type { ReactNode } from 'react';
import { go } from '../../lib/router';
import { setQuietUntil, updateSettings, useQuietUntil, useSettings } from '../../lib/settings';
import type { Settings } from '../../db/db';
import { isStandalone, useInstall } from './install';
import { BackupSection, SyncSection } from './Account';
import { PacksSection } from '../packs/PacksSection';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ v: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-sunk p-1">
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition ${value === o.v ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
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

const speechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

export function SettingsView() {
  const s = useSettings();
  const set = (patch: Partial<Settings>) => void updateSettings(patch);
  const quietUntil = useQuietUntil();
  const quiet = quietUntil > Date.now();
  const { canInstall, install } = useInstall();
  const onOff = [
    { v: 'on', label: 'On' },
    { v: 'off', label: 'Off' },
  ] as const;

  return (
    <div className="pb-10">
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>

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
        <Row title="Tone strictness" hint="Lenient: missing tones count as “almost”. Strict: tones are required.">
          <Segmented
            label="Tone strictness"
            value={s.strictTones ? 'strict' : 'lenient'}
            onChange={(v) => set({ strictTones: v === 'strict' })}
            options={[
              { v: 'lenient', label: 'Lenient' },
              { v: 'strict', label: 'Strict' },
            ]}
          />
        </Row>
        <Row title="Colour characters by tone" hint="Red 1st · orange 2nd · blue 3rd · purple 4th · grey neutral">
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
        <Row title="Voice">
          <Segmented
            label="Voice"
            value={s.voice}
            onChange={(v) => set({ voice: v })}
            options={[
              { v: 'alternate', label: 'Alternate' },
              { v: 'f', label: 'Female' },
              { v: 'm', label: 'Male' },
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
          title="Speaking exercises"
          hint={
            speechSupported
              ? 'Adds repeat-after-me exercises with a pitch chart for your tones. Never affects your progress.'
              : 'This browser has no speech recognition, so speaking exercises are unavailable here. Chrome on Android and Chrome/Edge on PC support it.'
          }
        >
          {speechSupported ? (
            <Segmented label="Speaking exercises" value={s.speaking ? 'on' : 'off'} onChange={(v) => set({ speaking: v === 'on' })} options={[...onOff]} />
          ) : (
            <Segmented label="Speaking exercises" value="off" onChange={() => {}} options={[{ v: 'off', label: 'Unavailable' }]} />
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
        <Row title="About">
          <button onClick={() => go('about')} className="rounded-xl border-2 border-line px-4 py-2 font-medium">
            Credits & licences
          </button>
        </Row>
      </section>
    </div>
  );
}
