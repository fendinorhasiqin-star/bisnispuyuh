// Halaman + router + login superadmin.
// Dimuat paling akhir (setelah config, core, services).

// ===== Kerangka: sidebar, router (#dashboard, #apps, #puyuhku, #log, #settings), login =====
const loginView = document.getElementById("login-view");
const dashView = document.getElementById("dashboard-view");

const PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "apps", label: "Aplikasi" },
  { key: "puyuhku", label: "Data Puyuhku" },
  { key: "log", label: "Log Aktivitas" },
  { key: "settings", label: "⚙ Pengaturan" },
  { key: "laporan", label: "Laporan" },
];

function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML =
    "<h1>SUPER ADMIN</h1>" +
    PAGES.filter((p) => p.key !== "puyuhku" && p.key !== "laporan")
      .map((p) => `<a href="#${p.key}" data-page="${p.key}">${p.label}</a>`)
      .join("");
  sidebar.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-page]");
    if (!a) return;
    e.preventDefault();
    const nextHash = "#" + a.dataset.page;
    if (location.hash !== nextHash) {
      try { history.pushState(null, "", nextHash); } catch (err) {}
    }
    go(a.dataset.page);
  });
}

let dashboardAppWarnings = [];
let dashboardAppsChecked = false;
const dataAccessWarnings = new Map();

function setDataAccessWarning(key, error, context) {
  if (!error) {
    dataAccessWarnings.delete(key);
  } else if (["42501", "PGRST301", "PGRST302"].includes(error.code) || error.status === 401 || error.status === 403) {
    dataAccessWarnings.set(key, `Akses ditolak saat ${context}. Periksa akun admin dan kebijakan RLS Supabase.`);
  } else {
    dataAccessWarnings.set(key, `Gagal ${context}. Periksa koneksi dan layanan Supabase.`);
  }
  renderDashboardAlerts();
}

function renderDashboardAlerts() {
  const alertsBox = document.getElementById("dashboard-alerts");
  if (!alertsBox) return;
  if (!dashboardAppsChecked) {
    alertsBox.innerHTML = '<div class="empty">Memeriksa kondisi aplikasi...</div>';
    return;
  }

  const messages = [...dashboardAppWarnings, ...dataAccessWarnings.values()];
  alertsBox.innerHTML = messages.length
    ? '<ul class="alert-list">' + messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("") + "</ul>"
    : '<ul class="alert-list"><li class="ok-alert">Semua aplikasi terkonfigurasi dapat dijangkau. Tidak ada kendala akses data yang tercatat.</li></ul>';
}

