// Konfigurasi superadmin.
// File ini TIDAK berisi password, jadi aman di-commit.
// Anon key Supabase memang bersifat publik (terbaca di setiap aplikasi web);
// yang menjaga data tetap aman adalah Row Level Security (RLS) di Supabase.

window.SUPERADMIN_CONFIG = {
  // Project Supabase yang dipakai superadmin (sama dengan aplikasi PuyuhKu).
  // Isi dengan Project URL dan anon (public) key dari Supabase -> Project Settings -> API.
  // JANGAN pernah memasukkan service_role key di sini.
  supabase: {
    url: "https://mnkedbgfmflexflfzdnr.supabase.co",
    anonKey: "sb_publishable_JWxmpVkosiVuvDYjvxlYdg_XpkgqG0K",
  },

  // Daftar aplikasi yang dikelola. Tambah satu objek per aplikasi.
  apps: [
    {
      id: "kasir",
      name: "Aplikasi Kasir",
      description: "Aplikasi kasir (POS) untuk penjualan harian.",
      url: "https://contoh.com/kasir/home.html",
      // URL API aplikasi (kosongkan jika belum punya backend)
      api: "",
    },
    {
      id: "puyuhku",
      name: "Puyuhku",
      description: "Aplikasi bisnis puyuh (Supabase Auth + Postgres).",
      // Isi dengan alamat aplikasi puyuhku kalau sudah online
      url: "https://fendinorhasiqin-star.github.io/bisnispuyuh/aplikasi.html",
      supabase: true,
      // Nilai kolom `coll` di tabel `records` (satu nilai per jenis catatan).
      subcollections: ["expenses", "sales", "incomes", "production", "damaged", "deaths"],
    },
  ],
};
