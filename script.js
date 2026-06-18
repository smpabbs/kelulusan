/**
 * ============================================================
 * FILE: script.js
 * DESKRIPSI: Semua logika JavaScript untuk Portal Kelulusan & TKA
 * 
 * FITUR:
 * - Login dengan Supabase Auth
 * - Load data dari Google Apps Script
 * - Render SKN (Surat Keterangan Nilai)
 * - Render SKL (Surat Keterangan Lulus)
 * - Render TKA (Tes Kemampuan Akademik)
 * ============================================================
 */

// ==================== KONFIGURASI ====================
// Konfigurasi Supabase
const SUPABASE_URL = 'https://drlsnhnqxkcgcuskswwx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybHNuaG5xeGtjZ2N1c2tzd3d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNTI5NDMsImV4cCI6MjA4NzgyODk0M30.IbnoYC02FUwMsCbdwb5bPFEjnMvkVc2NGwfrWwR8BQs';

// 🔴 GANTI DENGAN URL APPS SCRIPT ANDA 🔴
const API_URL = "https://script.google.com/macros/s/AKfycbwhK_0LsZzkqIPZuxtYFG63vOq0Oq4uRuUbvWAxSPkMvE_pH30q_gqq1UWlnzddiXsbcw/exec";

// Daftar mata pelajaran untuk SKN (urutan sesuai file Excel)
const daftarMapel = [
    "Pendidikan Agama dan Budi Pekerti",
    "Pendidikan Pancasila / PKn",
    "Bahasa Indonesia",
    "Matematika",
    "Ilmu Pengetahuan Alam",
    "Ilmu Pengetahuan Sosial",
    "Bahasa Inggris",
    "Seni Budaya dan Prakarya",
    "Informatika / TIK",
    "PJOK",
    "Muatan Lokal (Bahasa Jawa)"
];

