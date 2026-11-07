/**
 * Volume for the audio players; remembered on this device.
 * `compact`: a small round button beside the play buttons that opens the slider in a pop-up,
 * so the exercise's pinyin isn't pushed down by a control you rarely touch.
 */
import { useEffect, useRef, useState } from 'react';
import { getVolume, onVolume, setVolume } from '../lib/audio';

function VolumeIcon({ v, className }: { v: number; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      {v > 0 && <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
      {v > 0.5 && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}

function Range({ v }: { v: number }) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={v}
      onChange={(e) => setVolume(Number(e.target.value))}
      aria-label="Volume"
      aria-valuetext={`${Math.round(v * 100)}%`}
      className="volume h-6 w-28 cursor-pointer"
      style={{ '--v': `${v * 100}%` } as React.CSSProperties}
    />
  );
}

export function VolumeSlider({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const [v, setV] = useState(getVolume);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => onVolume(setV), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  if (compact)
    return (
      <div ref={box} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`Volume ${Math.round(v * 100)}%`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-surface text-muted transition hover:border-muted hover:text-ink active:scale-90"
        >
          <VolumeIcon v={v} className="h-5 w-5" />
        </button>
        {open && (
          <div className="anim-pop absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 rounded-control border border-line bg-surface px-3 py-2 shadow-md">
            <Range v={v} />
          </div>
        )}
      </div>
    );
  return (
    <label className={`flex items-center gap-2 text-muted ${className}`}>
      <VolumeIcon v={v} className="h-4 w-4 shrink-0" />
      <Range v={v} />
    </label>
  );
}
