// push.js — taruh di frontend, panggil enablePush() dari tombol "Aktifkan notifikasi"
// Isi 3 nilai ini:
const SUPABASE_URL = 'https://mnkedbgfmflexflfzdnr.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_JWxmpVkosiVuvDYjvxlYdg_XpkgqG0K';
const VAPID_PUBLIC_KEY = 'BKIHQCgWaQW4X-tI2Z3gozkDNUpkcFENfzK84JqJeBL8ShTWBjSKIR6scUCa7jg3RMf62BkYt8T05hPuJTa_PF8';

// Jika aplikasi sudah punya client Supabase, pakai itu dan hapus 2 baris di bawah
// (lalu import client-mu sendiri sebagai `supabase`).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// User diambil otomatis dari sesi login Supabase
export async function enablePush() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { alert('Silakan login dulu.'); return false; }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Browser ini belum mendukung notifikasi. Di iPhone, pasang dulu lewat "Add to Home Screen".');
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { alert('Izin notifikasi ditolak.'); return false; }

  const reg = await navigator.serviceWorker.register('/sw.js');
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
  if (error) { console.error(error); alert('Gagal menyimpan langganan.'); return false; }
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}

/* Contoh pemakaian di aplikasi.html:
<button id="btnNotif">🔔 Aktifkan notifikasi</button>
<script type="module">
  import { enablePush } from './push.js';
  document.getElementById('btnNotif').onclick = async () => {
    const ok = await enablePush();
    if (ok) alert('Notifikasi aktif!');
  };
</script>
*/