// Kumpulan kata mutiara untuk TKA (random setiap load)
const quotesList = [
    { arabic: "وَقُل رَّبِّ زِدْنِي عِلْمًا", text: "Dan katakanlah: Wahai Tuhanku, tambahkanlah aku ilmu pengetahuan.", source: "QS. Thaha: 114" },
    { arabic: "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ", text: "Menuntut ilmu adalah kewajiban bagi setiap muslim.", source: "HR. Ibnu Majah" },
    { arabic: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ", text: "Barang siapa menempuh jalan untuk mencari ilmu, niscaya Allah akan memudahkan baginya jalan menuju surga.", source: "HR. Muslim" },
    { arabic: "اُطْلُبِ الْعِلْمَ مِنَ الْمَهْدِ إِلَى اللَّحْدِ", text: "Tuntutlah ilmu dari buaian hingga liang lahat.", source: "HR. Al-Baihaqi" },
    { arabic: "الْعِلْمُ صَيْدٌ وَالْكِتَابَةُ قَيْدُهُ", text: "Ilmu adalah buruan, dan tulisan adalah ikatannya.", source: "Peribahasa Arab" },
    { arabic: "خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ", text: "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya.", source: "HR. Ahmad" }
];

// ==================== GLOBAL VARIABLES ====================
let supabaseClient = null;          // Instance Supabase client
let globalDataSiswa = [];           // Semua data siswa dari spreadsheet
let currentStudent = null;          // Data siswa yang sedang login
let kelasStats = {};                // Statistik per kelas (rata-rata TKA)
let sekolahStats = {};              // Statistik sekolah (rata-rata seluruh siswa)
let kategoriStats = {               // Statistik kategori TKA
    istimewa: 0,
    baik: 0,
    memadai: 0,
    kurang: 0
};
let adminCurrentIdx = -1;           // Index siswa yang sedang aktif di panel admin
let adminNavFiltered = [];          // Daftar siswa setelah filter kelas di navigator
let adminNavPos = 0;                // Posisi saat ini di adminNavFiltered
let siswaAdaTagihan = false;        // true jika siswa masih punya tagihan belum lunas

// Pengaturan tanggal Transkrip Nilai (TN) — dapat diubah dari panel admin
let tnTanggalKelulusan = '2026-06-02';  // Tanggal Kelulusan (default 2 Juni 2026)
let tnTanggalTtd       = '2026-06-15';  // Tanggal tanda tangan / penerbitan (default 15 Juni 2026)

// ==================== DOM ELEMENTS ====================
// Login Section
const loginSection = document.getElementById('loginSection');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const nisInput = document.getElementById('nisInput');
const passwordInput = document.getElementById('passwordInput');
const dataStatusSpan = document.getElementById('dataStatus');

// Dashboard Section
const dashboardSection = document.getElementById('dashboardSection');

// Loading & Error
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const errorToast = document.getElementById('errorToast');
const errorMsgSpan = document.getElementById('errorMsg');

// ==================== COUNTDOWN LOGIN ====================

(function initCountdown() {
    // Target: 2 Juni 2026 pukul 13.00 WIB (UTC+7)
    const TARGET = new Date('2026-06-02T13:00:00+07:00').getTime();

    const panel     = document.getElementById('countdownPanel');
    const form      = document.getElementById('loginForm');
    const elHari    = document.getElementById('cdHari');
    const elJam     = document.getElementById('cdJam');
    const elMenit   = document.getElementById('cdMenit');
    const elDetik   = document.getElementById('cdDetik');

    function pad(n) { return String(n).padStart(2, '0'); }

    function tick() {
        const diff = TARGET - Date.now();
        if (diff <= 0) {
            panel.style.display = 'none';
            form.style.display  = 'block';
            return;
        }
        const totalSec = Math.floor(diff / 1000);
        const hari   = Math.floor(totalSec / 86400);
        const jam    = Math.floor((totalSec % 86400) / 3600);
        const menit  = Math.floor((totalSec % 3600)  / 60);
        const detik  = totalSec % 60;

        elHari.textContent  = pad(hari);
        elJam.textContent   = pad(jam);
        elMenit.textContent = pad(menit);
        elDetik.textContent = pad(detik);
    }

    if (Date.now() >= TARGET) {
        // Sudah lewat — langsung tampilkan form
        panel.style.display = 'none';
        form.style.display  = 'block';
    } else {
        panel.style.display = 'block';
        form.style.display  = 'none';
        tick();
        setInterval(tick, 1000);
    }
})();

// ==================== SECTION VISIBILITY ====================

function showSection(which) {
    document.documentElement.classList.remove('has-session');
    loginSection.style.display     = which === 'login'   ? 'flex'   : 'none';
    dashboardSection.style.display = which === 'student' ? 'block'  : 'none';
    document.getElementById('adminSection').style.display = which === 'admin' ? 'block' : 'none';
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Menampilkan pesan error di toast
 * @param {string} message - Pesan error yang akan ditampilkan
 */
function showError(message) {
    errorMsgSpan.textContent = message;
    errorToast.style.display = 'block';
    setTimeout(() => {
        errorToast.style.display = 'none';
    }, 4000);
}

/**
 * Menampilkan atau menyembunyikan loading overlay
 * @param {boolean} show - true untuk tampilkan, false untuk sembunyikan
 * @param {string} text - Teks yang ditampilkan saat loading
 */
function showLoading(show, text = 'Memuat data...') {
    if (show) {
        loadingText.textContent = text;
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Format tanggal ke format Indonesia (DD Bulan YYYY)
 * @param {string} dateString - String tanggal (YYYY-MM-DD)
 * @returns {string} Tanggal format Indonesia
 */
function formatTanggalIndonesia(dateString) {
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                   'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const parts = String(dateString).split('-');
    if (parts.length === 3) {
        return `${parseInt(parts[2])} ${bulan[parseInt(parts[1]) - 1]} ${parts[0]}`;
    }
    const date = new Date(dateString);
    return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Format nilai untuk ditampilkan di tabel
 * @param {number} val - Nilai angka
 * @returns {string} Nilai format dengan 2 desimal atau tanda bintang jika kosong
 */
function formatNilai(val) {
    if (!val || val <= 0) return '<span class="nilai-kosong">-*</span>';
    return Number(val).toFixed(2).replace('.', ',');
}

/**
 * Mendapatkan kategori berdasarkan nilai TKA
 * @param {number} nilai - Nilai TKA (0-100)
 * @returns {string|null} Kategori: istimewa, baik, memadai, kurang, atau null
 */
function getKategoriData(nilai) {
    if (!nilai || nilai === 0) return null;
    if (nilai >= 85) return "istimewa";
    if (nilai >= 70) return "baik";
    if (nilai >= 50) return "memadai";
    return "kurang";
}

/**
 * Mendapatkan label dan class CSS untuk kategori
 * @param {number} nilai - Nilai TKA
 * @returns {object} { label: string, class: string }
 */
function getKategoriDisplay(nilai) {
    if (!nilai || nilai === 0) {
        return { label: "Tidak terdata", class: "kategori-default" };
    }
    if (nilai >= 85) {
        return { label: "Baik - Istimewa", class: "kategori-istimewa" };
    }
    if (nilai >= 70) {
        return { label: "Baik", class: "kategori-baik" };
    }
    if (nilai >= 50) {
        return { label: "Memadai", class: "kategori-memadai" };
    }
    return { label: "Kurang", class: "kategori-kurang" };
}

/**
 * Memilih kata mutiara secara random untuk TKA
 */
function randomTkaQuotes() {
    const randomIndex = Math.floor(Math.random() * quotesList.length);
    const q = quotesList[randomIndex];
    document.getElementById('tkaQuotesArabic').textContent = q.arabic;
    document.getElementById('tkaQuotesText').textContent = q.text;
    document.getElementById('tkaQuotesSource').textContent = `— ${q.source} —`;
}

// ==================== TAGIHAN ====================

async function cekTagihanSiswa(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('tagihan_spp')
            .select('total, is_lunas_override')
            .eq('siswa_id', userId);
        if (error || !data || data.length === 0) return false;
        return data.some(t => {
            if (t.is_lunas_override === true) return false;
            if (t.is_lunas_override === false) return true;
            return (t.total ?? 0) > 0;
        });
    } catch (e) {
        return false;
    }
}

function renderTagihanBlocked() {
    return `<div style="text-align:center; padding:60px 20px;">
        <div style="font-size:3rem; margin-bottom:16px;">🔒</div>
        <h3 style="color:#c0392b; margin-bottom:12px; font-family:'Plus Jakarta Sans',sans-serif;">Akses Terbatas</h3>
        <p style="color:#555; max-width:420px; margin:0 auto; line-height:1.8; font-family:'Plus Jakarta Sans',sans-serif;">
            Dokumen ini belum dapat diakses karena masih terdapat <strong>tagihan yang belum lunas</strong>.<br><br>
            Silakan hubungi bagian <strong>keuangan sekolah</strong> untuk menyelesaikan pembayaran terlebih dahulu.
        </p>
    </div>`;
}

function updateTabLockState() {
    const dash = document.getElementById('dashboardSection');
    ['skn', 'skl'].forEach(tab => {
        const btn = dash.querySelector(`.tab-btn[data-tab="${tab}"]`);
        if (!btn) return;
        btn.classList.toggle('tab-locked', siswaAdaTagihan);
    });
    const banner = document.getElementById('tagihanWarningBanner');
    if (banner) banner.style.display = siswaAdaTagihan ? 'block' : 'none';
}

// ==================== RENDER FUNCTIONS ====================

/**
 * Render Surat Keterangan Nilai (SKN) - format A4
 * @param {object} student - Data siswa
 * @param {number} nomorUrut - Nomor urut untuk surat
 * @returns {string} HTML string untuk SKN
 */
function renderSKN(student, nomorUrut = 1) {
    if (!student) {
        return "<div class='a4-page' style='text-align:center; padding:50px;'>Data siswa tidak ditemukan</div>";
    }

    const nomorSurat = `400.3.11/SMPABBS-SKN-${String(nomorUrut).padStart(3, '0')}/2026`;
    const tanggalSurat = '2 Juni 2026';

    // Daftar mapel khusus SKN: 7 mapel sesuai format resmi DOCX
    const daftarMapelSKN = [
        { key: "Pendidikan Agama dan Budi Pekerti", label: "Pendidikan Agama dan Budi Pekerti" },
        { key: "Pendidikan Pancasila / PKn",         label: "PPKn/Pendidikan Kewarganegaraan/Pendidikan Pancasila" },
        { key: "Bahasa Indonesia",                   label: "Bahasa Indonesia" },
        { key: "Matematika",                         label: "Matematika" },
        { key: "Ilmu Pengetahuan Alam",              label: "Ilmu Pengetahuan Alam" },
        { key: "Ilmu Pengetahuan Sosial",            label: "Ilmu Pengetahuan Sosial" },
        { key: "Bahasa Inggris",                     label: "Bahasa Inggris" },
    ];

    let tbodyHTML = '';
    let adaNilaiKosong = false;
    let totalPerSemester = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
    let jumlahMapelPerSemester = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };

    daftarMapelSKN.forEach((mp, idx) => {
        let n = student.nilai?.[mp.key] || { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
        let total = 0, pembagi = 0;

        [n.s1, n.s2, n.s3, n.s4, n.s5].forEach(v => {
            if (v > 0) { total += v; pembagi++; }
            else if (v === 0) { adaNilaiKosong = true; }
        });

        ['s1', 's2', 's3', 's4', 's5'].forEach(sem => {
            if (n[sem] > 0) {
                totalPerSemester[sem] += n[sem];
                jumlahMapelPerSemester[sem]++;
            }
        });

        let avg = pembagi > 0 ? (total / pembagi).toFixed(2).replace('.', ',') : '<span class="nilai-kosong">-*</span>';

        tbodyHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td class="text-left">${mp.label}</td>
                <td>${formatNilai(n.s1)}</td>
                <td>${formatNilai(n.s2)}</td>
                <td>${formatNilai(n.s3)}</td>
                <td>${formatNilai(n.s4)}</td>
                <td>${formatNilai(n.s5)}</td>
                <td><strong>${avg}</strong></td>
            </tr>
        `;
    });

    const numS1 = jumlahMapelPerSemester.s1 > 0 ? totalPerSemester.s1 / jumlahMapelPerSemester.s1 : null;
    const numS2 = jumlahMapelPerSemester.s2 > 0 ? totalPerSemester.s2 / jumlahMapelPerSemester.s2 : null;
    const numS3 = jumlahMapelPerSemester.s3 > 0 ? totalPerSemester.s3 / jumlahMapelPerSemester.s3 : null;
    const numS4 = jumlahMapelPerSemester.s4 > 0 ? totalPerSemester.s4 / jumlahMapelPerSemester.s4 : null;
    const numS5 = jumlahMapelPerSemester.s5 > 0 ? totalPerSemester.s5 / jumlahMapelPerSemester.s5 : null;

    const avgS1 = numS1 !== null ? numS1.toFixed(2).replace('.', ',') : '<span class="nilai-kosong">-*</span>';
    const avgS2 = numS2 !== null ? numS2.toFixed(2).replace('.', ',') : '<span class="nilai-kosong">-*</span>';
    const avgS3 = numS3 !== null ? numS3.toFixed(2).replace('.', ',') : '<span class="nilai-kosong">-*</span>';
    const avgS4 = numS4 !== null ? numS4.toFixed(2).replace('.', ',') : '<span class="nilai-kosong">-*</span>';
    const avgS5 = numS5 !== null ? numS5.toFixed(2).replace('.', ',') : '<span class="nilai-kosong">-*</span>';

    const numericAvgs = [numS1, numS2, numS3, numS4, numS5].filter(v => v !== null);
    const avgTotal = numericAvgs.length > 0
        ? (numericAvgs.reduce((a, b) => a + b, 0) / numericAvgs.length).toFixed(2).replace('.', ',')
        : '<span class="nilai-kosong">-*</span>';

    tbodyHTML += `
        <tr style="background:#f5f5f5; font-weight:bold;">
            <td colspan="2" class="text-left">RATA-RATA NILAI PER SEMESTER</td>
            <td><strong>${avgS1}</strong></td>
            <td><strong>${avgS2}</strong></td>
            <td><strong>${avgS3}</strong></td>
            <td><strong>${avgS4}</strong></td>
            <td><strong>${avgS5}</strong></td>
            <td><strong>${avgTotal}</strong></td>
        </tr>
    `;

    let catatanKaki = adaNilaiKosong ? '<p class="catatan-kaki">*) Tanda merah (-*) menunjukkan data nilai belum tersedia atau belum diinput</p>' : '';

    return `
        <div class="a4-page" style="padding: 12mm 15mm;">
            <div class="kop">
                <img src="https://i.ibb.co.com/yFn890yV/logo-smpabbs.png" alt="Logo" crossorigin="anonymous">
                <div class="kop-text">
                    <h3>YAYASAN AL ABIDIN SURAKARTA</h3>
                    <h1>SMP ABBS SURAKARTA</h1>
                    <p>Jl Taruma Negara III, Banyuanyar, Banjarsari, Surakarta</p>
                    <p>Email: smpabbs@alabidin.sch.id | laman: www.smpabbs.alabidin.sch.id</p>
                </div>
            </div>
            <div class="line-bold"></div>
            <div class="title">SURAT KETERANGAN NILAI RAPOR</div>
            <div class="nomor">Nomor : ${nomorSurat}</div>

            <p style="font-size:11pt; margin-bottom:5px;">Yang bertanda tangan di bawah ini :</p>
            <table class="tbl-bio">
                <tr><td width="30%">Nama</td><td>:</td><td><strong>Tri Wijayanti, M.Pd</strong></td></tr>
                <tr><td>Jabatan</td><td>:</td><td>Kepala SMP ABBS Surakarta</td></tr>
                <tr><td>NPSN</td><td>:</td><td>70040216</td></tr>
            </table>

            <p style="font-size:11pt; margin-bottom:5px;">Menerangkan Nilai Rapor</p>
            <table class="tbl-bio">
                <tr><td width="30%">Nama</td><td>:</td><td><strong>${student.nama || '-'}</strong></td></tr>
                <tr><td>Tempat dan tanggal lahir</td><td>:</td><td>${student.ttl || (student.tempatLahir && student.tanggalLahir ? `${student.tempatLahir}, ${student.tanggalLahir}` : '-')}</td></tr>
                <tr><td>Nomor Induk Siswa Nasional</td><td>:</td><td>${student.nisn || '-'}</td></tr>
            </table>

            <table class="tbl-nilai">
                <thead>
                    <tr>
                        <th rowspan="2">NO</th>
                        <th rowspan="2">MATA PELAJARAN</th>
                        <th colspan="5">NILAI RAPOR SEMESTER</th>
                        <th rowspan="2">RATA - RATA<br>NILAI SMT I - V</th>
                    </tr>
                    <tr>
                        <th>I</th><th>II</th><th>III</th><th>IV</th><th>V</th>
                    </tr>
                    <tr>
                        <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th>
                    </tr>
                </thead>
                <tbody>${tbodyHTML}</tbody>
            </table>

            ${catatanKaki}

            <p style="font-size:11pt; margin-top:8px; text-align:justify;">Demikian Surat Keterangan ini dibuat untuk dapat dipergunakan dengan semestinya, dan kepada yang berkepentingan untuk menjadikan maklum.</p>

            <div class="footer">
                <div class="ttd-box">
                    <div>Kota Surakarta, ${tanggalSurat}</div>
                    <div>Kepala Sekolah,</div>
                    <div class="ttd-gap"></div>
                    <div><strong style="text-decoration:underline;">TRI WIJAYANTI, M.Pd</strong></div>
                    <div>NIP. -</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render Surat Keterangan Lulus (SKL) - format A4
 * @param {object} student - Data siswa
 * @param {number} nomorUrut - Nomor urut untuk surat
 * @returns {string} HTML string untuk SKL
 */
function renderSKL(student, nomorUrut = 1) {
    if (!student) {
        return "<div style='text-align:center; padding:40px;'>Data tidak ditemukan</div>";
    }

    const nomorSKL = `400.3.11/SMPABBS-SKL-${String(nomorUrut).padStart(3, '0')}/2026`;
    const tanggalSKL = '2 Juni 2026';            // tanggal penerbitan (tanda tangan)
    const tanggalKeputusanSKL = '29 Mei 2026';   // tanggal Rapat Dewan Guru & SK Kelulusan
    const nomorSKKelulusan = '421.2/330/KS/SMP ABBS/VI/2026';  // nomor SK Penetapan Kelulusan (sama semua siswa)
    let ttlText = student.ttl || (student.tempatLahir && student.tanggalLahir ? `${student.tempatLahir}, ${student.tanggalLahir}` : '-');
    const jenisKelamin = student.jenisKelamin || '-';
    const namaOrtu = student.namaOrtu || '-';

    // Daftar mapel khusus SKL: urutan & nama sesuai format resmi DOCX
    const daftarMapelSKL = [
        { key: "Pendidikan Agama dan Budi Pekerti",  label: "Pendidikan Agama dan Budi Pekerti",          no: 1  },
        { key: "Pendidikan Pancasila / PKn",          label: "Pendidikan Pancasila",                        no: 2  },
        { key: "Bahasa Indonesia",                    label: "Bahasa Indonesia",                            no: 3  },
        { key: "Matematika",                          label: "Matematika",                                  no: 4  },
        { key: "Ilmu Pengetahuan Alam",               label: "Ilmu Pengetahuan Alam",                       no: 5  },
        { key: "Ilmu Pengetahuan Sosial",             label: "Ilmu Pengetahuan Sosial",                     no: 6  },
        { key: "Bahasa Inggris",                      label: "Bahasa Inggris",                              no: 7  },
        { key: "PJOK",                                label: "Pendidikan Jasmani, Olahraga dan Kesehatan",  no: 8  },
        { key: "Informatika / TIK",                   label: "Informatika",                                 no: 9  },
        { key: "Seni Budaya dan Prakarya",            label: "Seni dan Budaya",                             no: 10 },
        { key: "Muatan Lokal (Bahasa Jawa)",          label: "Bahasa Jawa",                                 no: 11 },
    ];

    function hitungRataRataSmt1to5(nilaiMapel) {
        if (!nilaiMapel) return 0;
        let total = 0, count = 0;
        ['s1', 's2', 's3', 's4', 's5'].forEach(sem => {
            if (nilaiMapel[sem] > 0) { total += nilaiMapel[sem]; count++; }
        });
        return count > 0 ? total / count : 0;
    }

    let rowsHTML = '';
    let totalNilaiSKL = 0;
    let jumlahMapelAda = 0;

    daftarMapelSKL.forEach((mp) => {
        const nilaiMapel = student.nilai?.[mp.key] || {};
        const rataSmt1to5 = hitungRataRataSmt1to5(nilaiMapel);
        const nilaiSmt6 = nilaiMapel.s6 || 0;

        let nilaiSKL = 0, nilaiTampil = '-';

        if (rataSmt1to5 > 0 && nilaiSmt6 > 0) {
            nilaiSKL = (rataSmt1to5 * 0.6) + (nilaiSmt6 * 0.4);
        } else if (rataSmt1to5 > 0) {
            nilaiSKL = rataSmt1to5;
        } else if (nilaiSmt6 > 0) {
            nilaiSKL = nilaiSmt6;
        }

        if (nilaiSKL > 0) {
            nilaiTampil = nilaiSKL.toFixed(2).replace('.', ',');
            totalNilaiSKL += nilaiSKL;
            jumlahMapelAda++;
        }

        rowsHTML += `
            <tr>
                <td style="text-align:center; padding:2px 5px; border:1px solid #000;">${mp.no}</td>
                <td style="padding:2px 5px; border:1px solid #000;">${mp.label}</td>
                <td style="text-align:center; padding:2px 5px; border:1px solid #000;">${mp.sub ? '' : nilaiTampil}</td>
            </tr>
        `;
        if (mp.sub) {
            rowsHTML += `
            <tr>
                <td style="border:1px solid #000;"></td>
                <td style="padding:2px 5px 2px 14px; border:1px solid #000;">${mp.sub}</td>
                <td style="text-align:center; padding:2px 5px; border:1px solid #000;">${nilaiTampil}</td>
            </tr>
        `;
        }
    });

    const rataRataSKL = jumlahMapelAda > 0 ? (totalNilaiSKL / jumlahMapelAda).toFixed(2).replace('.', ',') : '-';

    return `
        <div class="skl-page" style="padding:0; margin:0 auto;">
            <div style="margin:20mm; font-family:Arial, sans-serif; font-size:11pt; line-height:1.4;">
                <div style="display:flex; align-items:center; gap:12px; padding-bottom:4px;">
                    <img src="https://i.ibb.co.com/yFn890yV/logo-smpabbs.png" style="width:90px;" crossorigin="anonymous">
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:11pt;">YAYASAN AL ABIDIN SURAKARTA</div>
                        <div style="font-size:16pt; font-weight:bold;">SMP ABBS SURAKARTA</div>
                        <div style="font-size:10pt;">Jl. Taruma Negara III, Banyuanyar, Banjarsari, Surakarta</div>
                        <div style="font-size:10pt;">Email: smpabbs@alabidin.sch.id | laman: www.smpabbs.alabidin.sch.id</div>
                    </div>
                </div>
                <div style="border-top:3px solid #000; border-bottom:1px solid #000; height:3px; margin-bottom:10pt;"></div>

                <div style="text-align:center; margin-bottom:8pt;">
                    <div style="font-size:13pt; font-weight:bold; text-decoration:underline;">SURAT KETERANGAN LULUS</div>
                    <div style="font-size:11pt;">Nomor : ${nomorSKL}</div>
                    <div style="margin:6pt 0;"></div>
                    <div style="font-size:11pt; font-weight:bold;">SEKOLAH MENENGAH PERTAMA</div>
                    <div style="font-size:11pt;">TAHUN AJARAN 2025/2026</div>
                </div>

                <p style="margin:0 0 6pt 0; text-align:justify;">
                    Yang bertanda tangan di bawah ini, Kepala SMP ABBS Surakarta Kecamatan Banjarsari Kota Surakarta, Provinsi Jawa Tengah Nomor Pokok Sekolah Nasional: 70040216 menerangkan bahwa:
                </p>

                <table style="width:100%; border-collapse:collapse; margin:2pt 0 6pt 0;">
                    <tr><td style="width:40%;">Nama Lengkap</td><td style="width:8px;">:</td><td><strong>${student.nama || '-'}</strong></td></tr>
                    <tr><td>Tempat dan Tanggal Lahir</td><td>:</td><td>${ttlText}</td></tr>
                    <tr><td>Jenis Kelamin</td><td>:</td><td>${jenisKelamin}</td></tr>
                    <tr><td>Nama Orang tua/wali</td><td>:</td><td>${namaOrtu}</td></tr>
                    <tr><td>Nomor Induk Siswa Nasional</td><td>:</td><td>${student.nisn || '-'}</td></tr>
                </table>

                <p style="margin:0 0 4pt 0; text-align:justify;">
                    Berdasarkan Hasil Rapat Dewan Guru pada tanggal ${tanggalKeputusanSKL}, dan Surat Keputusan (SK) Kepala Sekolah Nomor : ${nomorSKKelulusan} tanggal ${tanggalKeputusanSKL} tentang Penetapan Kelulusan Tahun Ajaran 2025/2026, dengan ini peserta didik tersebut di atas dinyatakan :
                </p>

                <div style="text-align:center; margin:6pt 0;">
                    <strong style="font-size:15pt;">LULUS</strong>
                </div>

                <p style="margin:0 0 4pt 0; text-align:justify;">
                    Dari Sekolah Menengah Pertama setelah memenuhi seluruh kriteria sesuai dengan peraturan perundang-undangan yang berlaku dengan hasil belajar sebagai berikut:
                </p>

                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#efefef;">
                            <th style="border:1px solid #000; padding:2px 5px;">No.</th>
                            <th style="border:1px solid #000; padding:2px 5px; text-align:left;">Mata Pelajaran</th>
                            <th style="border:1px solid #000; padding:2px 5px;">Nilai</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                        <tr style="font-weight:bold;">
                            <td colspan="2" style="border:1px solid #000; padding:2px 5px; text-align:center;">Rata-rata</td>
                            <td style="border:1px solid #000; padding:2px 5px; text-align:center;">${rataRataSKL}</td>
                        </tr>
                    </tbody>
                </table>

                <p style="margin:8pt 0 0 0; text-align:justify;">
                    Demikian Surat Keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya dan hanya berlaku sampai dengan diterbitkannya Ijazah
                </p>

                <div class="footer">
                    <div class="ttd-box">
                        <div>Kota Surakarta, ${tanggalSKL}</div>
                        <div>Kepala Sekolah,</div>
                        <div class="ttd-gap"></div>
                        <div><strong style="text-decoration:underline;">TRI WIJAYANTI, M.Pd</strong></div>
                        <div>NIP. -</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Cek apakah siswa termasuk kelas 9 (Transkrip Nilai hanya untuk kelas 9)
 * @param {object} student
 * @returns {boolean}
 */
function isKelas9(student) {
    return !!student && /9/.test(String(student.kelas || ''));
}

/**
 * Render Transkrip Nilai (TN) - format A4
 * Format mengikuti master TN.docx; identitas/kop/logo & nama Kepala
 * mengikuti dokumen existing (SKN/SKL). Nilai per mapel memakai rumus SKL.
 * @param {object} student - Data siswa
 * @param {number} nomorUrut - Nomor urut untuk penomoran transkrip
 * @returns {string} HTML string untuk TN
 */
function renderTN(student, nomorUrut = 1) {
    if (!student) {
        return "<div style='text-align:center; padding:40px;'>Data tidak ditemukan</div>";
    }

    // Nomor transkrip diambil dari kolom "Nomor Transkrip" di spreadsheet;
    // bila kosong, jatuh ke nomor otomatis agar tidak pernah blank.
    const nomorTN = (student.nomorTranskrip && String(student.nomorTranskrip).trim())
        ? student.nomorTranskrip
        : `400.3.11/SMPABBS-TN-${String(nomorUrut).padStart(3, '0')}/2026`;
    const tglKelulusan = formatTanggalIndonesia(tnTanggalKelulusan);
    const tglTtd       = formatTanggalIndonesia(tnTanggalTtd);

    let ttlText = student.ttl || (student.tempatLahir && student.tanggalLahir
        ? `${student.tempatLahir}, ${student.tanggalLahir}` : '-');
    const nomorIjazah = student.nomorIjazah && String(student.nomorIjazah).trim()
        ? student.nomorIjazah : '-';

    // Daftar 11 mapel — sama persis dengan SKL
    const daftarMapelTN = [
        { key: "Pendidikan Agama dan Budi Pekerti",  label: "Pendidikan Agama dan Budi Pekerti",            no: 1  },
        { key: "Pendidikan Pancasila / PKn",          label: "Pendidikan Pancasila dan Kewarganegaraan",    no: 2  },
        { key: "Bahasa Indonesia",                    label: "Bahasa Indonesia",                            no: 3  },
        { key: "Matematika",                          label: "Matematika",                                  no: 4  },
        { key: "Ilmu Pengetahuan Alam",               label: "Ilmu Pengetahuan Alam",                       no: 5  },
        { key: "Ilmu Pengetahuan Sosial",             label: "Ilmu Pengetahuan Sosial",                     no: 6  },
        { key: "Bahasa Inggris",                      label: "Bahasa Inggris",                              no: 7  },
        { key: "PJOK",                                label: "Pendidikan Jasmani, Olahraga, dan Kesehatan", no: 8  },
        { key: "Informatika / TIK",                   label: "Informatika",                                 no: 9  },
        { key: "Seni Budaya dan Prakarya",            label: "Seni Budaya dan Prakarya",                    no: 10 },
        { key: "Muatan Lokal (Bahasa Jawa)",          label: "Bahasa Jawa",                                 no: 11 },
    ];

    // Nilai per mapel memakai rumus SKL: (rata Smt1-5 x 0,6) + (Smt6 x 0,4)
    function hitungRataRataSmt1to5(nilaiMapel) {
        if (!nilaiMapel) return 0;
        let total = 0, count = 0;
        ['s1', 's2', 's3', 's4', 's5'].forEach(sem => {
            if (nilaiMapel[sem] > 0) { total += nilaiMapel[sem]; count++; }
        });
        return count > 0 ? total / count : 0;
    }

    let rowsHTML = '';
    let totalNilai = 0;
    let jumlahMapelAda = 0;

    daftarMapelTN.forEach((mp) => {
        const nilaiMapel = student.nilai?.[mp.key] || {};
        const rataSmt1to5 = hitungRataRataSmt1to5(nilaiMapel);
        const nilaiSmt6 = nilaiMapel.s6 || 0;

        let nilai = 0, nilaiTampil = '-';
        if (rataSmt1to5 > 0 && nilaiSmt6 > 0) {
            nilai = (rataSmt1to5 * 0.6) + (nilaiSmt6 * 0.4);
        } else if (rataSmt1to5 > 0) {
            nilai = rataSmt1to5;
        } else if (nilaiSmt6 > 0) {
            nilai = nilaiSmt6;
        }

        if (nilai > 0) {
            nilaiTampil = nilai.toFixed(2).replace('.', ',');
            totalNilai += nilai;
            jumlahMapelAda++;
        }

        rowsHTML += `
            <tr>
                <td style="text-align:center; padding:2px 5px; border:1px solid #000;">${mp.no}</td>
                <td style="padding:2px 5px; border:1px solid #000;">${mp.label}</td>
                <td style="text-align:center; padding:2px 5px; border:1px solid #000;">${nilaiTampil}</td>
            </tr>`;
    });

    const rataRata = jumlahMapelAda > 0
        ? (totalNilai / jumlahMapelAda).toFixed(2).replace('.', ',') : '-';

    return `
        <div class="skl-page" style="padding:0; margin:0 auto;">
            <div style="margin:20mm; font-family:Arial, sans-serif; font-size:11pt; line-height:1.4; color:#000;">
                <div style="display:flex; align-items:center; gap:12px; padding-bottom:4px;">
                    <img src="https://i.ibb.co.com/yFn890yV/logo-smpabbs.png" style="width:90px;" crossorigin="anonymous">
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:11pt;">YAYASAN AL ABIDIN SURAKARTA</div>
                        <div style="font-size:16pt; font-weight:bold;">SMP ABBS SURAKARTA</div>
                        <div style="font-size:10pt;">Jl. Taruma Negara III, Banyuanyar, Banjarsari, Surakarta</div>
                        <div style="font-size:10pt;">Email: smpabbs@alabidin.sch.id | laman: www.smpabbs.alabidin.sch.id</div>
                    </div>
                </div>
                <div style="border-top:3px solid #000; border-bottom:1px solid #000; height:3px; margin-bottom:10pt;"></div>

                <div style="text-align:center; margin-bottom:8pt;">
                    <div style="font-size:13pt; font-weight:bold; text-decoration:underline;">TRANSKRIP NILAI</div>
                    <div style="font-size:11pt;">Nomor : ${nomorTN}</div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin:2pt 0 8pt 0;">
                    <tr><td style="width:40%;">Nama Sekolah</td><td style="width:8px;">:</td><td>SMP ABBS Surakarta</td></tr>
                    <tr><td>Nomor Pokok Sekolah Nasional</td><td>:</td><td>70040216</td></tr>
                    <tr><td>Nama Lengkap</td><td>:</td><td><strong>${student.nama || '-'}</strong></td></tr>
                    <tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>${ttlText}</td></tr>
                    <tr><td>Nomor Induk Siswa Nasional</td><td>:</td><td>${student.nisn || '-'}</td></tr>
                    <tr><td>Nomor Ijazah</td><td>:</td><td>${nomorIjazah}</td></tr>
                    <tr><td>Tanggal Kelulusan</td><td>:</td><td>${tglKelulusan}</td></tr>
                </table>

                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#efefef;">
                            <th style="border:1px solid #000; padding:2px 5px; width:8%;">No.</th>
                            <th style="border:1px solid #000; padding:2px 5px; text-align:left;">Mata Pelajaran</th>
                            <th style="border:1px solid #000; padding:2px 5px; width:20%;">Nilai</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                        <tr style="font-weight:bold;">
                            <td colspan="2" style="border:1px solid #000; padding:2px 5px; text-align:center;">Rata-Rata</td>
                            <td style="border:1px solid #000; padding:2px 5px; text-align:center;">${rataRata}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end; margin-top:14pt;">
                    <div style="width:230px;">
                        <div>Kota Surakarta, ${tglTtd}</div>
                        <div>Kepala Sekolah,</div>
                        <div style="height:34pt;"></div>
                        <div><strong style="text-decoration:underline;">TRI WIJAYANTI, M.Pd</strong></div>
                        <div>NIP. -</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Update tampilan TKA (nilai, perbandingan, distribusi kategori)
 */
/**
 * Update tampilan TKA (nilai, perbandingan, distribusi kategori, header surat)
 */
/**
 * Update tampilan TKA (nilai, perbandingan, distribusi kategori, header surat)
 */
function updateTKA() {
    if (!currentStudent) return;
    const docContent = document.getElementById('tkaDocContent');
    if (docContent) docContent.innerHTML = renderTKADoc(currentStudent, getNomorUrutSiswa(currentStudent));
    randomTkaQuotes();
}

/**
 * Hitung nomor urut siswa berdasarkan urutan kelas 9A→9F lalu nama
 * @param {object} student - Data siswa yang dicari
 * @returns {number} Nomor urut (1-based)
 */
function getNomorUrutSiswa(student) {
    if (!student || !globalDataSiswa.length) return 1;
    const sorted = [...globalDataSiswa].sort((a, b) => {
        const kelasA = String(a.kelas || '').trim().toUpperCase();
        const kelasB = String(b.kelas || '').trim().toUpperCase();
        if (kelasA !== kelasB) return kelasA.localeCompare(kelasB);
        return String(a.nama || '').localeCompare(String(b.nama || ''));
    });
    const idx = sorted.findIndex(s => String(s.nis).trim() === String(student.nis).trim());
    return idx >= 0 ? idx + 1 : 1;
}

/**
 * Update tampilan SKN
 */
function updateSKN() {
    const previewArea = document.getElementById('previewArea');
    if (currentStudent) {
        const nomorUrut = getNomorUrutSiswa(currentStudent);
        previewArea.innerHTML = renderSKN(currentStudent, nomorUrut);
    } else {
        previewArea.innerHTML = "<div class='a4-page' style='padding:50px; text-align:center'>Data tidak ditemukan</div>";
    }
}

/**
 * Update tampilan SKL
 */
function updateSKL() {
    const sklContainer = document.getElementById('sklContent');
    if (currentStudent) {
        sklContainer.innerHTML = renderSKL(currentStudent, getNomorUrutSiswa(currentStudent));
    } else {
        sklContainer.innerHTML = "<div style='text-align:center; padding:40px;'>Data tidak ditemukan</div>";
    }
}

/**
 * Update tampilan Transkrip Nilai (TN) - hanya untuk kelas 9
 */
function updateTN() {
    const tnContainer = document.getElementById('tnContent');
    if (!tnContainer) return;
    if (currentStudent) {
        tnContainer.innerHTML = renderTN(currentStudent, getNomorUrutSiswa(currentStudent));
    } else {
        tnContainer.innerHTML = "<div style='text-align:center; padding:40px;'>Data tidak ditemukan</div>";
    }
}

/**
 * Update dashboard setelah login (semua tab)
 */
/**
 * Update dashboard setelah login (semua tab)
 */
function updateDashboard() {
    if (!currentStudent) return;
    
    console.log("=== updateDashboard() dipanggil ===");
    
    const namaSiswa = currentStudent.nama || 'Siswa';
    const ttlText = currentStudent.ttl || (currentStudent.tempatLahir && currentStudent.tanggalLahir ? `${currentStudent.tempatLahir}, ${currentStudent.tanggalLahir}` : '');
    
    // Update header
    document.getElementById('displayNama').textContent = namaSiswa;
    document.getElementById('biNama').textContent = namaSiswa;
    document.getElementById('biNis').textContent = currentStudent.nis || '-';
    document.getElementById('biNisn').textContent = currentStudent.nisn || '-';
    document.getElementById('biKelas').textContent = currentStudent.kelas || '-';
    document.getElementById('biTtl').textContent = ttlText || '-';
    document.getElementById('headerNama').textContent = namaSiswa;
    document.getElementById('headerInfo').textContent = `NIS: ${currentStudent.nis} | Kelas: ${currentStudent.kelas || '-'}`;
    
    updateTabLockState();

    // Tab Transkrip Nilai hanya tampil untuk siswa kelas 9
    const tnTabBtn = document.getElementById('tabBtnTn');
    if (tnTabBtn) tnTabBtn.style.display = isKelas9(currentStudent) ? '' : 'none';

    // Update semua tab
    updateSKN();
    updateSKL();
    updateTKA();  // ← PASTIKAN INI ADA
    updateTN();

    console.log("=== updateDashboard() selesai ===");
}

// ==================== DATA FETCHING ====================

/**
 * Memuat semua data dari Google Apps Script
 * @returns {Promise<boolean>} true jika berhasil, false jika gagal
 */
async function loadMasterData() {
    try {
        dataStatusSpan.innerHTML = "⏳ Mengunduh data...";
        const response = await fetch(API_URL);
        const result = await response.json();
        
        if (result.status === "success") {
            globalDataSiswa = result.data;
            kelasStats  = result.kelas_stats  || {};
            sekolahStats = result.sekolah_stats || {};

            // Hitung statistik kategori TKA
            kategoriStats = { istimewa: 0, baik: 0, memadai: 0, kurang: 0 };
            globalDataSiswa.forEach(siswa => {
                const kat = getKategoriData(siswa.tka_matematika);
                if (kat) kategoriStats[kat]++;
            });

            // Hitung kelas/sekolah stats secara lokal jika API tidak menyediakannya
            if (!kelasStats || Object.keys(kelasStats).length === 0) {
                const kelasMap = {};
                let tMath = 0, cMath = 0, tBindo = 0, cBindo = 0;
                globalDataSiswa.forEach(s => {
                    const k = s.kelas;
                    if (!k) return;
                    if (!kelasMap[k]) kelasMap[k] = { tMath: 0, cMath: 0, tBindo: 0, cBindo: 0 };
                    if (s.tka_matematika > 0) {
                        tMath += s.tka_matematika; cMath++;
                        kelasMap[k].tMath += s.tka_matematika; kelasMap[k].cMath++;
                    }
                    if (s.tka_bahasa_indonesia > 0) {
                        tBindo += s.tka_bahasa_indonesia; cBindo++;
                        kelasMap[k].tBindo += s.tka_bahasa_indonesia; kelasMap[k].cBindo++;
                    }
                });
                kelasStats = {};
                for (const k in kelasMap) {
                    const km = kelasMap[k];
                    kelasStats[k] = {
                        rata_math:  km.cMath  > 0 ? km.tMath  / km.cMath  : 0,
                        rata_bindo: km.cBindo > 0 ? km.tBindo / km.cBindo : 0
                    };
                }
                sekolahStats = {
                    rata_math:   cMath  > 0 ? tMath  / cMath  : 0,
                    rata_bindo:  cBindo > 0 ? tBindo / cBindo : 0,
                    total_siswa: globalDataSiswa.length
                };
            }

            // Update tampilan distribusi kategori
            const total = kategoriStats.istimewa + kategoriStats.baik + kategoriStats.memadai + kategoriStats.kurang;
            if (total > 0) {
                const persenIstimewa = (kategoriStats.istimewa / total * 100).toFixed(1);
                const persenBaik = (kategoriStats.baik / total * 100).toFixed(1);
                const persenMemadai = (kategoriStats.memadai / total * 100).toFixed(1);
                const persenKurang = (kategoriStats.kurang / total * 100).toFixed(1);
                
                // Update bar dan label
                const barIstimewa = document.getElementById('tkaBarIstimewa');
                if (barIstimewa) {
                    barIstimewa.style.width = persenIstimewa + '%';
                    barIstimewa.textContent = persenIstimewa + '%';
                }
                document.getElementById('tkaCountIstimewa').textContent = kategoriStats.istimewa;
                document.getElementById('tkaPercentIstimewa').textContent = `(${persenIstimewa}%)`;
                
                const barBaik = document.getElementById('tkaBarBaik');
                if (barBaik) {
                    barBaik.style.width = persenBaik + '%';
                    barBaik.textContent = persenBaik + '%';
                }
                document.getElementById('tkaCountBaik').textContent = kategoriStats.baik;
                document.getElementById('tkaPercentBaik').textContent = `(${persenBaik}%)`;
                
                const barMemadai = document.getElementById('tkaBarMemadai');
                if (barMemadai) {
                    barMemadai.style.width = persenMemadai + '%';
                    barMemadai.textContent = persenMemadai + '%';
                }
                document.getElementById('tkaCountMemadai').textContent = kategoriStats.memadai;
                document.getElementById('tkaPercentMemadai').textContent = `(${persenMemadai}%)`;
                
                const barKurang = document.getElementById('tkaBarKurang');
                if (barKurang) {
                    barKurang.style.width = persenKurang + '%';
                    barKurang.textContent = persenKurang + '%';
                }
                document.getElementById('tkaCountKurang').textContent = kategoriStats.kurang;
                document.getElementById('tkaPercentKurang').textContent = `(${persenKurang}%)`;
            }
            
            dataStatusSpan.innerHTML = "✅ Data siap digunakan";
            return true;
        } else {
            throw new Error("Format data tidak dikenali");
        }
    } catch (error) {
        console.error(error);
        dataStatusSpan.innerHTML = "⚠️ Gagal memuat data: " + error.message;
        return false;
    }
}

/**
 * Mencari data siswa berdasarkan NIS
 * @param {string} nis - NIS siswa
 * @returns {object|null} Data siswa atau null jika tidak ditemukan
 */
function cariSiswaByNIS(nis) {
    if (!globalDataSiswa.length) return null;
    const nisStr = String(nis).trim();
    return globalDataSiswa.find(s => String(s.nis).trim() === nisStr);
}

// ==================== LOGIN & LOGOUT ====================

/**
 * Handle login form submission
 */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    
    let nisOrEmail = nisInput.value.trim();
    const password = passwordInput.value;
    
    if (!nisOrEmail || !password) {
        loginError.textContent = 'Masukkan NIS dan password';
        loginError.style.display = 'block';
        return;
    }
    
    // Deteksi apakah input adalah email (admin) atau NIS (siswa)
    const isEmail = nisOrEmail.includes('@');
    let email = isEmail ? nisOrEmail : `nis${nisOrEmail}@siswa.examfilq.dev`;
    let nis = isEmail ? null : nisOrEmail;
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Memproses...';
    showLoading(true, 'Login ke akun...');
    
    // Load data jika belum ada
    if (globalDataSiswa.length === 0) {
        showLoading(true, 'Mengunduh data...');
        const loaded = await loadMasterData();
        if (!loaded) {
            loginError.textContent = 'Gagal memuat data. Hubungi admin.';
            loginError.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Masuk';
            showLoading(false);
            return;
        }
    }
    
    showLoading(true, 'Verifikasi kredensial...');
    
    // Login ke Supabase
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    loginBtn.disabled = false;
    loginBtn.textContent = 'Masuk';
    showLoading(false);
    
    if (error) {
        loginError.textContent = 'NIS atau kata sandi salah.';
        loginError.style.display = 'block';
        return;
    }
    
    // Admin login flow
    if (isEmail) {
        document.getElementById('adminNama').textContent = data.user?.email || nisOrEmail;
        populateKelasDropdowns();
        adminPreSelectSiswa();
        renderAdminTable();
        updateAdminTKA();
        showSection('admin');
        return;
    }

    // Cari data siswa
    const studentData = cariSiswaByNIS(nis);
    if (!studentData) {
        loginError.textContent = `NIS ${nis} berhasil login, tetapi data tidak ditemukan.`;
        loginError.style.display = 'block';
        await supabaseClient.auth.signOut();
        return;
    }

    currentStudent = studentData;
    showLoading(true, 'Memeriksa status tagihan...');
    siswaAdaTagihan = await cekTagihanSiswa(data.user.id);
    showLoading(false);
    updateDashboard();
    showSection('student');
});

/**
 * Handle logout
 */
document.getElementById('logoutBtn').addEventListener('click', async () => {
    showLoading(true, 'Keluar...');
    await supabaseClient.auth.signOut();
    currentStudent = null;
    siswaAdaTagihan = false;
    nisInput.value = '';
    passwordInput.value = '';
    showSection('login');
    showLoading(false);
});

// ==================== TAB NAVIGATION ====================

/**
 * Switch tab aktif
 * @param {string} tabName - Nama tab: 'beranda', 'skn', 'skl', 'tka'
 */
window.switchTab = function(tabName) {
    // Scope HANYA ke dashboard siswa — jangan sentuh tab admin
    const dash = document.getElementById('dashboardSection');
    dash.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    dash.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const tabMap = { beranda: 'tabBeranda', skn: 'tabSkn', skl: 'tabSkl', tka: 'tabTka', tn: 'tabTn' };
    const tabEl = document.getElementById(tabMap[tabName]);
    if (tabEl) tabEl.classList.add('active');

    const btnEl = dash.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btnEl) btnEl.classList.add('active');

    if (['skn', 'skl', 'tn'].includes(tabName) && siswaAdaTagihan) {
        const containerMap = { skn: 'previewArea', skl: 'sklContent', tn: 'tnContent' };
        const el = document.getElementById(containerMap[tabName]);
        if (el) el.innerHTML = renderTagihanBlocked();
        return;
    }

    if (tabName === 'skn') updateSKN();
    else if (tabName === 'skl') updateSKL();
    else if (tabName === 'tka') updateTKA();
    else if (tabName === 'tn') updateTN();
};

// Attach event listeners hanya untuk tab siswa (yang punya data-tab)
document.querySelectorAll('#dashboardSection .tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-tab'));
    });
});

