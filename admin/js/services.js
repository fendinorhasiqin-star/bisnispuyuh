// Service aplikasi: cara superadmin "bicara" ke tiap aplikasi.
// Dimuat setelah js/core.js.

window.Services = window.Services || {};

// ===== Aplikasi Kasir =====
// Tambahkan fungsi khusus kasir di sini kalau kasir sudah punya API,
// misalnya: laporan penjualan, daftar produk, daftar user.
(function () {
  const app = window.SUPERADMIN_CONFIG.apps.find((a) => a.id === "kasir");
  if (!app) return;

  const service = createService(app);

  // Contoh (aktifkan setelah kasir punya API):
  // service.laporanHariIni = () => service.get("/laporan/hari-ini");
  // service.daftarProduk   = () => service.get("/produk");

  window.Services.kasir = service;
})();

// ===== Puyuhku (Supabase Postgres) =====
// Semua fungsi di sini HANYA MEMBACA data. Izin baca diatur oleh RLS + fungsi RPC
// di supabase-setup.sql (akun superadmin terdaftar di tabel `admins`).
// Data pengguna ada di satu tabel `records`: user_id, coll (jenis catatan), id, data (jsonb).
(function () {
  const app = window.SUPERADMIN_CONFIG.apps.find((a) => a.id === "puyuhku");
  if (!app) return;

  const service = createService(app);
  const names = app.subcollections || [];

  // Supabase membatasi 1000 baris per permintaan, jadi diambil bertahap.
  async function fetchAll(build, max) {
    const page = 1000;
    let out = [];
    for (let from = 0; from < max; from += page) {
      const to = Math.min(from + page, max) - 1;
      const { data, error } = await build().range(from, to);
      if (error) throw error;
      out = out.concat(data || []);
      if (!data || data.length < page) break;
    }
    return out;
  }

  // Daftar pengguna: akun dari Supabase Auth (selain admin), jumlah catatan per jenis,
  // dan profil peternakan dari records (coll = "meta", id = "settings").
  service.listUsers = async () => {
    const [usersRes, countsRes, metaRows] = await Promise.all([
      sb.rpc("admin_list_users"),
      sb.rpc("admin_record_counts"),
      fetchAll(
        () => sb.from("records").select("user_id,data").eq("coll", "meta").eq("id", "settings").order("user_id"),
        5000
      ),
    ]);
    if (usersRes.error) throw usersRes.error;
    if (countsRes.error) throw countsRes.error;

    const found = {};
    const ensure = (uid) => {
      if (!found[uid]) {
        found[uid] = { id: uid };
        names.forEach((n) => (found[uid][n] = 0));
      }
      return found[uid];
    };

    (usersRes.data || []).forEach((r) => {
      const u = ensure(r.user_id);
      if (r.email) u.email = r.email;
      if (r.created_at) u.createdAt = r.created_at;
    });

    (countsRes.data || []).forEach((r) => {
      if (!names.includes(r.coll)) return;
      ensure(r.user_id)[r.coll] = Number(r.n) || 0;
    });

    metaRows.forEach((r) => {
      const u = found[r.user_id];
      if (!u) return; // akun admin atau akun yang sudah dihapus
      const st = r.data || {};
      if (!u.email && st.ownerEmail) u.email = st.ownerEmail;
      if (!u.createdAt && st.ownerCreatedAt) u.createdAt = st.ownerCreatedAt;
      if (st.farmName) u.farmName = st.farmName;
    });

    return Object.values(found);
  };

  // Isi satu jenis catatan milik satu user, misalnya coll = "expenses" (maksimal 2000)
  service.listSub = async (uid, name, max = 2000) => {
    const rows = await fetchAll(
      () => sb.from("records").select("id,data").eq("user_id", uid).eq("coll", name).order("id"),
      max
    );
    return rows.map((r) => ({ ...(r.data || {}), id: r.id }));
  };

  window.Services.puyuhku = service;
})();
