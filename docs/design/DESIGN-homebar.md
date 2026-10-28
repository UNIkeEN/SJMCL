# Homebar monokrom: aturan desain

Acuan: `easy-launcher-homebar.html`. Dua lapisan saja: latar live layar penuh dan satu bar ikon di bawah.

## Prinsip
- Monokrom penuh: hitam, putih, dan abu-abu netral. Tidak ada warna aksen.
- Bar hanya berisi ikon rute dan tombol Mainkan. Tidak ada teks lain.
- Radius 6 px untuk bar, 4 px untuk elemen di dalamnya.

## Bar
- Selebar isinya, rata tengah, 28 px dari tepi bawah. Padding 6 px, kontrol 40 px.
- Urutan: Profil, Mod, Mainkan, Unduhan, Setelan. Dua ikon di kiri dan dua di kanan, simetris.
- Ikon garis tipis 18 px, berwarna abu-abu, putih saat hover. Nama muncul sebagai tooltip di atas ikon.
- Mainkan: tombol putih, teks gelap 14/600, diikuti versi Minecraft kecil berwarna abu-abu.
- Akun, ganti profil, dan opsi lain berada di halaman rute masing-masing (akun ada di Setelan).

## Warna
- `--bg #0a0a0a`, panel `rgba(10,10,10,.55)` dengan blur 20 px dan saturasi 0.
- Garis `rgba(255,255,255,.12)`, hover `rgba(255,255,255,.1)`.
- Teks `#fafafa`, ikon dan keterangan `#a3a3a3`, versi di tombol `#737373`.
- `setStageGrayscale(true)` membuat latar ikut hitam putih. Bawaannya mati.

## Latar live
- `setStageBackground(url)` menerima gambar, GIF, atau video (`.mp4`, `.webm`, `.ogv`).
- Video diam, berulang, `object-fit: cover`. Berhenti saat jendela tersembunyi, dan tidak diputar otomatis bila reduced motion aktif.
- Gradasi hitam tipis di bawah menjaga bar terbaca di latar apa pun.

## Gerak
- Hanya respons aksi: hover dan tooltip 0,15 detik, tekan menggeser Mainkan 1 px.

## Antarmuka untuk backend
- Fungsi: `setStageBackground(url)`, `setStageGrayscale(bool)`, `setProfile({name, version, loader})`.
- Event: `launch`, `navigate` (`detail.page`: profiles, mods, downloads, settings).

## Larangan
- Warna aksen, teks di bar selain Mainkan, atau lebih dari empat ikon rute.
- Bayangan tebal atau gradasi dekoratif.
- Memutar audio dari latar video. 