// ==================== ADMIN FUNCTIONS ====================

function populateKelasDropdowns() {
    const kelas = [...new Set(globalDataSiswa.map(s => s.kelas).filter(Boolean))].sort();
    ['adminFilterKelas', 'adminTkaFilterKelas', 'adminSknFilterKelas', 'adminSklFilterKelas', 'adminTnFilterKelas'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">Semua Kelas</option>';
        kelas.forEach(k => {
            const o = document.createElement('option');
            o.value = k; o.textContent = `Kelas ${k}`;
            sel.appendChild(o);
        });
    });
}

// ==================== NAVIGATOR SKN / SKL ====================

function adminNavBuildList(kelas) {
    adminNavFiltered = globalDataSiswa
        .filter(s => s.nama && (!kelas || s.kelas === kelas))
        .sort((a, b) => {
            const ka = String(a.kelas || '').toUpperCase();
            const kb = String(b.kelas || '').toUpperCase();
            if (ka !== kb) return ka.localeCompare(kb);
            return (a.nama || '').localeCompare(b.nama || '', 'id');
        });
}

function adminNavUpdateUI() {
    const total = adminNavFiltered.length;
    const pos   = adminNavPos;
    const s     = adminNavFiltered[pos];
    const nama  = s ? s.nama : '—';
    const info  = total > 0 ? `${nama} (${pos + 1} / ${total})` : '—';
    const count = total > 0 ? `(${total} siswa)` : '';

    ['adminNavInfoSkn', 'adminNavInfoSkl', 'adminNavInfoTka', 'adminNavInfoTn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = info;
    });
    ['adminNavCountSkn', 'adminNavCountSkl', 'adminNavCountTka', 'adminNavCountTn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = count;
    });
    ['adminNavPrevSkn', 'adminNavPrevSkl', 'adminNavPrevTka', 'adminNavPrevTn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = pos <= 0;
    });
    ['adminNavNextSkn', 'adminNavNextSkl', 'adminNavNextTka', 'adminNavNextTn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = pos >= total - 1;
    });
}

