// push.js — logika notifikasi push PuyuhKu (tanpa alert browser; semua pesan ditampilkan di dalam aplikasi)
const SUPABASE_URL = 'https://mnkedbgfmflexflfzdnr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JWxmpVkosiVuvDYjvxlYdg_XpkgqG0K';
const VAPID_PUBLIC_KEY = 'BKIHQCgWaQW4X-tI2Z3gozkDNUpkcFENfzK84JqJeBL8ShTWBjSKIR6scUCa7jg3RMf62BkYt8T05hPuJTa_PF8';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Status: 'unsupported' | 'denied' | 'default' | 'granted' (izin ada, belum terdaftar) | 'active'
export async function getPushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'default';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    return sub ? 'active' : 'granted';
  } catch (_) { return 'granted'; }
}

// Mengembalikan { ok: true } atau { ok: false, reason: 'unsupported'|'denied'|'dismissed'|'login'|'save'|'error' }
// silent = true: jangan munculkan popup izin (dipakai untuk mendaftar ulang otomatis)
export async function enablePush({ silent = false } = {}) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  if (Notification.permission !== 'granted') {
    if (silent) return { ok: false, reason: 'dismissed' };
    const perm = await Notification.requestPermission();
    if (perm === 'denied') return { ok: false, reason: 'denied' };
    if (perm !== 'granted') return { ok: false, reason: 'dismissed' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const user = session && session.user;
  if (!user) return { ok: false, reason: 'login' };

  try {
    const reg = (await navigator.serviceWorker.getRegistration()) ||
                (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const json = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint: json.endpoint, subscription: json },
      { onConflict: 'endpoint' }
    );
    if (error) { console.error(error); return { ok: false, reason: 'save' }; }
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: 'error' };
  }
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
