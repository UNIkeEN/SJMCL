# easy-launcher: DESIGN.md

Panduan tema global untuk seluruh UI easy-launcher (fork SJMCL, Tauri + Next.js + Chakra UI). Referensi visual: `easy-launcher-home.html`. Kalau ada konflik antara dokumen ini dan file itu, file HTML yang menang untuk tampilan, dokumen ini yang menang untuk aturan.

## Arah desain

Launcher yang ringan dan jujur, dengan tampilan terang berwarna mint, garis tinta tebal, bayangan keras, dan satu aksen lime. Sengaja berbeda dari launcher game yang umumnya gelap dan bergradasi neon. Satu elemen jadi pusat perhatian di tiap halaman (di Beranda: tombol Mainkan), sisanya tenang.

## Token warna

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `ground` | `#E7F0E4` | Latar halaman |
| `ink` | `#0B1A12` | Teks utama, garis, kartu gelap, bayangan |
| `accent` | `#C6FF3D` | Tombol utama, penanda aktif, avatar |
| `muted` | `#45594C` | Teks sekunder di atas `ground` (rasio kontras sekitar 6,4:1) |
| `surface` | `#CFE3D3` | Permukaan sekunder (tombol dropdown, hover item) |
| `on-ink-muted` | `#A9BBAF` | Teks sekunder di atas `ink` (rasio sekitar 8,9:1) |

Aturan:
- Teks di atas `accent` selalu `ink`. Teks di atas `ink` memakai `#EAF3EC` atau `on-ink-muted`.
- Jangan menambah warna aksen kedua. Status (galat, peringatan) memakai bentuk dan ikon di samping warna, dan nilainya ditentukan nanti di token terpisah.
- Aksen harus bisa diganti pengguna lewat satu variabel (`--accent`). Pastikan teks `ink` di atasnya tetap terbaca.
- Mode gelap belum didesain. Jangan dibalik otomatis. Rancang sebagai tema terpisah kalau diperlukan.

## Tipografi

- Satu keluarga: **Bricolage Grotesque** (Google Fonts, bobot 400 sampai 800). Fallback: `system-ui, sans-serif`.
- Teks tampilan (nama profil, tombol utama): bobot 800, `letter-spacing: -0.03em`, `line-height: 1.05`.
- Judul kecil dan nama item: 14 sampai 18 px, bobot 700.
- Isi dan label: 13 sampai 14 px, bobot 500 sampai 600. Tidak ada teks di bawah 12 px.
- Gaya penulisan: huruf kecil biasa (sentence case). Jangan pakai huruf kapital semua, label di atas judul, atau teks dengan banyak titik tengah.
- Unduh font ke aset lokal saat dipasang di aplikasi, supaya launcher tetap jalan tanpa internet.

## Bentuk, garis, bayangan

| Token | Nilai |
|---|---|
| `border` | `2px solid ink` (tombol utama `3px`) |
| `radius-sm` | `14px` (item daftar) |
| `radius-md` | `20px` (dropdown, kartu kecil) |
| `radius-lg` | `26px` (kartu besar, panel latar) |
| `radius-pill` | `999px` (navigasi, akun) |
| `shadow-hard` | `6px 6px 0 ink` (tombol Mainkan, daftar dropdown) |

Tidak ada bayangan lembut, blur, atau gradien dekoratif. Kedalaman hanya dari garis dan bayangan keras.

## Tata letak

- Satu jendela, tanpa sidebar. Atas: logo di kiri, navigasi pil di tengah, akun di kanan.
- Di bawahnya dua kolom: panel latar (fleksibel) dan kolom 400 px di kanan berisi dropdown profil, kartu detail, dan tombol Mainkan.
- Padding jendela 28 px (vertikal) dan 40 px (horizontal). Jarak antar kolom 32 px.
- Di bawah 1000 px lebar, kolom ditumpuk dan panel latar setinggi 520 px.
- Halaman baru (Profil/Instances, Mod, Unduhan, Setelan) memakai kerangka atas yang sama dan mengganti isi di bawahnya.

## Komponen

**Navigasi.** Pil dengan garis ink. Item aktif: latar `ink`, teks `accent`, bobot 700. Tandai dengan `aria-current="page"`.

**Akun.** Pil dengan avatar bulat (latar `ink`, inisial `accent`) dan nama pengguna.

**Panel latar.** Gambar atau GIF dengan `background-size: cover`, garis ink, radius 26. Teks di atasnya tidak boleh langsung menempel pada gambar. Taruh di kartu berlatar `ground` dengan garis ink (contoh: kartu statistik di pojok kiri bawah).

