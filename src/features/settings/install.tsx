/** "Install app" support: captures the browser's install prompt. */
import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import { useLive } from '../../lib/useLive';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function useInstall(): { canInstall: boolean; install: () => Promise<void> } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    canInstall: !!deferred,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      listeners.forEach((l) => l());
    },
  };
}

export function InstallBanner() {
  const { canInstall, install } = useInstall();
  const dismissed = useLive(async () => !!(await db.meta.get('installDismissed'))?.value, [], true);
  if (!canInstall || dismissed || isStandalone()) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl bg-jade-soft p-4">
      <p className="flex-1 text-sm">Install the app for full-screen practice and offline lessons.</p>
      <button onClick={install} className="rounded-xl bg-jade px-3 py-2 text-sm font-semibold text-jade-ink">
        Install
      </button>
      <button onClick={() => db.meta.put({ key: 'installDismissed', value: true })} className="text-sm text-muted" aria-label="Dismiss">
        Not now
      </button>
    </div>
  );
}
