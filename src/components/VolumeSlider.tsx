/** A small volume slider for the audio players; remembered on this device. */
import { useEffect, useState } from 'react';
import { getVolume, onVolume, setVolume } from '../lib/audio';

export function VolumeSlider({ className = '' }: { className?: string }) {
  const [v, setV] = useState(getVolume);
  useEffect(() => onVolume(setV), []);
  return (
    <label className={`flex items-center gap-2 text-muted ${className}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        {v > 0 && <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
        {v > 0.5 && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
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
    </label>
  );
}
