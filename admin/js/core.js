// Inti superadmin: Supabase, log aktivitas, autentikasi, helper, dan pembungkus service.
// Dimuat setelah js/config.js.

// ===== Supabase =====
const sb = window.supabase.createClient(
  window.SUPERADMIN_CONFIG.supabase.url,
  window.SUPERADMIN_CONFIG.supabase.anonKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

// ============================================================
// Log aktivitas
// ============================================================
// Audit log: catat siapa melakukan apa dan kapan.
// Tahap awal disimpan di localStorage browser. Setelah ada backend,
// kirim ke server agar log tidak bisa dihapus dari browser.

const Log = (() => {
  const KEY = "superadmin_log";
  const MAX = 500;

  function all() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  }

  function add(action, detail) {
    const list = all();
    list.unshift({ time: new Date().toISOString(), action, detail });
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {}
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  return { all, add, clear };
})();

// ============================================================
// Auth
// ============================================================
// Autentikasi superadmin memakai Supabase Auth (email + password).
// Akun dianggap superadmin hanya jika user id-nya ada di tabel `admins`
// (baris itu hanya bisa dibuat lewat SQL Editor Supabase, lihat supabase-setup.sql).

const Auth = (() => {
  let readyPromise = null;
  let current = null;

  async function isAdmin(user) {
    try {
      const { data, error } = await sb
        .from("admins")
        .select("user_id,email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) return false;
      // Simpan email admin ke barisnya supaya daftar akses admin bisa menampilkannya.
      // Gagal menyimpan tidak mengganggu login.
      if (user.email && data.email !== user.email) {
        sb.from("admins").update({ email: user.email }).eq("user_id", user.id).then(() => {}, () => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  function pesan(e) {
    const code = (e && (e.code || e.error_code)) || "";
    const msg = (e && e.message) || "";
    if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) return "Email atau password salah.";
    if (code === "validation_failed" || /valid email|invalid format/i.test(msg)) return "Format email tidak valid.";
    if (code === "email_not_confirmed") return "Email akun ini belum dikonfirmasi di Supabase Auth.";
    if (code === "over_request_rate_limit" || e?.status === 429) return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
    if (code === "user_banned") return "Akun ini dinonaktifkan di Supabase.";
    if (code === "email_provider_disabled") return "Login Email/Password belum diaktifkan di Supabase Authentication.";
    if (/failed to fetch|network/i.test(msg)) return "Tidak ada koneksi internet.";
    if (/invalid api key|apikey/i.test(msg)) return "Anon key Supabase tidak valid. Periksa konfigurasi di config.js.";
    return code ? `Login gagal (kode: ${code}). Coba lagi.` : "Login gagal. Coba lagi.";
  }

  // Menunggu Supabase selesai memeriksa sesi login.
  // Hasil: user superadmin, atau null kalau belum login / bukan admin.
  function ready() {
    if (!readyPromise) {
      readyPromise = (async () => {
        const { data } = await sb.auth.getSession();
        const user = data && data.session ? data.session.user : null;
        if (user && (await isAdmin(user))) {
          current = user;
          return user;
        }
        if (user) await sb.auth.signOut();
        return null;
      })();
    }
    return readyPromise;
  }

  async function login(email, password) {
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!(await isAdmin(data.user))) {
        await sb.auth.signOut();
        Log.add("login_ditolak", `Akun bukan superadmin (${email})`);
        return { ok: false, message: "Akun ini bukan superadmin." };
      }
      current = data.user;
      Log.add("login", `Superadmin masuk (${email})`);
      return { ok: true, user: data.user };
    } catch (e) {
      Log.add("login_gagal", `Percobaan login gagal (${email || "kosong"})`);
      return { ok: false, message: pesan(e) };
    }
  }

  async function logout() {
    Log.add("logout", "Superadmin keluar");
    current = null;
    readyPromise = null;
    await sb.auth.signOut();
  }

  return { login, logout, ready, get currentUser() { return current; } };
})();

// ============================================================
// Helper
// ============================================================
function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

// ============================================================
// Pembungkus dasar untuk bicara ke API sebuah aplikasi.
// Dipakai oleh js/services.js.
// ============================================================
function createService(app) {
  async function request(path, options = {}) {
    if (!app.api) {
      throw new Error(`Aplikasi "${app.name}" belum punya URL API.`);
    }
    const res = await fetch(app.api + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) throw new Error(`Gagal (${res.status}) ke ${app.name}`);
    return res.json();
  }

  return {
    app,
    // Cek apakah aplikasi bisa dijangkau
    async ping() {
      try {
        await fetch(app.url, { mode: "no-cors" });
        return true;
      } catch {
        return false;
      }
    },
    get: (path) => request(path),
    post: (path, body) =>
      request(path, { method: "POST", body: JSON.stringify(body) }),
  };
}
