# Setelan monokrom: aturan desain

Acuan: `easy-launcher-settings.html`. Tema sama dengan homebar (`DESIGN-homebar.md`): monokrom penuh, radius 6 px untuk panel dan 4 px untuk isinya, latar live tetap berjalan di belakang.

## Tata letak
- Panel mengisi jendela: jarak 24 px dari semua tepi, tanpa lebar maksimum.
- Dua kolom: sidebar 240 px di kiri, konten di kanan yang bisa di-scroll. Isi konten dibatasi 900 px dan rata tengah supaya baris tetap enak dibaca di layar lebar.
- Sidebar (atas ke bawah): tombol Kembali, kolom Cari setelan, daftar kategori.
- Layar sempit (di bawah 720 px): sidebar jadi baris di atas, kategori bisa digeser.

## Kategori dan isi
- **Umum:** bahasa, tutup launcher saat game jalan, notifikasi, perbarui otomatis, kanal pembaruan, folder game.
- **Game:** layar penuh, resolusi, pisahkan folder tiap profil, tampilkan log game, langsung masuk server, argumen game.
- **Java:** versi Java, lokasi Java, deteksi Java, memori otomatis, memori minimum dan maksimum, argumen JVM.
- **Unduhan:** sumber unduhan, unduhan bersamaan, batas kecepatan, verifikasi file, proxy, bersihkan cache.
- **Akun:** akun aktif (ganti, keluar), masuk otomatis, ubah skin.
- **Tampilan:** latar live (pilih, hapus), latar hitam putih, redupkan latar, kaburkan panel, ukuran antarmuka, jeda latar saat game jalan.
- **Tentang:** versi, cek pembaruan, buka folder log, atur ulang setelan.
- Setelan baru ditambahkan lewat array `SCHEMA` di bagian atas skrip. Tipe: `toggle`, `select`, `text`, `range`, `btns`, `info`, `account`.

## Baris
- Satu setelan = satu baris: nama (14/600) di kiri, kontrol di kanan, tinggi minimum 64 px.
- Keterangan 13 px abu-abu hanya bila nama saja tidak cukup jelas.
- Baris dipisahkan garis 1 px. Tidak ada kartu atau grup bersarang.
- Baris yang bergantung pada setelan lain (misalnya slider RAM saat Memori otomatis aktif) diredupkan dan tidak bisa diklik.

## Kontrol (semua 36 px, radius 4 px)
| Kontrol | Tampilan |
|---|---|
| Dropdown dan input teks | Latar putih 5%, garis 1 px, garis lebih terang saat hover atau fokus |
| Toggle | 40 × 22 px. Mati abu-abu gelap, hidup putih dengan kenop gelap |
| Slider | Putih, nilai di kanan (MB, GB, persen, atau angka) |
| Tombol | Garis 1 px. Tombol solid putih hanya bila ada aksi utama |

## Cari
- Mengetik di kolom Cari menampilkan semua baris yang cocok dari semua kategori. Kategori tanpa hasil disembunyikan.
- Escape pertama mengosongkan pencarian, Escape berikutnya kembali ke beranda.

## Perilaku
- Simpan otomatis. Tidak ada tombol Simpan. Setiap perubahan mengirim `settingschange`.
- Pengaturan tampilan berlaku langsung: redup latar, hitam putih, kaburkan panel, ukuran antarmuka.
- Video latar berhenti saat jendela tersembunyi, dan (bila "Jeda latar saat game jalan" aktif) saat `setGameRunning(true)`.
- Fokus keyboard terlihat (garis putih 2 px). Toggle `role="switch"`, kategori `role="tab"`.
- Gerak hanya respons aksi, 0,15 detik. Hormati `prefers-reduced-motion`.

## Warna
- Panel `rgba(10,10,10,.6)`, blur 24 px, saturasi 0. Garis `rgba(255,255,255,.12)`.
- Teks `#fafafa`, keterangan `#a3a3a3`. Tidak ada warna aksen.

## Antarmuka untuk backend
- Fungsi: `getSettings()`, `setSettings(obj)`, `setAccount({username, provider, avatar})`, `setStageBackground(url)`, `setStageGrayscale(bool)`, `setGameRunning(bool)`.
- Event `settingschange`: `detail` berisi semua nilai.
- Event `settingsaction`: `detail.action` salah satu dari open-folder, browse-java, detect-java, clear-cache, switch-account, logout, change-skin, pick-background, clear-background, check-update, open-logs, reset-settings. Konfirmasi untuk reset-settings ditangani backend.
- Event `navigate`: `detail.page = "home"`.

## Larangan
- Warna aksen, kartu per setelan, atau lebih dari tujuh kategori.
- Keterangan yang hanya mengulang nama setelan.
- Tombol Simpan bersamaan dengan simpan otomatis. 
