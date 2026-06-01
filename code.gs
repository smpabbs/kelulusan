/**
 * Google Apps Script untuk Portal Kelulusan + TKA
 * Membaca data dari spreadsheet:
 * - NIS, NISN, Nama, TTL
 * - Nilai rapor per semester (untuk SKN)
 * - Rata-rata semester (untuk SKL)
 * - Nilai TKA (Tes Kemampuan Akademik)
 * 
 * Cara Deployment:
 * 1. Buka Google Spreadsheet
 * 2. Extensions → Apps Script
 * 3. Paste kode ini
 * 4. Deploy → New deployment → Web app
 * 5. Execute as: Me, Who has access: Anyone
 * 6. Copy URL yang dihasilkan
 */

function doGet() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets();
    const allData = [];
    
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
    
    // Iterasi semua sheet (9A, 9B, 9C, 9D, 9E, 9F)
    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      const sheetName = sheet.getName();
      
      // Hanya proses sheet yang namanya mengandung "9" (kelas 9)
      if (!sheetName.match(/9/)) continue;
      
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) continue;
      
      const headers = data[0];
      
      // Cari index kolom yang diperlukan
      let colNis = -1, colNisn = -1, colNama = -1, colTtl = -1;
      let colTkaMath = -1, colTkaBindo = -1;
      let colJenisKelamin = -1, colNamaAyah = -1;
      
      // Cari kolom berdasarkan header (case insensitive)
      for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i] || "").toLowerCase().trim();
        if (header === "nis") colNis = i;
        if (header === "nisn") colNisn = i;
        if (header === "nama lengkap") colNama = i;
        if (header === "ttl") colTtl = i;
        if (header === "nama ayah" || header === "nama orang tua" ||
            header === "nama orang tua/wali" || header === "nama wali" ||
            header === "nama ortu") colNamaAyah = i;
        if (header === "jenis kelamin") colJenisKelamin = i;
        if (header.indexOf("tka matematika") !== -1) colTkaMath = i;
        if (header.indexOf("tka bahasa indonesia") !== -1) colTkaBindo = i;
      }
      
      // Jika tidak ada kolom NIS, skip sheet ini
      if (colNis === -1) continue;
      
      // Loop setiap baris data
      for (let row = 1; row < data.length; row++) {
        const nisValue = data[row][colNis];
        if (!nisValue || nisValue === "") continue;
        
        // Data dasar
        const nis = String(nisValue);
        const nisn = colNisn !== -1 ? String(data[row][colNisn] || "") : "";
        const nama = colNama !== -1 ? String(data[row][colNama] || "") : "";
        const ttl = colTtl !== -1 ? String(data[row][colTtl] || "") : "";
        const jenisKelamin = colJenisKelamin !== -1 ? String(data[row][colJenisKelamin] || "") : "";
        const namaOrtu = colNamaAyah !== -1 ? String(data[row][colNamaAyah] || "") : "";
        
        // Nilai TKA
        let tkaMatematika = null, tkaMatematikaKategori = null;
        let tkaBahasaIndonesia = null, tkaBahasaIndonesiaKategori = null;
        
        if (colTkaMath !== -1 && data[row][colTkaMath]) {
          const raw = String(data[row][colTkaMath]);
          const matchAngka = raw.match(/(\d+(?:\.\d+)?)/);
          if (matchAngka) tkaMatematika = parseFloat(matchAngka[0]);
          const matchKategori = raw.match(/\(([^)]+)\)/);
          if (matchKategori) tkaMatematikaKategori = matchKategori[1];
        }
        
        if (colTkaBindo !== -1 && data[row][colTkaBindo]) {
          const raw = String(data[row][colTkaBindo]);
          const matchAngka = raw.match(/(\d+(?:\.\d+)?)/);
          if (matchAngka) tkaBahasaIndonesia = parseFloat(matchAngka[0]);
          const matchKategori = raw.match(/\(([^)]+)\)/);
          if (matchKategori) tkaBahasaIndonesiaKategori = matchKategori[1];
        }
        
        // Nilai rapor per mapel (SKN)
        const nilaiRapor = {};
        
        for (let m = 0; m < daftarMapel.length; m++) {
          const mapel = daftarMapel[m];
          const nilaiMapel = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 };
          
          // Cari kolom untuk mapel ini (semester 1-6)
          // Format kolom: "Pendidikan Agama dan Budi Pekerti (Smt1)", "Pendidikan Agama dan Budi Pekerti (Smt2)", dll
          for (let sem = 1; sem <= 6; sem++) {
            const colName = `${mapel} (Smt${sem})`;
            let colIndex = -1;
            for (let i = 0; i < headers.length; i++) {
              if (String(headers[i] || "").trim() === colName) {
                colIndex = i;
                break;
              }
            }
            if (colIndex !== -1) {
              const val = data[row][colIndex];
              if (val && !isNaN(val)) {
                nilaiMapel[`s${sem}`] = parseFloat(val);
              }
            }
          }
          
          nilaiRapor[mapel] = nilaiMapel;
        }
        
        // Ambil rata-rata semester (kolom Smt6 Smt1 - Smt6 Total)
        let rataSemester = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, total: 0 };
        
        for (let i = 0; i < headers.length; i++) {
          const header = String(headers[i] || "").trim();
          if (header === "Smt6 Smt1") rataSemester.s1 = parseFloat(data[row][i]) || 0;
          if (header === "Smt6 Smt2") rataSemester.s2 = parseFloat(data[row][i]) || 0;
          if (header === "Smt6 Smt3") rataSemester.s3 = parseFloat(data[row][i]) || 0;
          if (header === "Smt6 Smt4") rataSemester.s4 = parseFloat(data[row][i]) || 0;
          if (header === "Smt6 Smt5") rataSemester.s5 = parseFloat(data[row][i]) || 0;
          if (header === "Smt6 Total") rataSemester.total = parseFloat(data[row][i]) || 0;
        }
        
        // Ekstrak tempat dan tanggal lahir dari TTL
        let tempatLahir = "", tanggalLahir = "";
        if (ttl) {
          const ttlParts = ttl.split(",");
          if (ttlParts.length >= 2) {
            tempatLahir = ttlParts[0].trim();
            tanggalLahir = ttlParts.slice(1).join(",").trim();
          } else {
            tempatLahir = ttl;
          }
        }
        
        allData.push({
          nis: nis,
          nisn: nisn,
          nama: nama,
          kelas: sheetName,
          ttl: ttl,
          tempatLahir: tempatLahir,
          tanggalLahir: tanggalLahir,
          jenisKelamin: jenisKelamin,
          namaOrtu: namaOrtu,
          tka_matematika: tkaMatematika,
          kategori_matematika: tkaMatematikaKategori,
          tka_bahasa_indonesia: tkaBahasaIndonesia,
          kategori_bahasa_indonesia: tkaBahasaIndonesiaKategori,
          nilai: nilaiRapor,
          rataSemester: rataSemester
        });
      }
    }
    
    // Urutkan berdasarkan NIS
    allData.sort((a, b) => {
      const nisA = parseInt(a.nis) || 0;
      const nisB = parseInt(b.nis) || 0;
      return nisA - nisB;
    });
    
    // Hitung statistik TKA (rata-rata per kelas dan sekolah)
    const kelasStats = {};
    let totalMath = 0, totalBindo = 0, countMath = 0, countBindo = 0;
    
    allData.forEach(siswa => {
      const kelas = siswa.kelas;
      if (!kelas) return;
      
      if (!kelasStats[kelas]) {
        kelasStats[kelas] = { totalMath: 0, totalBindo: 0, countMath: 0, countBindo: 0 };
      }
      
      if (siswa.tka_matematika && siswa.tka_matematika > 0) {
        totalMath += siswa.tka_matematika;
        countMath++;
        kelasStats[kelas].totalMath += siswa.tka_matematika;
        kelasStats[kelas].countMath++;
      }
      
      if (siswa.tka_bahasa_indonesia && siswa.tka_bahasa_indonesia > 0) {
        totalBindo += siswa.tka_bahasa_indonesia;
        countBindo++;
        kelasStats[kelas].totalBindo += siswa.tka_bahasa_indonesia;
        kelasStats[kelas].countBindo++;
      }
    });
    
    // Hitung rata-rata per kelas
    for (const kelas in kelasStats) {
      const stats = kelasStats[kelas];
      kelasStats[kelas].rata_math = stats.countMath > 0 ? stats.totalMath / stats.countMath : 0;
      kelasStats[kelas].rata_bindo = stats.countBindo > 0 ? stats.totalBindo / stats.countBindo : 0;
    }
    
    const sekolahStats = {
      rata_math: countMath > 0 ? totalMath / countMath : 0,
      rata_bindo: countBindo > 0 ? totalBindo / countBindo : 0,
      total_siswa: allData.length
    };
    
    // Return sebagai JSON
    const output = {
      status: "success",
      total_siswa: allData.length,
      data: allData,
      kelas_stats: kelasStats,
      sekolah_stats: sekolahStats,
      last_updated: new Date().toISOString()
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    const errorOutput = {
      status: "error",
      message: error.toString(),
      stack: error.stack
    };
    return ContentService
      .createTextOutput(JSON.stringify(errorOutput))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Fungsi untuk testing di editor
 */
function testGetData() {
  const result = doGet();
  const content = result.getContent();
  Logger.log(content);
  
  const data = JSON.parse(content);
  if (data.status === "success") {
    Logger.log("Total siswa: " + data.total_siswa);
    if (data.data.length > 0) {
      Logger.log("Contoh data pertama:");
      Logger.log(JSON.stringify(data.data[0], null, 2));
    }
  } else {
    Logger.log("Error: " + data.message);
  }
}