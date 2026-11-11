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

// ===== Tambahan tampilan Android: mobile.css + menu bawah =====
(function () {
  try {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'mobile.css?v=1';
    document.head.appendChild(css);

    var items = [['#dashboard', '▦', 'Ringkasan'], ['#users', '♙', 'Pengguna'], ['#reports', '▤', 'Laporan'], ['#prices', '◈', 'Harga']];
    var nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Navigasi bawah');
    nav.innerHTML = items.map(function (i) {
      return '<a href="' + i[0] + '"><span>' + i[1] + '</span>' + i[2] + '</a>';
    }).join('');
    document.body.appendChild(nav);

    function mark() {
      var h = (location.hash || '#dashboard').split('/')[0];
      if (h === '#finance') h = '#users';
      nav.querySelectorAll('a').forEach(function (a) {
        a.classList.toggle('on', a.getAttribute('href') === h);
      });
    }
    window.addEventListener('hashchange', mark);
    mark();

    // Sentuh di luar menu samping = menu menutup
    document.addEventListener('click', function (e) {
      var s = document.getElementById('sidebar');
      if (s && s.classList.contains('open') && !e.target.closest('#sidebar') && !e.target.closest('#mobile-menu')) {
        s.classList.remove('open');
      }
    });
  } catch (err) { /* tampilan tetap jalan tanpa tambahan ini */ }
})();