function adminNavRender() {
    if (!adminNavFiltered.length) return;
    const s = adminNavFiltered[adminNavPos];
    adminCurrentIdx = globalDataSiswa.indexOf(s);

    const labelSKN  = document.getElementById('adminSknLabel');
    const contentSKN = document.getElementById('adminSknContent');
    if (labelSKN)  labelSKN.textContent  = `${s.nama} — Kelas ${s.kelas}`;
    if (contentSKN) contentSKN.innerHTML = renderSKN(s, getNomorUrutSiswa(s));

    const labelSKL  = document.getElementById('adminSklLabel');
    const contentSKL = document.getElementById('adminSklContent');
    if (labelSKL)  labelSKL.textContent  = `${s.nama} — Kelas ${s.kelas}`;
    if (contentSKL) contentSKL.innerHTML = renderSKL(s, getNomorUrutSiswa(s));

    const labelTKA  = document.getElementById('adminTkaLabel');
    const contentTKA = document.getElementById('adminTkaContent');
    if (labelTKA)  labelTKA.textContent  = `${s.nama} — Kelas ${s.kelas}`;
    if (contentTKA) contentTKA.innerHTML = renderTKADoc(s, getNomorUrutSiswa(s));

    const labelTN  = document.getElementById('adminTnLabel');
    const contentTN = document.getElementById('adminTnContent');
    if (labelTN)  labelTN.textContent  = `${s.nama} — Kelas ${s.kelas}`;
    if (contentTN) contentTN.innerHTML = renderTN(s, getNomorUrutSiswa(s));

    adminNavUpdateUI();
    renderAdminTable();
}