// ===== Halaman Dashboard =====
let adminCountCache = null; // jumlah admin, dimuat sekali saja
function initDashboard() {
  const apps = window.SUPERADMIN_CONFIG.apps;
  const shortcuts = document.getElementById("dashboard-shortcuts");
  shortcuts.innerHTML = apps.map((app) => {
    const isPuyuhku = app.id === "puyuhku";
    const href = isPuyuhku ? "#puyuhku" : app.url;
    const icon = isPuyuhku ? "👥" : "🧾";
    const linkAttrs = isPuyuhku
      ? ""
      : app.url
        ? ` target="_blank" rel="noopener" data-dashboard-open="${escapeHtml(app.id)}"`
        : ' aria-disabled="true" tabindex="-1"';
    return `<a class="card dashboard-shortcut" href="${escapeHtml(href || "#")}"${linkAttrs}>
      <span class="shortcut-icon" aria-hidden="true">${icon}</span>
      <span><h3>${escapeHtml(isPuyuhku ? "Data Puyuhku" : app.name)}</h3><p>${escapeHtml(isPuyuhku ? "Lihat data pengguna Puyuhku" : app.description)}</p></span>
      <span class="shortcut-arrow" aria-hidden="true">›</span>
    </a>`;
  }).join("");
  const logs = Log.all();
  document.getElementById("stat-apps").textContent = apps.length;
  document.getElementById("stat-api").textContent = apps.filter((a) => a.api || a.supabase).length;
  document.getElementById("stat-log").textContent = logs.length;

  const adminEl = document.getElementById("stat-admin");
  if (adminCountCache !== null) {
    adminEl.textContent = adminCountCache;
  } else {
    adminEl.textContent = "-";
    sb.from("admins").select("user_id", { count: "exact", head: true })
      .then(({ count, error }) => {
        if (error) throw error;
        adminCountCache = count ?? 0;
        adminEl.textContent = adminCountCache;
        setDataAccessWarning("admins", null);
      })
      .catch((e) => setDataAccessWarning("admins", e, "memuat daftar admin"));
  }

  const box = document.getElementById("recent-log");
  box.innerHTML = !logs.length
    ? '<div class="empty">Belum ada aktivitas.</div>'
    : "<table><tbody>" +
      logs.slice(0, 5).map((l) =>
        `<tr><td>${new Date(l.time).toLocaleString("id-ID")}</td><td>${escapeHtml(l.detail)}</td></tr>`
      ).join("") + "</tbody></table>";

  const statusBox = document.getElementById("dashboard-app-status");
  const alertsBox = document.getElementById("dashboard-alerts");
  statusBox.innerHTML = apps.length
    ? '<div class="card empty">Memeriksa status aplikasi...</div>'
    : '<div class="card empty">Belum ada aplikasi di konfigurasi.</div>';
  alertsBox.innerHTML = '<div class="empty">Memeriksa kondisi aplikasi...</div>';

  Promise.all(apps.map(async (app) => {
    const service = window.Services && window.Services[app.id];
    if (!service) return { app, label: "Belum ada service", ok: false, warning: "Service belum tersedia." };
    if (!app.url) return { app, label: "URL belum diisi", ok: false, warning: "URL aplikasi belum diisi." };
    try {
      const ok = await service.ping();
      return {
        app,
        label: ok ? "Online" : "Tidak terjangkau",
        ok,
        warning: ok ? "" : "Aplikasi tidak terjangkau.",
      };
    } catch {
      return { app, label: "Tidak terjangkau", ok: false, warning: "Pengecekan status gagal." };
    }
  })).then((results) => {
    statusBox.innerHTML = results.length
      ? results.map(({ app, label, ok }) => `
          <div class="card app-status-card">
            <div class="app-status-row">
              <div><h4>${escapeHtml(app.name)}</h4><p>${escapeHtml(app.url || "URL belum diisi")}</p></div>
              <span class="status-label ${ok ? "ok" : "off"}">${escapeHtml(label)}</span>
            </div>
          </div>`).join("")
      : '<div class="card empty">Belum ada aplikasi di konfigurasi.</div>';

    const warnings = results.filter((result) => result.warning);
    dashboardAppWarnings = results.length
      ? warnings.map(({ app, warning }) => `${app.name}: ${warning}`)
      : ["Tidak ada aplikasi yang dikonfigurasi."];
    dashboardAppsChecked = true;
    renderDashboardAlerts();
  });
}

// ===== Halaman Log Aktivitas =====
function initLog() {
  const box = document.getElementById("log-table");
  const logs = Log.all();
  box.innerHTML = !logs.length
    ? '<div class="empty">Belum ada aktivitas.</div>'
    : "<table><thead><tr><th>Waktu</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>" +
      logs.map((l) =>
        `<tr><td>${new Date(l.time).toLocaleString("id-ID")}</td>
         <td>${escapeHtml(l.action)}</td>
         <td>${escapeHtml(l.detail)}</td></tr>`
      ).join("") + "</tbody></table>";
}
document.getElementById("btn-clear").addEventListener("click", () => {
  if (confirm("Hapus semua log aktivitas?")) { Log.clear(); initLog(); }
});

// ===== Halaman Pengaturan =====
async function loadAdminAccess() {
  const box = document.getElementById("admin-access-list");
  box.innerHTML = '<div class="empty">Memuat daftar admin...</div>';
  try {
    const me = Auth.currentUser;
    const adminLabel = (a, me) =>
      a.email || (me && me.id === a.uid && me.email) || a.name || a.nama || `UID: ${a.uid}`;
    const { data: adminRows, error: adminErr } = await sb.from("admins").select("user_id,email");
    if (adminErr) throw adminErr;
    const admins = (adminRows || []).map((r) => ({ email: r.email, uid: r.user_id }));
    box.innerHTML = admins.length
      ? '<table class="access-table"><thead><tr><th>Akun admin</th><th>Status</th></tr></thead><tbody>' +
        admins.map((admin) => `<tr><td>${escapeHtml(adminLabel(admin, me))}</td><td><span class="badge ok" style="margin:0">FULL ACCESS</span></td></tr>`).join("") +
        '</tbody></table>' +
        (admins.some((a) => !a.email)
          ? '<p class="subtitle" style="margin-top:10px">Email admin lain tersimpan otomatis setelah ia login sekali.</p>'
          : "")
      : '<div class="empty">Belum ada admin terdaftar.</div>';
  } catch (e) {
    const message = ["42501", "PGRST301"].includes(e.code)
      ? "Akses baca ditolak. Kebijakan RLS perlu mengizinkan admin membaca tabel admins."
      : "Daftar admin gagal dimuat. Periksa koneksi dan konfigurasi Supabase.";
    box.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
  }
}

