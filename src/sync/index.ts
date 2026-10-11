/**
 * Supabase connection, sign-in and background sync scheduling.
 * Everything here is optional: without Supabase settings, or signed out,
 * the app simply works locally.
 */
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { resetSyncCursors, syncOnce, type Remote, type RemoteRow } from './engine';
import { SYNC_TABLES, type Row } from './merge';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;
export const syncConfigured = !!(URL_ && KEY);

let clientPromise: Promise<SupabaseClient> | null = null;
export function client(): Promise<SupabaseClient> | null {
  if (!syncConfigured) return null;
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL_!, KEY!, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }),
  );
  return clientPromise;
}

// ---------- status store ----------

export interface SyncStatus {
  session: Session | null;
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSynced?: number;
  error?: string;
}
let status: SyncStatus = { session: null, state: syncConfigured ? 'idle' : 'off' };
const subs = new Set<(s: SyncStatus) => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  subs.forEach((f) => f(status));
}
export function useSyncStatus(): SyncStatus {
  const [s, set] = useState(status);
  useEffect(() => {
    subs.add(set);
    set(status);
    return () => void subs.delete(set);
  }, []);
  return s;
}

// ---------- remote ----------

function supabaseRemote(sb: SupabaseClient, userId: string): Remote {
  return {
    async pull(table, since) {
      const out: RemoteRow[] = [];
      for (let from = 0; ; from += 1000) {
        let q = sb.from(table).select('id,data,updated_at,server_updated_at').order('server_updated_at').range(from, from + 999);
        if (since) q = q.gt('server_updated_at', since);
        const { data, error } = await q;
        if (error) throw error;
        out.push(...(data as RemoteRow[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    async push(table, rows) {
      const { error } = await sb.from(table).upsert(
        rows.map((r) => ({ user_id: userId, id: r.id, data: r.data as Row, updated_at: r.updated_at })),
        { onConflict: 'user_id,id' },
      );
      if (error) throw error;
    },
  };
}

// ---------- scheduling ----------

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export function requestSync(delayMs = 3000): void {
  if (!status.session) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delayMs);
}

export async function syncNow(): Promise<void> {
  const p = client();
  if (!p || !status.session) return;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setStatus({ state: 'syncing', error: undefined });
    try {
      const sb = await p;
      await syncOnce(db, supabaseRemote(sb, status.session!.user.id));
      const now = Date.now();
      await db.meta.put({ key: 'sync:lastSynced', value: now });
      setStatus({ state: 'idle', lastSynced: now });
    } catch (e) {
      console.warn('sync failed', e);
      const msg = navigator.onLine
        ? "Couldn't reach the sync server. If you haven't used the app for a week or more, the free Supabase project may be paused. Open supabase.com, pick the project and press Resume. Your progress is safe on this device."
        : "You're offline. Progress is saved on this device and will sync when you're back online.";
      setStatus({ state: 'error', error: msg });
    } finally {
      running = null;
      if (again) {
        again = false;
        requestSync(500);
      }
    }
  })();
  return running;
}

/** Call once at startup. */
export async function startSync(): Promise<void> {
  const p = client();
  if (!p) return;
  const sb = await p;
  const last = (await db.meta.get('sync:lastSynced'))?.value as number | undefined;
  setStatus({ lastSynced: last });

  const onSession = async (session: Session | null) => {
    const prevUser = (await db.meta.get('sync:user'))?.value;
    if (session && prevUser !== session.user.id) {
      // New account on this device: merge everything both ways.
      await resetSyncCursors(db);
      await db.meta.put({ key: 'sync:user', value: session.user.id });
    }
    setStatus({ session, state: session ? 'idle' : 'idle' });
    if (session) requestSync(200);
  };

  const { data } = await sb.auth.getSession();
  await onSession(data.session);
  sb.auth.onAuthStateChange((_event, session) => {
    if (session?.user.id !== status.session?.user.id) void onSession(session);
    else setStatus({ session });
  });

  // Tidy the sign-in code out of the address bar.
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);

  // Sync after local changes, when coming online, when leaving, and every few minutes.
  let first = true;
  liveQuery(() => Promise.all(SYNC_TABLES.map((t) => db[t].orderBy('updatedAt').last()))).subscribe(() => {
    if (first) first = false;
    else requestSync(5000);
  });
  window.addEventListener('online', () => requestSync(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void syncNow();
    else requestSync(1000);
  });
  setInterval(() => document.visibilityState === 'visible' && requestSync(0), 5 * 60_000);
}

export async function sendSignInEmail(email: string): Promise<string | null> {
  const p = client();
  if (!p) return 'Sync is not set up.';
  const sb = await p;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL, shouldCreateUser: true },
  });
  return error ? error.message : null;
}

export async function verifyCode(email: string, code: string): Promise<string | null> {
  const sb = await client()!;
  const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  const sb = await client()!;
  await syncNow().catch(() => {});
  await sb.auth.signOut();
  await resetSyncCursors(db);
  await db.meta.delete('sync:user');
  setStatus({ session: null, state: 'idle' });
}