window.adminNavSetKelas = function(kelas) {
    ['adminSknFilterKelas', 'adminSklFilterKelas', 'adminTkaFilterKelas', 'adminTnFilterKelas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = kelas;
    });
    adminNavBuildList(kelas);
    adminNavPos = 0;
    adminNavRender();
};

window.adminNavPrev = function() {
    if (adminNavPos > 0) {
        adminNavPos--;
        adminNavRender();
        window.scrollTo(0, 0);
    }
};

window.adminNavNext = function() {
    if (adminNavPos < adminNavFiltered.length - 1) {
        adminNavPos++;
        adminNavRender();
        window.scrollTo(0, 0);
    }
};

// Auto-pilih siswa pertama: bangun navigator dan render tanpa pindah tab
function adminPreSelectSiswa() {
    if (!globalDataSiswa.length) return;
    adminNavBuildList('');  // semua kelas
    adminNavPos = 0;
    adminNavRender();
}

window.renderAdminTable = function() {
    const kelas = document.getElementById('adminFilterKelas')?.value || '';
    let filtered = globalDataSiswa.filter(s => s.nama);
    if (kelas) filtered = filtered.filter(s => s.kelas === kelas);
    filtered.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));

    const jumlahEl = document.getElementById('adminJumlahSiswa');
    if (jumlahEl) jumlahEl.textContent = `(${filtered.length} siswa)`;

    const tbody = document.getElementById('adminSiswaTbody');
    if (!tbody) return;
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:#8ab5ae;">Tidak ada data.</td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map((s, i) => {
        const idx = globalDataSiswa.indexOf(s);
        const isActive = idx === adminCurrentIdx;
        return `<tr style="${isActive ? 'background:#eef6f2; border-left:3px solid #147A73;' : ''}">
            <td style="color:#9abcb7;">${i + 1}</td>
            <td><code style="font-size:0.82rem; color:#5a8a84;">${s.nis || '-'}</code></td>
            <td style="font-weight:${isActive ? '700' : '500'}; color:${isActive ? '#0D3B36' : 'inherit'};">${s.nama || '-'}</td>
            <td><span style="background:#eef6f2; color:#147A73; padding:2px 9px; border-radius:6px; font-size:0.77rem; font-weight:600;">${s.kelas || '-'}</span></td>
            <td>
                <div class="admin-row-actions">
                    <button class="admin-action-btn btn-skn" onclick="adminViewSKN(${idx})">SKN</button>
                    <button class="admin-action-btn btn-skl" onclick="adminViewSKL(${idx})">SKL</button>
                    <button class="admin-action-btn btn-tka" onclick="adminViewTKA(${idx})">TKA</button>
                    <button class="admin-action-btn btn-tn" onclick="adminViewTN(${idx})">TN</button>
                </div>
            </td>
        </tr>`;
    }).join('');
};