document.getElementById("btn-manage-access").addEventListener("click", () => {
  document.getElementById("settings-home").hidden = true;
  document.getElementById("access-panel").hidden = false;
  loadAdminAccess();
});
document.getElementById("btn-access-back").addEventListener("click", () => {
  document.getElementById("access-panel").hidden = true;
  document.getElementById("settings-home").hidden = false;
});
document.getElementById("btn-logout").addEventListener("click", async () => {
  await Auth.logout();
  window.location.href = location.pathname + location.search;
});
document.getElementById("dashboard-shortcuts").addEventListener("click", (e) => {
  const link = e.target.closest("[data-dashboard-open]");
  if (link) Log.add("buka_aplikasi", "Membuka aplikasi: " + link.dataset.dashboardOpen);
});

// ===== Halaman Aplikasi =====
function initApps() {
  const list = document.getElementById("app-list");
  const apps = window.SUPERADMIN_CONFIG.apps;

  list.innerHTML = apps.length
    ? apps
        .map(
          (a) => `
      <div class="card app-card">
        <span class="badge" id="status-${escapeHtml(a.id)}">Mengecek...</span>
        <h3>${escapeHtml(a.name)}</h3>
        <p>${escapeHtml(a.description)}</p>
        <div class="actions">
          ${
            a.url
              ? `<a class="btn" href="${escapeHtml(a.url)}" target="_blank" rel="noopener"
                   data-open="${escapeHtml(a.id)}">Buka</a>`
              : ""
          }
        </div>
      </div>`
        )
        .join("")
    : '<div class="empty">Belum ada aplikasi di config.js.</div>';

  // Cek status tiap aplikasi
  apps.forEach(async (a) => {
    const svc = window.Services && window.Services[a.id];
    const badge = document.getElementById("status-" + a.id);
    if (!svc) {
      badge.textContent = "Belum ada service";
      return;
    }
    if (!a.url) {
      badge.textContent = "URL belum diisi";
      return;
    }
    const up = await svc.ping();
    badge.textContent = up ? "Online" : "Tidak terjangkau";
    badge.className = "badge " + (up ? "ok" : "off");
  });

  // Catat ke log setiap kali aplikasi dibuka
  list.addEventListener("click", (e) => {
    const link = e.target.closest("[data-open]");
    if (link) Log.add("buka_aplikasi", "Membuka aplikasi: " + link.dataset.open);
  });
}