**Dropdown profil.** Tombol latar `surface` dengan nama dan meta (loader dan versi). Daftar terbuka di bawahnya dengan `shadow-hard`. Item terpilih: latar `ink`, teks `accent`. Wajib bisa dipakai keyboard: panah atas dan bawah, Escape menutup, `role="listbox"` dan `role="option"` dengan `aria-selected`. Kirim event `profilechange` saat profil diganti.

**Kartu detail.** Latar `ink`, teks terang, nama profil 34 px bobot 800, baris spesifikasi dengan garis putus-putus tipis sebagai pemisah. Isinya hanya data yang berguna untuk meluncurkan (Loader, Minecraft, Java, Memori).

**Tombol utama (Mainkan).** Latar `accent`, garis 3 px, `shadow-hard`. Saat hover bergeser 2 px ke bawah-kanan dengan bayangan mengecil. Saat ditekan bergeser penuh dan bayangan hilang. Hanya satu tombol utama per layar.

**Tombol sekunder.** Garis ink 2 px, latar transparan atau `surface`, tanpa bayangan.

## Gerak

Gerak hanya untuk menjawab aksi pengguna: tombol ditekan, dropdown terbuka (panah berputar). Tanpa animasi masuk otomatis. Hormati `prefers-reduced-motion`. GIF latar tidak bisa dihentikan lewat CSS, jadi sediakan pengaturan untuk mematikannya, atau pakai WebM/MP4 pendek yang bisa dijeda.

## Aksesibilitas

- Fokus keyboard selalu terlihat (`outline: 3px solid ink`, offset 3 px).
- Semua kontrol memakai elemen asli (`button`, `a`), bukan `div` dengan `onClick`.
- Tombol berisi ikon saja wajib punya `aria-label`.
- Perubahan status peluncuran diumumkan lewat elemen `role="status"`.
- Kontras teks minimal 4,5:1.

## Menerapkan ke SJMCL

Hal-hal berikut dari kode SJMCL yang sudah kamu jalankan: Next.js, Chakra UI, dan banyak context provider. Sesuaikan dengan versi Chakra yang terpasang (v2 memakai `extendTheme`, v3 memakai `createSystem`).

1. Jadikan token di atas **satu sumber** di tema Chakra (warna, font, radius, bayangan). Jangan menulis hex langsung di komponen.
2. Buat varian komponen, bukan gaya sekali pakai: `Button` (`primary`, `secondary`), `Select` atau `Menu` untuk dropdown profil, `Card` (`dark`, `light`).
3. Ganti font global dan pasang font secara lokal.
4. Terapkan ke halaman Beranda dulu (acuannya `easy-launcher-home.html`), lalu halaman lain satu per satu. Jangan mengubah semua sekaligus.
5. Jangan mengubah logika bisnis. Ganti hanya lapisan tampilan dan sambungkan ke state yang sudah ada.

Catatan adaptasi (disepakati):
- Aksen tetap user-configurable lewat setting primaryColor SJMCL yang sudah ada; lime `#C6FF3D` jadi default.
- Mode gelap dulu tidak didesain: toggle dark mode disembunyikan (bukan dihapus) sampai theme kedua dibuat.
- Bricolage Grotesque jadi font built-in default; fitur custom font/size user di settings tetap berfungsi sebagai override.

## Atribusi dan lisensi

Easy-launcher adalah turunan SJMCL (GPLv3 dengan syarat tambahan). Karena itu:
- Nama produk tidak boleh memuat "SJMCL" atau "SJMC Launcher".
- Halaman Tentang (About), README, dan situs distribusi harus menyebut bahwa easy-launcher berbasis SJMCL, lengkap dengan tautan ke `https://github.com/UNIkeEN/SJMCL`.
- Pertahankan file `LICENSE` dan `LICENSE.EXTRA`, dan jangan hapus catatan hak cipta di kode.
- Logo dan ikon SJMCL jangan dipakai ulang.
- Easy-launcher bukan produk resmi Minecraft dan tidak berafiliasi dengan Mojang atau Microsoft. Jangan gunakan kata "Minecraft" sebagai bagian dari nama produk.

Tulisan atribusi tidak ditaruh di Beranda supaya tampilan bersih, tapi harus ada di halaman Tentang.

## Jangan

- Menambah warna aksen kedua, gradien, atau bayangan lembut.
- Membuat sidebar ikon seperti launcher lain.
- Menumpuk banyak kartu identik. Gunakan satu kartu fokus.
- Menaruh teks langsung di atas GIF tanpa kartu berlatar solid.
- Menulis label huruf kapital, atau teks pengisi yang tidak membantu pengguna.