function adminNavSyncToStudent(idx, tabName) {
    // Cari posisi siswa di list navigator yang aktif
    let pos = adminNavFiltered.findIndex(ss => globalDataSiswa.indexOf(ss) === idx);

    if (pos < 0) {
        // Siswa tidak ada di filter saat ini — reset ke semua kelas
        ['adminSknFilterKelas', 'adminSklFilterKelas', 'adminTkaFilterKelas', 'adminTnFilterKelas'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        adminNavBuildList('');
        pos = adminNavFiltered.findIndex(ss => globalDataSiswa.indexOf(ss) === idx);
    }

    if (pos >= 0) adminNavPos = pos;
    adminNavRender();
    const tabBtnIdx = { skn: 1, skl: 2, tka: 3, tn: 4 }[tabName] || 1;
    switchAdminTab(tabName, document.querySelectorAll('#adminTabNav .tab-btn')[tabBtnIdx]);
    window.scrollTo(0, 0);
}

window.adminViewSKN = function(idx) {
    if (!globalDataSiswa[idx]) return;
    adminNavSyncToStudent(idx, 'skn');
};

window.adminViewSKL = function(idx) {
    if (!globalDataSiswa[idx]) return;
    adminNavSyncToStudent(idx, 'skl');
};

window.adminViewTN = function(idx) {
    if (!globalDataSiswa[idx]) return;
    adminNavSyncToStudent(idx, 'tn');
};

window.switchAdminTab = function(tabName, btn) {
    document.querySelectorAll('#adminTabNav .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#adminSection .tab-content').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const map = { daftar: 'adminTabDaftar', skn: 'adminTabSkn', skl: 'adminTabSkl', tka: 'adminTabTka', tn: 'adminTabTn' };
    if (map[tabName]) document.getElementById(map[tabName]).classList.add('active');
};

/**
 * Set tanggal Transkrip Nilai dari panel admin lalu render ulang
 * @param {string} which - 'kelulusan' atau 'ttd'
 * @param {string} value - tanggal format YYYY-MM-DD
 */
window.setTnTanggal = function(which, value) {
    if (!value) return;
    if (which === 'kelulusan') tnTanggalKelulusan = value;
    else if (which === 'ttd')  tnTanggalTtd = value;
    // Render ulang TN yang sedang tampil (admin) & siswa bila ada
    const contentTN = document.getElementById('adminTnContent');
    const s = adminNavFiltered[adminNavPos];
    if (contentTN && s) contentTN.innerHTML = renderTN(s, getNomorUrutSiswa(s));
    if (document.getElementById('tnContent') && currentStudent) updateTN();
};

function updateAdminTKA() {
    let sumMath = 0, cntMath = 0, sumBindo = 0, cntBindo = 0;
    globalDataSiswa.forEach(s => {
        if (s.tka_matematika > 0)      { sumMath  += s.tka_matematika;      cntMath++;  }
        if (s.tka_bahasa_indonesia > 0) { sumBindo += s.tka_bahasa_indonesia; cntBindo++; }
    });

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('adminStatTotalSiswa', globalDataSiswa.length);
    setEl('adminStatRataMath',   cntMath  > 0 ? (sumMath  / cntMath).toFixed(2)  : '—');
    setEl('adminStatRataBindo',  cntBindo > 0 ? (sumBindo / cntBindo).toFixed(2) : '—');

    const total = kategoriStats.istimewa + kategoriStats.baik + kategoriStats.memadai + kategoriStats.kurang;
    if (total > 0) {
        const pi = (kategoriStats.istimewa / total * 100).toFixed(1);
        const pb = (kategoriStats.baik     / total * 100).toFixed(1);
        const pm = (kategoriStats.memadai  / total * 100).toFixed(1);
        const pk = (kategoriStats.kurang   / total * 100).toFixed(1);

        const applyBar = (barId, countId, percentId, persen, count) => {
            const bar = document.getElementById(barId);
            if (bar) { bar.style.width = persen + '%'; bar.textContent = persen + '%'; }
            setEl(countId,   count);
            setEl(percentId, `(${persen}%)`);
        };
        applyBar('adminBarIstimewa', 'adminCountIstimewa', 'adminPercentIstimewa', pi, kategoriStats.istimewa);
        applyBar('adminBarBaik',     'adminCountBaik',     'adminPercentBaik',     pb, kategoriStats.baik);
        applyBar('adminBarMemadai',  'adminCountMemadai',  'adminPercentMemadai',  pm, kategoriStats.memadai);
        applyBar('adminBarKurang',   'adminCountKurang',   'adminPercentKurang',   pk, kategoriStats.kurang);
    }

    renderAdminTkaTable();
}

window.renderAdminTkaTable = function() {
    const kelas = document.getElementById('adminTkaFilterKelas')?.value || '';
    let filtered = globalDataSiswa.filter(s => s.nama);
    if (kelas) filtered = filtered.filter(s => s.kelas === kelas);
    filtered.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));

    const jumlahEl = document.getElementById('adminTkaJumlahSiswa');
    if (jumlahEl) jumlahEl.textContent = `(${filtered.length} siswa)`;

    const tbody = document.getElementById('adminTkaTbody');
    if (!tbody) return;
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#8ab5ae;">Tidak ada data.</td></tr>`;
        return;
    }

    const labelMap  = { istimewa: 'Baik - Istimewa', baik: 'Baik', memadai: 'Memadai', kurang: 'Kurang' };
    const badgeMap  = { istimewa: 'kategori-istimewa', baik: 'kategori-baik', memadai: 'kategori-memadai', kurang: 'kategori-kurang' };
    const getLabel  = kat => labelMap[kat]  || '-';
    const getBadge  = kat => badgeMap[kat]  || 'kategori-default';

    tbody.innerHTML = filtered.map((s, i) => {
        const mKat = getKategoriData(s.tka_matematika);
        const bKat = getKategoriData(s.tka_bahasa_indonesia);
        return `<tr data-nis="${s.nis}">
            <td style="color:#9abcb7;">${i + 1}</td>
            <td><code style="font-size:0.82rem; color:#5a8a84;">${s.nis || '-'}</code></td>
            <td style="font-weight:500;">${s.nama || '-'}</td>
            <td><span style="background:#eef6f2; color:#147A73; padding:2px 9px; border-radius:6px; font-size:0.77rem; font-weight:600;">${s.kelas || '-'}</span></td>
            <td style="text-align:center; font-weight:600;">${s.tka_matematika > 0 ? s.tka_matematika : '-'}</td>
            <td style="text-align:center;"><span class="kategori-badge-small ${getBadge(mKat)}">${getLabel(mKat)}</span></td>
            <td style="text-align:center; font-weight:600;">${s.tka_bahasa_indonesia > 0 ? s.tka_bahasa_indonesia : '-'}</td>
            <td style="text-align:center;"><span class="kategori-badge-small ${getBadge(bKat)}">${getLabel(bKat)}</span></td>
        </tr>`;
    }).join('');
};