// ===== Halaman Data Puyuhku =====
function initPuyuhku() {
  const svc = window.Services.puyuhku;
  const usersBox = document.getElementById("users-box");
  const detailBox = document.getElementById("detail-box");
  let selectedUid = null;
  const hasSubCacheFor = (uid) => !!subCache[uid];
  let allUsers = [];

  // Field uang per koleksi, sesuai yang disimpan aplikasi.html. Field lain
  // (qty, kg, dll.) ditampilkan sebagai angka biasa, bukan rupiah.
  //   sales    : price = harga per kg, total = qty x price (paid/due dihitung di sini)
  //   expenses : amount        incomes : amount
  const MONEY_FIELDS = {
    sales: ["price", "total", "paid", "due"],
    expenses: ["amount"],
    incomes: ["amount"],
  };
  const HIDDEN_COLS = ["kgEquivalent", "saleId"];
  const rp = (n) => (n < 0 ? "-Rp " : "Rp ") + Math.abs(Math.round(n)).toLocaleString("id-ID");
  const SUBS = svc.app.subcollections || [];

  // ---- Helper ----
  function toDate(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000);
    if (typeof v === "string") {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    }
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }

  function fmt(v) {
    if (v === null || v === undefined) return "-";
    if (typeof v.toDate === "function") return v.toDate().toLocaleString("id-ID");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  // Cari email & tanggal daftar dari berbagai kemungkinan nama field
  function getEmail(u) {
    return u.email || u.Email || u.userEmail || u.mail || "";
  }
  const NO_EMAIL = "(email belum tersimpan)";
  const getFarm = (u) => u.farmName || "";
  function userLabel(uid) {
    const u = allUsers.find((x) => x.id === uid);
    return u ? (getEmail(u) || getFarm(u) || NO_EMAIL) : NO_EMAIL;
  }
  function getJoined(u) {
    const keys = ["createdAt", "created_at", "created", "tanggalDaftar", "tglDaftar",
                  "registeredAt", "dibuat", "joinedAt", "signupAt", "timestamp"];
    for (const k of keys) {
      const d = toDate(u[k]);
      if (d) return d;
    }
    return null;
  }

  // Tabel catatan yang rapi: tanggal & rupiah diformat otomatis
  const DATE_KEYS = ["date", "tanggal", "tgl", "createdAt", "created_at", "timestamp", "waktu"];
  const prettyHead = (c) => c.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  const COL_LABELS = {
    date: "Tanggal", qty: "Jumlah", kg: "Berat (kg)", unit: "Satuan", price: "Harga/kg",
    total: "Total", paid: "Dibayar", due: "Sisa", amount: "Nominal", note: "Keterangan",
    buyer: "Pembeli", category: "Kategori", source: "Sumber", reason: "Alasan",
    period: "Periode", employeeName: "Pekerja", payrollMonth: "Periode gaji", damagedKg: "Rusak (kg)",
  };
  const colLabel = (c) => COL_LABELS[c] || prettyHead(c);

  // Pembayaran penjualan: kalau tidak ada array payments, dianggap lunas saat penjualan.
  const salePays = (x) => (Array.isArray(x.payments) ? x.payments : [{ date: x.date, amount: Number(x.total) || 0 }]);
  const salePaid = (x) => salePays(x).reduce((a, p) => a + (Number(p && p.amount) || 0), 0);
  const moneySum = (rows, field) => rows.reduce((a, r) => a + (Number(r[field]) || 0), 0);

  function cellOf(coll, col, v) {
    if (v === null || v === undefined || v === "") return '<td>-</td>';
    if (Array.isArray(v)) return `<td>${escapeHtml(v.length + " item")}</td>`;
    const d = (typeof v === "object" && (typeof v.toDate === "function" || "seconds" in v)) ? toDate(v) : null;
    if (d) return `<td style="white-space:nowrap">${escapeHtml(d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }))} <span style="color:var(--muted);font-size:12px">${escapeHtml(d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))}</span></td>`;
    if (typeof v === "string" && DATE_KEYS.includes(col) && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return `<td style="white-space:nowrap">${escapeHtml(toDate(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }))}</td>`;
    }
    if (typeof v === "number" && (MONEY_FIELDS[coll] || []).includes(col)) return `<td class="num">${escapeHtml(rp(v))}</td>`;
    if (typeof v === "number") return `<td class="num">${escapeHtml(v.toLocaleString("id-ID"))}</td>`;
    return `<td>${escapeHtml(fmt(v))}</td>`;
  }

  function tableOf(rows, coll) {
    if (coll === "sales") {
      rows = rows.map((r) => { const paid = salePaid(r); return { ...r, paid, due: Math.max(0, (Number(r.total) || 0) - paid) }; });
    }
    const hidden = coll === "sales" ? [...HIDDEN_COLS, "payments"] : HIDDEN_COLS;
    let cols = [];
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (k !== "id" && !hidden.includes(k) && !cols.includes(k)) cols.push(k); }));
    // Sembunyikan kolom yang kosong di semua baris (mis. employeeName, payrollMonth)
    cols = cols.filter((c) => rows.some((r) => r[c] !== null && r[c] !== undefined && r[c] !== ""));
    // Tanggal di kolom pertama
    cols.sort((a, b) => (b === "date" ? 1 : 0) - (a === "date" ? 1 : 0));
    // Urutkan: catatan terbaru di atas (kalau ada kolom tanggal)
    const dk = DATE_KEYS.find((k) => cols.includes(k));
    if (dk) rows = rows.slice().sort((a, b) => (toDate(b[dk])?.getTime() || 0) - (toDate(a[dk])?.getTime() || 0));
    return '<div class="rec-wrap"><table><thead><tr><th>#</th>' +
      cols.map((c) => `<th>${escapeHtml(colLabel(c))}</th>`).join("") +
      "<th>ID</th></tr></thead><tbody>" +
      rows.map((r, i) =>
        `<tr><td style="color:var(--muted)">${i + 1}</td>` +
        cols.map((c) => cellOf(coll, c, r[c])).join("") +
        `<td class="idc">${escapeHtml(r.id)}</td></tr>`
      ).join("") +
      "</tbody></table></div>";
  }

  // ---- Daftar pengguna ----
  function renderUsers() {
    const q = document.getElementById("search").value.trim().toLowerCase();
    const list = allUsers.filter((u) =>
      !q || getEmail(u).toLowerCase().includes(q) || getFarm(u).toLowerCase().includes(q)
    );
    if (!list.length) {
      usersBox.innerHTML = '<div class="empty">' +
        (allUsers.length ? "Tidak ada pengguna yang cocok." : "Belum ada data di subkoleksi puyuhku.") + "</div>";
      return;
    }
    usersBox.innerHTML =
      '<table class="user-table"><thead><tr>' +
      '<th class="num-col">#</th><th>Pengguna</th><th>Tanggal Daftar</th><th></th>' +
      "</tr></thead><tbody>" +
      list.map((u, i) => {
        const email = getEmail(u);
        const d = getJoined(u);
        const initial = (email || getFarm(u) || "?").charAt(0).toUpperCase();
        return `<tr class="${u.id === selectedUid ? "selected" : ""}">
          <td class="num-col">${i + 1}</td>
          <td><div class="user-cell">
            <div class="avatar">${escapeHtml(initial)}</div>
            <div>
              <div class="user-email">${escapeHtml(email || NO_EMAIL)}</div>
              ${getFarm(u) ? `<div class="user-sub">${escapeHtml(getFarm(u))}</div>` : ""}
            </div>
          </div></td>
          <td class="date-cell">${d
            ? escapeHtml(d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })) +
              "<small>" + escapeHtml(d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })) + "</small>"
            : "-"}</td>
          <td class="view-cell"><button class="btn secondary view-btn" data-uid="${escapeHtml(u.id)}">Lihat</button></td>
        </tr>`;
      }).join("") +
      "</tbody></table>";
  }

  async function loadUsers() {
    try {
      allUsers = await svc.listUsers();
      setDataAccessWarning("users", null);
      // Urutkan: yang paling baru daftar di atas
      allUsers.sort((a, b) => (getJoined(b)?.getTime() || 0) - (getJoined(a)?.getTime() || 0));
      document.getElementById("stat-total").textContent = allUsers.length;
      // Pengguna aktif = punya minimal satu catatan (penjualan, pengeluaran, panen, dll.)
      const active = allUsers.filter((u) => SUBS.some((n) => Number(u[n]) > 0)).length;
      document.getElementById("stat-active").textContent = active;
      document.getElementById("stat-active-lbl").textContent = "Pengguna aktif (dari " + allUsers.length + ")";
      renderUsers();
    } catch (e) {
      setDataAccessWarning("users", e, "memuat daftar pengguna Puyuhku");
      usersBox.innerHTML =
        '<div class="empty">Gagal memuat: ' + escapeHtml(e.message) + "</div>";
    }
  }

  // ---- Detail per pengguna (muncul saat pengguna diklik) ----
  const modal = document.getElementById("modal");
  const subCache = {}; // uid -> { namaSub: rows }
  let activeSub = null;
  let reportMonth = "all"; // filter periode di tab Laporan: "all" atau "YYYY-MM"

  // Tab sesuai koleksi di aplikasi.html (key "profit" = Laporan gabungan)
  const TABS = [
    { key: "expense", label: "Pengeluaran", collection: "expenses" },
    { key: "sales", label: "Penjualan", collection: "sales" },
    { key: "incomes", label: "Pemasukan lain", collection: "incomes" },
    { key: "production", label: "Panen", collection: "production" },
    { key: "damaged", label: "Telur pecah", collection: "damaged" },
    { key: "deaths", label: "Puyuh mati/afkir", collection: "deaths" },
  ];
  const REPORT_COLS = ["expenses", "sales", "incomes"].filter((n) => SUBS.includes(n));

  // ---- Periode bulan (tab Laporan) ----
  function rowDate(row) {
    for (const k of DATE_KEYS) {
      const d = toDate(row[k]);
      if (d) return d;
    }
    return null;
  }
  const monthKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }
  function filterByMonth(rows) {
    if (reportMonth === "all") return rows;
    return rows.filter((r) => { const d = rowDate(r); return d && monthKey(d) === reportMonth; });
  }

  // Pemasukan = uang yang benar-benar diterima (sama dengan aplikasi):
  // pembayaran penjualan (per tanggal bayar) + pemasukan lain.
  function receiptsOf(data) {
    const out = [];
    (data.sales ? data.sales.rows : []).forEach((x) =>
      salePays(x).forEach((p) => out.push({ date: p && p.date, amount: Number(p && p.amount) || 0 })));
    (data.incomes ? data.incomes.rows : []).forEach((x) => out.push({ date: x.date, amount: Number(x.amount) || 0 }));
    return out;
  }

  // ---- Halaman Laporan (halaman sendiri, #laporan) ----
  let reportUid = null;
  function renderReportPage() {
    const uid = reportUid;
    if (!uid) return false;
    const who = document.getElementById("report-who");
    const box = document.getElementById("report-box");
    const u = allUsers.find((x) => x.id === uid) || { id: uid };
    const email = getEmail(u), farm = getFarm(u), joined = getJoined(u);
    who.innerHTML = `<div class="avatar">${escapeHtml((email || farm || "?").charAt(0).toUpperCase())}</div>
      <div class="who-info"><div class="user-email">${escapeHtml(email || NO_EMAIL)}</div>
      <div class="meta">${escapeHtml([farm, joined ? "Daftar " + joined.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""].filter(Boolean).join(" • "))}</div></div>`;

    const data = subCache[uid] || {};
    if (REPORT_COLS.some((n) => !data[n])) { box.innerHTML = '<div class="empty">Memuat laporan...</div>'; return true; }
    if (REPORT_COLS.some((n) => data[n].error)) {
      box.innerHTML = '<div class="empty">Gagal memuat data penjualan, pemasukan, atau pengeluaran.</div>';
      return true;
    }
    const receipts = receiptsOf(data);
    const expenses = data.expenses ? data.expenses.rows : [];
    const allDated = [...receipts, ...expenses];
    const months = [...new Set(allDated.map(rowDate).filter(Boolean).map(monthKey))].sort().reverse();
    if (reportMonth !== "all" && !months.includes(reportMonth)) reportMonth = "all";
    const inRows = filterByMonth(receipts);
    const exRows = filterByMonth(expenses);
    const incomeTotal = moneySum(inRows, "amount");
    const expenseTotal = moneySum(exRows, "amount");
    const net = incomeTotal - expenseTotal;
    const receivable = (data.sales ? data.sales.rows : []).reduce((a, x) => a + Math.max(0, (Number(x.total) || 0) - salePaid(x)), 0);
    const undated = allDated.filter((r) => !rowDate(r)).length;
    const periodText = reportMonth === "all" ? "semua periode" : monthLabel(reportMonth);
    const inMonth = (rows, m) => rows.filter((r) => { const d = rowDate(r); return d && monthKey(d) === m; });

    box.innerHTML = `<div class="report-controls">
        <label for="report-month">Periode</label>
        <select id="report-month">
          <option value="all"${reportMonth === "all" ? " selected" : ""}>Semua periode</option>
          ${months.map((m) => `<option value="${escapeHtml(m)}"${m === reportMonth ? " selected" : ""}>${escapeHtml(monthLabel(m))}</option>`).join("")}
        </select>
        <p class="who">Menampilkan <b>${escapeHtml(periodText)}</b>: ${inRows.length} penerimaan, ${exRows.length} pengeluaran.${reportMonth !== "all" && undated ? ` ${undated} catatan tanpa tanggal tidak dihitung.` : ""}</p>
      </div>
      <div class="report-summary">
        <div class="card net"><div class="lbl">Laba bersih</div><div class="amount">${escapeHtml(rp(net))}</div></div>
        <div class="card income"><div class="lbl">Total pemasukan</div><div class="amount">${escapeHtml(rp(incomeTotal))}</div></div>
        <div class="card expense"><div class="lbl">Total pengeluaran</div><div class="amount">${escapeHtml(rp(expenseTotal))}</div></div>
        <div class="card recv"><div class="lbl">Piutang (semua waktu)</div><div class="amount">${escapeHtml(rp(receivable))}</div></div>
      </div>
      <p class="who report-note">Perhitungan sama dengan aplikasi: pemasukan = pembayaran yang sudah diterima + pemasukan lain; laba = pemasukan dikurangi pengeluaran. Piutang belum dihitung sebagai pemasukan.</p>
      ${months.length ? `<div class="section-title"><h3>Rincian per bulan</h3></div>
      <div class="month-list">${months.map((m) => {
        const i = moneySum(inMonth(receipts, m), "amount"), e = moneySum(inMonth(expenses, m), "amount"), n = i - e;
        return `<button type="button" class="card month-card${m === reportMonth ? " active" : ""}" data-month="${escapeHtml(m)}">
          <span class="month-name">${escapeHtml(monthLabel(m))}</span>
          <span class="month-net${n < 0 ? " neg" : ""}">${escapeHtml(rp(n))}</span>
          <span class="month-sub"><span>Masuk <b>${escapeHtml(rp(i))}</b></span><span>Keluar <b>${escapeHtml(rp(e))}</b></span></span>
        </button>`;
      }).join("")}</div>` : ""}`;
    return true;
  }

  function openReportPage(uid) {
    reportUid = uid;
    reportMonth = "all";
    modal.hidden = true;
    document.body.style.overflow = "";
    selectedUid = null;
    renderUsers();
    Log.add("lihat_laporan", `Membuka laporan ${userLabel(uid)}`);
    location.hash = "#laporan"; // pindah halaman; go() dipanggil oleh hashchange
  }

  function renderTabs(uid) {
    const data = subCache[uid] || {};
    const buttons = TABS.filter((t) => !t.collection || SUBS.includes(t.collection)).map((tab) => {
      let count = "";
      if (tab.key === "profit") {
        count = REPORT_COLS.reduce((n, c) => n + (data[c] && !data[c].error ? data[c].rows.length : 0), 0);
      } else {
        const item = data[tab.collection];
        if (item) count = item.error ? "!" : item.rows.length;
      }
      const badge = count === "" ? "" : `<span class="cnt">${count}</span>`;
      return `<button class="tab ${tab.key === activeSub ? "active" : ""}" data-sub="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}${badge}</button>`;
    });
    document.getElementById("tabs").innerHTML = buttons.join("");
  }

  function renderRecords(uid) {
    const box = document.getElementById("detail-box");
    const data = subCache[uid] || {};
    if (activeSub === "profit") { box.innerHTML = '<div class="empty">Membuka halaman laporan...</div>'; return; }

    const tab = TABS.find((item) => item.key === activeSub);
    const collection = tab ? tab.collection : activeSub;
    const item = data[collection];
    if (!item) { box.innerHTML = '<div class="empty">Memuat...</div>'; return; }
    if (item.error) { box.innerHTML = '<div class="empty">Gagal memuat: ' + escapeHtml(item.error) + "</div>"; return; }
    box.innerHTML = item.rows.length
      ? tableOf(item.rows, collection)
      : '<div class="empty">Belum ada catatan di ' + escapeHtml(tab ? tab.label : activeSub) + ".</div>";
  }

  // Memuat satu subkoleksi milik pengguna (sekali saja, lalu disimpan di subCache)
  const pendingSub = new Set();
  async function ensureSub(uid, n) {
    if (!SUBS.includes(n)) return;
    if (!subCache[uid]) subCache[uid] = {};
    const key = uid + ":" + n;
    if (subCache[uid][n] || pendingSub.has(key)) return;
    pendingSub.add(key);
    const warningKey = `detail:${uid}:${n}`;
    try {
      subCache[uid][n] = { rows: await svc.listSub(uid, n) };
      setDataAccessWarning(warningKey, null);
    } catch (e) {
      subCache[uid][n] = { rows: [], error: e.message };
      setDataAccessWarning(warningKey, e, `memuat ${n} untuk ${userLabel(uid)}`);
    }
    pendingSub.delete(key);
    if (uid === selectedUid) { renderTabs(uid); renderRecords(uid); }
    const rp_ = document.querySelector('[data-page="laporan"]');
    if (uid === reportUid && rp_ && !rp_.hidden) renderReportPage();
  }

  async function openUser(uid, silent) {
    selectedUid = uid;
    const u = allUsers.find((x) => x.id === uid) || { id: uid };
    const d = getJoined(u);
    document.getElementById("m-avatar").textContent = (getEmail(u) || getFarm(u) || "?").charAt(0).toUpperCase();
    document.getElementById("m-email").textContent = getEmail(u) || NO_EMAIL;
    document.getElementById("m-meta").textContent = [
      getFarm(u),
      d ? "Daftar " + d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "",
    ].filter(Boolean).join(" • ");
    activeSub = "expense";
    reportMonth = "all";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    renderUsers();
    renderTabs(uid);
    renderRecords(uid);
    if (!silent) Log.add("lihat_data", `Melihat data ${userLabel(uid)}`);

    if (!hasSubCacheFor(uid)) subCache[uid] = {};
    // Koleksi keuangan dimuat dulu; panen, telur pecah, dan puyuh mati dimuat saat tabnya dibuka.
    await Promise.all(REPORT_COLS.map((n) => ensureSub(uid, n)));
  }

  function closeUser() {
    modal.hidden = true;
    document.body.style.overflow = "";
    selectedUid = null;
    renderUsers();
  }

  usersBox.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-uid]");
    if (btn) openUser(btn.dataset.uid);
  });
  document.getElementById("tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-sub]");
    if (!t || !selectedUid) return;
    activeSub = t.dataset.sub;
    renderTabs(selectedUid);
    renderRecords(selectedUid);
    const tab = TABS.find((x) => x.key === activeSub);
    if (tab && tab.collection) ensureSub(selectedUid, tab.collection);
  });
  const reportBox = document.getElementById("report-box");
  reportBox.addEventListener("change", (e) => {
    if (e.target.id === "report-month") { reportMonth = e.target.value; renderReportPage(); }
  });
  reportBox.addEventListener("click", (e) => {
    const c = e.target.closest("[data-month]");
    if (!c) return;
    reportMonth = reportMonth === c.dataset.month ? "all" : c.dataset.month;
    renderReportPage();
  });
  document.getElementById("report-back").addEventListener("click", () => {
    const uid = reportUid;
    location.hash = "#puyuhku";
    if (uid) openUser(uid, true);
  });
  document.getElementById("m-report").addEventListener("click", () => { if (selectedUid) openReportPage(selectedUid); });
  reportPageRender = renderReportPage;
  document.getElementById("m-close").addEventListener("click", closeUser);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeUser(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeUser(); });
  document.getElementById("search").addEventListener("input", renderUsers);

  loadUsers();
}

