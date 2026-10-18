# Penyetan 234 — PWA Manajemen Operasional

Aplikasi web progresif (PWA) untuk mengelola pesanan, pelanggan, menu, belanja, dan laporan lewat HP Android. HTML5 + CSS3 + JavaScript modular, tanpa build step, tanpa library eksternal. Data disimpan di **IndexedDB** pada perangkat.

## Struktur file

```
index.html               Shell aplikasi
manifest.webmanifest     Manifest PWA (standalone, ikon 192/512/maskable)
service-worker.js        Cache aset, fallback offline, mekanisme pembaruan
css/style.css            Gaya (hijau toska #10B981, kartu membulat)
icons/                   icon-192.png, icon-512.png, icon-maskable-512.png
js/app.js                Router hash, navbar, offline, instal, pembaruan
js/db.js                 Lapisan IndexedDB, nomor urut, ekspor/impor cadangan
js/calc.js               Perhitungan murni (omzet, uang masuk, rekap, CSV)
js/util.js, js/charts.js Helper UI, sheet, konfirmasi, grafik SVG
js/pages/*.js            home, orders, menu, customers, summary, expenses,
                         overtime, reservations, more, settings, backup, info
tests/calc.test.mjs      Uji unit perhitungan (node --test tests/calc.test.mjs)
```

## Menjalankan lokal

```
cd penyetan234
python3 -m http.server 8080      # atau: npx serve
```
Buka `http://localhost:8080`. Service worker hanya aktif di `localhost` atau HTTPS.

## Deployment ke GitHub Pages

1. Buat repositori, unggah seluruh isi folder `penyetan234` ke cabang `main` (index.html di akar).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Buka `https://<akun>.github.io/<repo>/`. Semua path relatif, jadi aman di subfolder.
4. Setiap kali mengubah berkas, naikkan `VERSION` di `service-worker.js` agar pengguna mendapat tombol "Muat ulang".

## Memasang di Android

Buka alamat aplikasi di Chrome → menu ⋮ → **Instal aplikasi** / **Tambahkan ke layar utama** (atau menu Lainnya → *Pasang di Layar Utama*). Setelah terpasang, aplikasi dibuka standalone dan jalan offline.

## Konfigurasi database

IndexedDB `penyetan234` (versi 2), store: `customers`, `menus`, `orders`, `expenses`, `overtime`, `reservations`, `settings` (`attendance` adalah sisa versi lama; datanya tidak dihapus tapi tidak lagi ditampilkan). Tidak perlu konfigurasi. Browser diminta menyimpan data secara permanen (`storage.persist`).

## Aturan perhitungan

- **Status pesanan** (Aktif/Selesai) terpisah dari **status pembayaran** (Belum lunas/Lunas). Selesai tidak otomatis lunas.
- **Pesanan aktif** = belum selesai dan belum difakturkan (dihitung semua periode).
- **Omzet** = pesanan selesai atau sudah difakturkan. **Uang masuk** = pesanan lunas, pada tanggal pembayaran. **Tagihan belum dibayar** = omzet yang belum lunas.
- **Laba tidak dihitung.** Rangkuman hanya menampilkan "uang masuk − belanja" sebagai selisih kas sederhana, karena HPP dan biaya lain belum tercatat.
- **Diskon, pajak, DP:** subtotal − diskon (Rp atau %) = dasar pajak; + pajak (%) = total; total − DP = sisa tagihan. Nilai pajak tidak diisi otomatis, Anda yang menentukan persentasenya. DP dihitung sebagai uang masuk pada tanggal DP, pelunasan menghitung sisanya saja, jadi tidak terhitung dua kali. Omzet memakai total akhir (sudah termasuk pajak).
- Harga di pesanan disalin saat pesanan dibuat, jadi mengubah harga menu tidak mengubah riwayat.
- Setiap belanja disimpan satu kali dan dijumlahkan sekali.

## Fitur yang sudah berfungsi

Beranda (pilih bulan/tahun, ringkasan, pintasan, grafik M1–M4), Pesanan (tambah, edit, cari, filter periode/status, detail, selesai, faktur, lunas, hapus dengan konfirmasi, CSV, kirim faktur via WhatsApp, cetak; PDF lewat dialog cetak browser, bukan file PDF otomatis), Menu, Pelanggan (riwayat dan total transaksi), Belanja, Rangkuman (periode, rekap harian/mingguan/bulanan, menu terlaris, pelanggan teratas, grafik), Lembur Karyawan (jam mulai/selesai, durasi otomatis termasuk lewat tengah malam, tarif per jam opsional, rekap bulanan per karyawan, CSV), Reservasi, Pengaturan, Cadangan JSON (unduh dan pulihkan), CSV, PWA (manifest, service worker, offline, indikator offline, pembaruan).

## Membutuhkan konfigurasi tambahan / belum ada

- **Sinkronisasi banyak perangkat dan banyak pengguna belum ada.** Data hanya di satu HP. Untuk itu diperlukan proyek Firebase milik Anda (Authentication + Firestore, Security Rules, konfigurasi web app). Kunci API Firebase web memang publik; keamanan ada di Security Rules, bukan di menyembunyikan kunci. Hubungi saya jika ingin ditambahkan.
- **Logo resmi** belum ada; ikon hanya tulisan "PENYETAN 234" sederhana. Ganti berkas di `icons/` bila punya logo.
- **Menu dan harga kosong** sengaja; isi sendiri di halaman Menu.
- Screenshot referensi tidak terlampir; tampilan mengikuti deskripsi prompt dan struktur situs referensi. Fitur situs referensi seperti kalkulator omzet/online, impor laporan WhatsApp, laporan kebersihan, dan broadcast tidak diminta dan belum dibuat.
- Data hilang jika data browser dihapus atau HP hilang. Buat cadangan rutin di menu Lainnya → Ekspor & Pencadangan.
