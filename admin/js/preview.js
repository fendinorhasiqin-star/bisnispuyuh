// Data contoh HANYA untuk mode preview.
// Tidak dimuat oleh index.html. Untuk mencoba mode preview, tambahkan
// <script src="js/preview.js"></script> setelah js/services.js (dan ganti Firebase dengan tiruan).
// [PREVIEW MODE] Data demo untuk halaman Data Puyuhku + status aplikasi.
// Memakai data contoh (bukan data asli). Blok ini dihapus saat mode preview dimatikan.
(function () {
  var puyuhku = window.Services && window.Services.puyuhku;
  var kasir = window.Services && window.Services.kasir;

  // Status aplikasi: satu "Online", satu "Tidak terjangkau" supaya kedua tampilan bisa dilihat
  if (kasir) kasir.ping = function () { return Promise.resolve(false); };
  if (puyuhku) puyuhku.ping = function () { return Promise.resolve(true); };
  if (!puyuhku) return;

  function rng(seed) {
    var s = seed;
    return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function range(r, a, b) { return Math.round(a + r() * (b - a)); }
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dateAt(r, from) {
    var start = new Date(from).getTime(), end = new Date("2026-11-03").getTime();
    return iso(new Date(start + r() * (end - start)));
  }

  function build(seed, from) {
    var r = rng(seed), db = { expenses: [], sales: [], incomes: [], production: [], damaged: [], deaths: [] };
    var cats = ["Pakan", "Obat & vitamin", "Listrik", "Gaji pekerja", "Perawatan kandang", "Transportasi"];
    var buyers = ["Toko Sumber Jaya", "Bu Ani", "Warung Pak Haji", "Pasar Induk", "Resto Nusantara", "Pak Dodi"];
    var i;
    for (i = 0; i < 24; i++) {
      var c = pick(r, cats);
      db.expenses.push({ id: "exp" + (1000 + i), date: dateAt(r, from), category: c, amount: range(r, 40, 900) * 1000, note: c === "Pakan" ? "Beli pakan " + range(r, 1, 8) + " sak" : "" });
    }
    for (i = 0; i < 18; i++) {
      var kg = range(r, 10, 120), price = range(r, 24, 29) * 1000, total = kg * price, d = dateAt(r, from);
      var paidFull = r() > 0.35, paid = paidFull ? total : Math.round(total * (0.3 + r() * 0.4) / 1000) * 1000;
      db.sales.push({ id: "sal" + (2000 + i), date: d, buyer: pick(r, buyers), qty: kg * 16, kg: kg, unit: "butir", price: price, total: total, payments: [{ date: d, amount: paid }] });
    }
    for (i = 0; i < 5; i++) db.incomes.push({ id: "inc" + (3000 + i), date: dateAt(r, from), amount: range(r, 50, 500) * 1000, source: pick(r, ["Jual kotoran", "Jual puyuh afkir", "Sewa kandang"]) });
    for (i = 0; i < 30; i++) db.production.push({ id: "prd" + (4000 + i), date: dateAt(r, from), qty: range(r, 300, 900), kg: range(r, 5, 14) });
    for (i = 0; i < 6; i++) db.damaged.push({ id: "dmg" + (5000 + i), date: dateAt(r, from), qty: range(r, 2, 25), reason: pick(r, ["Pecah saat panen", "Retak", "Jatuh"]) });
    for (i = 0; i < 6; i++) db.deaths.push({ id: "dth" + (6000 + i), date: dateAt(r, from), qty: range(r, 1, 12), reason: pick(r, ["Sakit", "Afkir", "Stres panas"]) });
    return db;
  }

  var USERS = [
    { id: "uid-demo-budi", email: "budi@contoh.id", farmName: "Peternakan Sumber Rejeki", createdAt: "2026-08-12T09:15:00", seed: 11, from: "2026-08-15" },
    { id: "uid-demo-siti", email: "siti@contoh.id", farmName: "Puyuh Makmur Jaya", createdAt: "2026-09-03T14:40:00", seed: 23, from: "2026-09-05" },
    { id: "uid-demo-andi", email: "andi@contoh.id", farmName: "Kandang Berkah", createdAt: "2026-10-21T19:05:00", seed: 37, from: "2026-10-22" },
    { id: "uid-demo-baru", farmName: "", createdAt: "2026-11-02T07:30:00", seed: 51, from: "2026-11-02" },
  ];
  var DATA = {};
  USERS.forEach(function (u) { DATA[u.id] = build(u.seed, u.from); });
  // Pengguna baru yang belum mengisi data apa pun (untuk melihat kartu Pengguna aktif)
  DATA["uid-demo-baru"] = { expenses: [], sales: [], incomes: [], production: [], damaged: [], deaths: [] };

  puyuhku.listUsers = function () {
    return Promise.resolve(USERS.map(function (u) {
      var o = { id: u.id, createdAt: u.createdAt };
      if (u.email) o.email = u.email;
      if (u.farmName) o.farmName = u.farmName;
      Object.keys(DATA[u.id]).forEach(function (k) { o[k] = DATA[u.id][k].length; });
      return o;
    }));
  };
  puyuhku.listSub = function (uid, name) {
    var rows = (DATA[uid] && DATA[uid][name]) || [];
    return new Promise(function (res) { setTimeout(function () { res(rows.map(function (x) { return Object.assign({}, x); })); }, 150); });
  };
})();
