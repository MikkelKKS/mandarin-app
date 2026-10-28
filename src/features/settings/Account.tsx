import { useRef, useState } from 'react';
import { downloadBlob, exportBackup, importBackup } from '../../sync/backup';
import { sendSignInEmail, signOut, syncConfigured, syncNow, useSyncStatus, verifyCode } from '../../sync';

function ago(t?: number): string {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

const btn = 'rounded-xl border border-line px-4 py-2 font-medium';
const primary = 'rounded-xl bg-jade px-4 py-2 font-semibold text-jade-ink disabled:opacity-60';

export function SyncSection() {
  const st = useSyncStatus();
  const [email, setEmail] = useState(() => localStorage.getItem('lastEmail') ?? '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!syncConfigured) {
    return <p className="py-4 text-sm text-muted">Sync between devices isn't switched on in this version yet. Your progress is saved on this device.</p>;
  }

  if (st.session) {
    return (
      <div className="py-4">
        <p>
          Signed in as <span className="font-medium">{st.session.user.email}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {st.state === 'syncing' ? 'Syncing…' : `Last synced ${ago(st.lastSynced)}`}
        </p>
        {st.state === 'error' && <p className="mt-2 rounded-xl bg-amber-soft p-3 text-sm">{st.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={primary} disabled={st.state === 'syncing'} onClick={() => void syncNow()}>
            Sync now
          </button>
          <button className={btn} onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const send = async () => {
    setBusy(true);
    setMsg(null);
    localStorage.setItem('lastEmail', email.trim());
    const err = await sendSignInEmail(email.trim());
    setBusy(false);
    if (err) setMsg(err);
    else setSent(true);
  };
  const verify = async () => {
    setBusy(true);
    const err = await verifyCode(email.trim(), code);
    setBusy(false);
    setMsg(err);
  };

  return (
    <div className="py-4">
      <p className="text-sm text-muted">Sign in to sync your phone and PC. We email you a sign-in link.</p>
      {!sent ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            aria-label="Email address"
            className="flex-1 rounded-xl border border-line bg-surface px-3 py-2"
          />
          <button className={primary} disabled={busy || !email.includes('@')}>
            Email me a link
          </button>
        </form>
      ) : (
        <div className="mt-3">
          <p className="rounded-xl bg-jade-soft p-3 text-sm">
            Check your inbox for <b>{email}</b> and tap the link <b>on this device</b>. It opens the app signed in.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="Or enter the code from the email"
              aria-label="Code from the email"
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2"
            />
            <button className={btn} disabled={busy || code.trim().length < 6}>
              Sign in
            </button>
          </form>
          <button className="mt-2 text-sm text-muted underline" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-cinnabar">{msg}</p>}
    </div>
  );
}

export function BackupSection() {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="py-4">
      <p className="text-sm text-muted">A safety net: save all your progress to a file, or merge a saved file back in (newer progress is never overwritten).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className={btn}
          onClick={async () => downloadBlob(await exportBackup(), `mandarin-backup-${new Date().toISOString().slice(0, 10)}.json`)}
        >
          Export backup
        </button>
        <button className={btn} onClick={() => file.current?.click()}>
          Restore from file
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const n = await importBackup(await f.text());
              setMsg(n ? `Restored ${n} item${n === 1 ? '' : 's'}.` : 'Nothing new in that backup.');
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        />
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}