// ===== Router =====
const once = (fn) => { let done = false; return () => { if (!done) { done = true; fn(); } }; };
let reportPageRender = null; // diisi oleh initPuyuhku
const pageInit = {
  dashboard: initDashboard, apps: once(initApps), puyuhku: once(initPuyuhku), log: initLog, settings: () => {},
  laporan: () => {
    if (reportPageRender && reportPageRender()) return;
    try { history.replaceState(null, "", "#puyuhku"); } catch (err) {}
    go("puyuhku"); // dibuka langsung tanpa memilih pengguna -> kembali ke daftar
  },
};

function go(page) {
  const h = page || location.hash.slice(1);
  const key = PAGES.some((p) => p.key === h) ? h : "dashboard";
  document.querySelectorAll("section[data-page]").forEach((s) => (s.hidden = s.dataset.page !== key));
  document.querySelectorAll(".sidebar a[data-page]").forEach((a) => a.classList.toggle("active", a.dataset.page === key));
  pageInit[key]();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => { if (!dashView.hidden) go(); });

function showApp(user) {
  loginView.hidden = true;
  dashView.hidden = false;
  renderSidebar();
  go();
}

// ===== Login =====
Auth.ready().then((user) => {
  if (user) showApp(user);
  else loginView.hidden = false;
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("login-btn");
  const err = document.getElementById("login-error");
  err.textContent = "";
  btn.disabled = true;
  btn.textContent = "Memeriksa...";
  const res = await Auth.login(
    document.getElementById("email").value.trim(),
    document.getElementById("password").value
  );
  btn.disabled = false;
  btn.textContent = "Masuk";
  if (res.ok) showApp(res.user);
  else err.textContent = res.message;
});
