import { VolumeSlider } from '../../components/VolumeSlider';
import type { ReactNode } from 'react';
import { AudioProgress } from './AudioProgress';
import { micSupported } from '../../lib/pitchTrack';
import { go } from '../../lib/router';
import { setSpeakPausedUntil, updateSettings, useSettings, useSpeakPausedUntil } from '../../lib/settings';
import type { Settings } from '../../db/db';
import { isStandalone, useInstall } from './install';
import { BackupSection, SyncSection } from './Account';
import { PageHeader } from '../../components/PageHeader';
import { ChevronRight } from '../../components/icons';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ v: T; label: string }>; onChange: (v: T) => void; label: string }) {
  const idx = options.findIndex((o) => o.v === value);
  const n = options.length;
  return (
    <div role="radiogroup" aria-label={label} className="relative flex rounded-xl bg-sunk p-0.5">
      {idx >= 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0.5 rounded-[10px] bg-surface shadow-sm transition-[left] duration-300 [transition-timing-function:var(--ease-out)]"
          style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`, width: `calc((100% - 4px) / ${n})` }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`relative flex-1 rounded-[10px] px-2 py-1.5 text-sm font-medium transition-colors duration-200 ${value === o.v ? 'text-ink' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** An on/off switch. */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-jade' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 [transition-timing-function:var(--ease-out)] ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

/** A settings row: title and explanation, with the control beside it (switches, links) or below it (choices). */
function Row({ title, hint, children, side }: { title: string; hint?: ReactNode; children?: ReactNode; side?: ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          {hint && <p className="mt-0.5 text-sm leading-snug text-muted">{hint}</p>}
        </div>
        {side}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function LinkRow({ title, hint, to }: { title: string; hint?: string; to: string }) {
  return (
    <button onClick={() => go(to)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-sunk/50">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {hint && <span className="mt-0.5 block text-sm leading-snug text-muted">{hint}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="mb-2 px-1 text-sm font-medium text-muted">{title}</h2>
      <div className="group-list">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const s = useSettings();
  const set = (patch: Partial<Settings>) => void updateSettings(patch);
  const speakPaused = useSpeakPausedUntil();
  const { canInstall, install } = useInstall();

  return (
    <div className="pb-10">
      <PageHeader title="Settings" />

      <Group title="Learning">
        <Row title="New words per day">
          <Segmented label="New words per day" value={String(s.newPerDay)} onChange={(v) => set({ newPerDay: Number(v) })} options={['5', '10', '15', '20'].map((v) => ({ v, label: v }))} />
        </Row>
        <Row title="New reading words per day" hint="Words to start reading (Reading tab and deep sessions). Their characters come on top.">
          <Segmented
            label="New reading words per day"
            value={String(s.readingNewPerDay)}
            onChange={(v) => set({ readingNewPerDay: Number(v) })}
            options={['5', '10', '15', '20'].map((v) => ({ v, label: v }))}
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
        <Row title="Daily goal" hint="XP a day to keep your streak. A right answer is worth about 10 XP, more with a combo.">
          <Segmented label="Daily goal" value={String(s.dailyGoal)} onChange={(v) => set({ dailyGoal: Number(v) })} options={['50', '100', '200', '300'].map((v) => ({ v, label: `${v} XP` }))} />
        </Row>
        <Row title="Target retention" hint="How likely you should be to remember a word when it comes back. Higher means more reviews; 90% is the usual balance.">
          <Segmented label="Target retention" value={String(s.retention)} onChange={(v) => set({ retention: Number(v) })} options={['0.85', '0.9', '0.95'].map((v) => ({ v, label: `${Math.round(Number(v) * 100)}%` }))} />
        </Row>
        <Row
          title="Beijing pack"
          hint="Her family's Beijing Mandarin first: 儿化 words (哪儿, 一会儿, 没事儿…) and everyday Beijing words come first among your new words."
          side={<Toggle label="Beijing pack" on={s.beijingPack} onChange={(on) => set({ beijingPack: on })} />}
        />
        <Row
          title="Tone questions in sessions"
          hint="Mix single-tone questions, recorded by six real speakers, into quick and deep sessions."
          side={<Toggle label="Tone questions in sessions" on={s.sessionTones} onChange={(on) => set({ sessionTones: on })} />}
        />
        <LinkRow title="Your level" hint="Mark words you already know, with a 5-minute test or by picking a starting level." to="placement" />
      </Group>

      <Group title="Answers and display">
        <Row title="Tone grading" hint="Strict: a wrong or missing tone counts as wrong. Lenient: a tone slip counts as “Hard”, so the word comes back sooner.">
          <Segmented
            label="Tone grading"
            value={s.strictTones ? 'strict' : 'lenient'}
            onChange={(v) => set({ strictTones: v === 'strict' })}
            options={[
              { v: 'strict', label: 'Strict' },
              { v: 'lenient', label: 'Lenient' },
            ]}
          />
        </Row>
        <Row title="Show characters" hint="In sessions. Pinyin is always shown; characters are never needed to answer." side={<Toggle label="Show characters" on={s.showHanzi} onChange={(on) => set({ showHanzi: on })} />} />
        <Row title="Tone colours" hint="Red 1st, orange 2nd, green 3rd, blue 4th, grey neutral." side={<Toggle label="Tone colours" on={s.toneColors} onChange={(on) => set({ toneColors: on })} />} />
        <Row title="Pinyin above characters" hint="In Conversations, stories and song lyrics.">
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
        <Row title="Volume" hint="For every recording. Remembered on this device." side={<VolumeSlider />} />
        <Row title="Sound effects" side={<Toggle label="Sound effects" on={s.sound} onChange={(on) => set({ sound: on })} />} />
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
      </Group>

      <Group title="Microphone">
        <Row
          title="Use microphone"
          hint={
            micSupported
              ? 'Speaking practice: say words and compare your pitch with the native recording. Recordings stay on this device. When off, speaking is skipped, never failed.'
              : "This browser can't record from the microphone, so speaking practice is off here."
          }
          side={micSupported ? <Toggle label="Use microphone" on={s.speaking} onChange={(on) => set({ speaking: on })} /> : undefined}
        >
          {micSupported &&
            s.speaking &&
            (speakPaused > Date.now() ? (
              <button onClick={() => setSpeakPausedUntil(0)} className="text-sm font-medium text-jade">
                Paused until {new Date(speakPaused).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Resume now
              </button>
            ) : (
              <button onClick={() => setSpeakPausedUntil(Date.now() + 3600_000)} className="btn btn-quiet h-10 px-4 text-sm">
                No mic right now (1 hour)
              </button>
            ))}
        </Row>
      </Group>

      <Group title="Sync and backup">
        <div className="px-4 pb-1 pt-3.5">
          <p className="font-medium">Sync between devices</p>
          <SyncSection />
        </div>
        <div className="px-4 pb-1 pt-3.5">
          <p className="font-medium">Backup</p>
          <BackupSection />
        </div>
      </Group>

      <Group title="Recordings">
        <Row title="Progress" hint="Every word, sentence and story is being recorded with Azure's Xiaoxiao voice (Yunxi for lines a man says). Older recordings are used until each one is ready.">
          <AudioProgress />
        </Row>
        <LinkRow title="Voice sample" hint="The 30 test items, including tricky tones." to="audio-sample" />
      </Group>

      <Group title="App">
        {!isStandalone() && (
          <Row
            title="Install"
            hint={canInstall ? 'Adds the app to your home screen or Start menu; it then works offline.' : 'Use your browser menu → “Install app” or “Add to Home screen”.'}
            side={
              canInstall ? (
                <button onClick={install} className="btn btn-primary h-10 px-4 text-sm">
                  Install
                </button>
              ) : undefined
            }
          />
        )}
        <LinkRow title="Credits and licences" to="about" />
      </Group>
      <p className="mt-6 text-center text-xs text-muted">
        Version from{' '}
        {new Date(__BUILD_TIME__).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
