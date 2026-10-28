# Halaman Akun: aturan desain

Acuan: `easy-launcher-account.html`. Tema dan tata letak sama dengan halaman setelan dan game: monokrom, panel mengisi jendela, latar live tetap berjalan.

## Tata letak
- Sidebar 240 px: Kembali, daftar akun, tombol Tambah akun di bawah.
- Item akun: avatar 32 px, username (14/600), penyedia (13 px abu-abu). Titik putih menandai akun aktif.
- Panel kanan menampilkan detail akun terpilih, atau form Tambah akun.

## Detail akun
- Kepala: avatar 64 px, username 20/600 dengan tag "Aktif" bila aktif, penyedia di bawahnya.
- Baris: UUID (tombol Salin, berubah jadi "Tersalin" 1,5 detik), Token (Valid, Kedaluwarsa, atau Tanpa token; tombol Segarkan, nonaktif untuk akun offline), Skin (Ubah skin).
- Aksi: Jadikan aktif (solid, nonaktif bila sudah aktif) dan Keluar. Keluar memakai dua langkah: klik pertama menjadi "Yakin?" selama 3 detik, klik kedua menghapus akun.

## Tambah akun
- Satu baris per penyedia: Microsoft, Ely.by, Server autentikasi lain (kolom alamat server), Offline (kolom nama pemain).
- Tombol "Masuk", dan "Tambah" untuk Offline. Bila kolom wajib kosong, fokus pindah ke kolom itu.
- Login offline tidak memerlukan Microsoft: cukup nama pemain, lalu "Tambah".

## Antarmuka untuk backend
- Fungsi: `setAccounts(list, activeId)`, `setStageBackground(url)`, `setStageGrayscale(bool)`.
- Bentuk akun: `{id, username, provider, uuid, status: valid | expired | offline, avatar}`.
- Event: `accountadd` (`{provider, value}`), `accountactivate` (`{id}`), `accountaction` (`{id, action: refresh | change-skin}`), `accountremove` (`{id}`), `navigate` (`detail.page = "home"`).
- Proses login (Microsoft, Ely.by, dan lainnya) ditangani backend. Halaman hanya mengirim `accountadd`.

## Larangan
- Warna aksen atau kartu per akun.
- Menampilkan token atau kredensial di antarmuka. 