window.adminViewTKA = function(idx) {
    if (!globalDataSiswa[idx]) return;
    adminNavSyncToStudent(idx, 'tka');
};

function renderTKADoc(student, nomorUrut = 1) {
    if (!student) return '';

    const mathNilai    = student.tka_matematika       || 0;
    const bindoNilai   = student.tka_bahasa_indonesia || 0;
    const tanggalSurat = '2 Juni 2026';
    // Nomor SHTKA: angka berjalan mulai 144 utk siswa pertama (urutan sama spt SKL/SKN)
    const nomorSHTKA   = `421.2/${143 + nomorUrut}/KS/SMP ABBS/VI/2026`;

    let ttlText = student.ttl || (student.tempatLahir && student.tanggalLahir
        ? `${student.tempatLahir}, ${student.tanggalLahir}` : '-');

    // Nilai ditampilkan apa adanya (koma sebagai pemisah desimal); '-' bila kosong
    const fmtNilai = n => n > 0 ? String(n).replace('.', ',') : '-';

    // Rata-rata dari mapel yang ada nilainya, dibulatkan 2 desimal seperti SKL
    let totalNilai = 0, jumlahMapel = 0;
    if (bindoNilai > 0) { totalNilai += bindoNilai; jumlahMapel++; }
    if (mathNilai  > 0) { totalNilai += mathNilai;  jumlahMapel++; }
    const rataRata = jumlahMapel > 0
        ? (totalNilai / jumlahMapel).toFixed(2).replace('.', ',') : '-';

    return `
        <div class="skl-page" style="padding:0; margin:0 auto;">
            <div style="margin:20mm; font-family:Arial, sans-serif; font-size:11pt; line-height:1.4; color:#000;">
                <div style="display:flex; align-items:center; gap:12px; padding-bottom:4px;">
                    <img src="https://i.ibb.co.com/yFn890yV/logo-smpabbs.png" style="width:90px;" crossorigin="anonymous">
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:11pt;">YAYASAN AL ABIDIN SURAKARTA</div>
                        <div style="font-size:16pt; font-weight:bold;">SMP ABBS SURAKARTA</div>
                        <div style="font-size:10pt;">Jl. Taruma Negara III, Banyuanyar, Banjarsari, Surakarta</div>
                        <div style="font-size:10pt;">Email: smpabbs@alabidin.sch.id | laman: www.smpabbs.alabidin.sch.id</div>
                    </div>
                </div>
                <div style="border-top:3px solid #000; border-bottom:1px solid #000; height:3px; margin-bottom:10pt;"></div>

                <div style="text-align:center; margin-bottom:8pt;">
                    <div style="font-size:13pt; font-weight:bold; text-decoration:underline;">SURAT KETERANGAN HASIL TES KEMAMPUAN AKADEMIK (TKA)</div>
                    <div style="font-size:11pt;">Nomor : ${nomorSHTKA}</div>
                    <div style="margin:6pt 0;"></div>
                    <div style="font-size:11pt; font-weight:bold;">SEKOLAH MENENGAH PERTAMA</div>
                    <div style="font-size:11pt;">TAHUN AJARAN 2025/2026</div>
                </div>

                <p style="margin:0 0 2pt 0;">
                    Yang bertanda tangan di bawah ini, Kepala SMP ABBS Surakarta:
                </p>

                <table style="width:100%; border-collapse:collapse; margin:2pt 0 6pt 0;">
                    <tr><td style="width:40%;">Nomor Pokok Sekolah Nasional</td><td style="width:8px;">:</td><td>70040216</td></tr>
                    <tr><td>Kabupaten</td><td>:</td><td>Surakarta</td></tr>
                    <tr><td>Provinsi</td><td>:</td><td>Jawa Tengah</td></tr>
                </table>

                <p style="margin:0 0 2pt 0;">Dengan ini menyatakan bahwa</p>

                <table style="width:100%; border-collapse:collapse; margin:2pt 0 6pt 0;">
                    <tr><td style="width:40%;">Nama Lengkap</td><td style="width:8px;">:</td><td><strong>${student.nama || '-'}</strong></td></tr>
                    <tr><td>Tempat dan Tanggal Lahir</td><td>:</td><td>${ttlText}</td></tr>
                    <tr><td>Nomor Induk Siswa Nasional</td><td>:</td><td>${student.nisn || '-'}</td></tr>
                </table>

                <p style="margin:0 0 4pt 0; text-align:justify;">
                    Berdasarkan Daftar Kolektif Hasil Tes Kemampuan Akademik (TKA) Tahun 2026, Kementerian Pendidikan Dasar dan Menengah Dinas Pendidikan dan Kebudayaan Kota Surakarta, dengan nilai sebagai berikut :
                </p>

                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#efefef;">
                            <th style="border:1px solid #000; padding:2px 5px; width:8%;">No.</th>
                            <th style="border:1px solid #000; padding:2px 5px; text-align:left;">TES KEMAMPUAN AKADEMIK (TKA)</th>
                            <th style="border:1px solid #000; padding:2px 5px; width:20%;">Nilai</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border:1px solid #000; padding:2px 5px; text-align:center;">1.</td>
                            <td style="border:1px solid #000; padding:2px 5px;">BAHASA INDONESIA</td>
                            <td style="border:1px solid #000; padding:2px 5px; text-align:center;">${fmtNilai(bindoNilai)}</td>
                        </tr>
                        <tr>
                            <td style="border:1px solid #000; padding:2px 5px; text-align:center;">2.</td>
                            <td style="border:1px solid #000; padding:2px 5px;">MATEMATIKA</td>
                            <td style="border:1px solid #000; padding:2px 5px; text-align:center;">${fmtNilai(mathNilai)}</td>
                        </tr>
                        <tr style="font-weight:bold;">
                            <td colspan="2" style="border:1px solid #000; padding:2px 5px; text-align:center;">Rata-rata</td>
                            <td style="border:1px solid #000; padding:2px 5px; text-align:center;">${rataRata}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end; margin-top:12pt;">
                    <div style="width:215px;">
                        <div>Surakarta, ${tanggalSurat}</div>
                        <div>Kepala SMP ABBS Surakarta</div>
                        <div style="height:28pt;"></div>
                        <div><strong><u>Tri Wijayanti, M.Pd</u></strong></div>
                        <div>NIP. -</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.cetakBatchAdmin = function(type) {
    const kelas = document.getElementById('adminFilterKelas')?.value || '';
    let filtered = globalDataSiswa.filter(s => s.nama);
    if (kelas) filtered = filtered.filter(s => s.kelas === kelas);
    if (!filtered.length) { alert('Tidak ada siswa untuk dicetak.'); return; }

    const label = kelas ? `Kelas ${kelas}` : 'Semua Kelas';
    if (!confirm(`Cetak ${type.toUpperCase()} untuk ${filtered.length} siswa (${label})?`)) return;

    const batchEl = document.getElementById('adminPrintBatch');
    batchEl.innerHTML = filtered.map(s => {
        let doc;
        if (type === 'skn')      doc = renderSKN(s, getNomorUrutSiswa(s));
        else if (type === 'skl') doc = renderSKL(s, getNomorUrutSiswa(s));
        else if (type === 'tn')  doc = renderTN(s, getNomorUrutSiswa(s));
        else                     doc = renderTKADoc(s, getNomorUrutSiswa(s));
        return `<div class="batch-page">${doc}</div>`;
    }).join('');

    document.body.setAttribute('data-print-mode', 'admin-batch');
    window.print();
    setTimeout(() => {
        document.body.removeAttribute('data-print-mode');
        batchEl.innerHTML = '';
    }, 4000);
};

// Admin logout
document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    showLoading(true, 'Keluar...');
    await supabaseClient.auth.signOut();
    nisInput.value = '';
    passwordInput.value = '';
    document.getElementById('adminPrintBatch').innerHTML = '';
    showSection('login');
    showLoading(false);
});

// ==================== INITIALIZATION ====================

async function init() {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    await loadMasterData();

    // Cek session yang masih aktif (persist login)
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const email = session.user.email;
        const nisMatch = email.match(/^nis(\d+)@/);
        if (nisMatch) {
            // Session siswa
            const studentData = cariSiswaByNIS(nisMatch[1]);
            if (studentData) {
                currentStudent = studentData;
                siswaAdaTagihan = await cekTagihanSiswa(session.user.id);
                updateDashboard();
                showSection('student');
            } else {
                document.documentElement.classList.remove('has-session');
            }
        } else {
            // Session admin
            document.getElementById('adminNama').textContent = email;
            populateKelasDropdowns();
            adminPreSelectSiswa();
            renderAdminTable();
            updateAdminTKA();
            showSection('admin');
        }
    } else {
        document.documentElement.classList.remove('has-session');
    }
}

// Jalankan inisialisasi
init();