// Pengganti firebase.js: API yang diekspor sama, jadi Aplikasi.html hampir tidak berubah.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mnkedbgfmflexflfzdnr.supabase.co";
const SUPABASE_KEY = "sb_publishable_JWxmpVkosiVuvDYjvxlYdg_XpkgqG0K";

export const configured = !SUPABASE_URL.startsWith("PASTE");
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export const auth = { sb };
export const db = { sb };
export { sb };

const mapUser = u => u ? {
  uid: u.id,
  email: u.email || "",
  displayName: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "",
  metadata: { creationTime: u.created_at }
} : null;

export function onAuthStateChanged(_auth, cb) {
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(mapUser(session && session.user)));
  return () => data.subscription.unsubscribe();
}
export async function signOut() { await sb.auth.signOut(); }

// Referensi gaya Firestore: users/{uid}/{coll} dan users/{uid}/{coll}/{id}
export const collection = (_db, _u, uid, coll) => ({ kind: "col", uid, coll });
export const doc = (_db, _u, uid, coll, id) => ({ kind: "doc", uid, coll, id });

async function fetchAll(uid, coll, id) {
  let q = sb.from("records").select("id,data").eq("user_id", uid).eq("coll", coll);
  if (id) {
    const { data, error } = await q.eq("id", id).limit(1);
    if (error) throw error;
    return data || [];
  }
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await q.order("id").range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

export function onSnapshot(ref, cb, errCb) {
  let timer = null, stopped = false;
  const run = async () => {
    try {
      const rows = await fetchAll(ref.uid, ref.coll, ref.kind === "doc" ? ref.id : null);
      if (stopped) return;
      if (ref.kind === "doc") {
        const r = rows[0];
        cb({ exists: () => !!r, data: () => r ? r.data : undefined, metadata: { fromCache: false } });
      } else {
        cb({ docs: rows.map(r => ({ id: r.id, data: () => r.data })), metadata: { fromCache: false } });
      }
    } catch (e) { if (errCb) errCb(e); }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 150); };
  run();
  const ch = sb.channel("rt-" + ref.coll + "-" + (ref.id || "all") + "-" + Math.random().toString(36).slice(2))
    .on("postgres_changes", { event: "*", schema: "public", table: "records", filter: "user_id=eq." + ref.uid }, p => {
      const row = (p.new && p.new.coll) ? p.new : p.old;
      if (!row || !row.coll || row.coll === ref.coll) schedule();
    })
    .subscribe();
  return () => { stopped = true; clearTimeout(timer); sb.removeChannel(ch); };
}

export function writeBatch() {
  const ops = [];
  const b = {
    set(ref, data) { ops.push({ t: "set", ref, data }); return b; },
    delete(ref) { ops.push({ t: "del", ref }); return b; },
    async commit() {
      const sets = ops.filter(o => o.t === "set").map(o => ({ user_id: o.ref.uid, coll: o.ref.coll, id: String(o.ref.id), data: o.data, updated_at: new Date().toISOString() }));
      if (sets.length) {
        const { error } = await sb.from("records").upsert(sets, { onConflict: "user_id,coll,id" });
        if (error) throw error;
      }
      const dels = {};
      ops.filter(o => o.t === "del").forEach(o => { (dels[o.ref.uid + "|" + o.ref.coll] ||= []).push(String(o.ref.id)); });
      for (const k of Object.keys(dels)) {
        const [uid, coll] = k.split("|");
        const { error } = await sb.from("records").delete().eq("user_id", uid).eq("coll", coll).in("id", dels[k]);
        if (error) throw error;
      }
    }
  };
  return b;
}

// Harga pasar telur puyuh: satu harga + nama daerah untuk semua pengguna. Hanya admin yang boleh mengisi (lihat market-price.sql).
export async function fetchMarketPrice() {
  if (!sb) return null;
  const q = cols => sb.from("market_prices").select(cols).eq("item", "telur_puyuh").order("updated_at", { ascending: false }).limit(1);
  let r = await q("price_per_kg,region,updated_at");
  if (r.error) r = await q("price_per_kg,updated_at"); // jaga-jaga kalau kolom region belum ditambahkan di database
  const { data, error } = r;
  if (error || !data || !data.length) return null;
  return { price: Number(data[0].price_per_kg), region: String(data[0].region || "").trim(), at: data[0].updated_at };
}
