# Halaman Game (profil dan versi): aturan desain

Acuan: `easy-launcher-game.html`. Tema dan tata letak sama dengan halaman setelan (`DESIGN-settings.md`): monokrom, radius 6 px untuk panel dan 4 px untuk isinya, panel mengisi jendela, latar live tetap berjalan.

## Tata letak
- Sidebar 240 px: Kembali, kolom Cari profil, daftar profil, tombol Profil baru di bawah.
- Item profil: nama (14/600) dan versi · loader (13 px abu-abu). Titik putih kecil menandai profil aktif. Profil terpilih berlatar putih 9%.
- Editor di kanan, isi dibatasi 900 px dan rata tengah.

## Isi editor (atas ke bawah)
1. Nama
2. Versi Minecraft: dropdown, dengan toggle "Snapshot" untuk menampilkan versi snapshot. Bawaan hanya rilis.
3. Loader: kontrol segmen Vanilla, Fabric, Forge, NeoForge, Quilt. Segmen terpilih putih.
4. Versi loader: dropdown, disembunyikan bila loader Vanilla.
5. Java: Otomatis, 21, 17, 8.
6. Ikuti memori global (toggle). Bila mati, slider Memori aktif. Bila hidup, slider diredupkan.
7. Argumen JVM
8. Status: Terpasang atau Belum terpasang, tombol Pasang atau Pasang ulang, tombol Buka folder.
9. Aksi: Jadikan aktif (solid, nonaktif bila sudah aktif), Duplikat, Hapus.

## Perilaku
- Simpan otomatis. Setiap perubahan mengirim `profilechange`. Mengubah versi Minecraft, loader, atau versi loader menandai profil Belum terpasang.
- Profil baru langsung dibuat dengan nilai bawaan dan kolom nama terfokus.
- Hapus memakai dua langkah: klik pertama berubah jadi "Yakin?" selama 3 detik, klik kedua menghapus.
- Escape kembali ke beranda (kecuali sedang mengetik).

## Antarmuka untuk backend
- Fungsi: `setProfiles(list, activeId)`, `setVersions({minecraft:[{id,type}], loaders:{fabric:[...], forge:[...], neoforge:[...], quilt:[...]}})`, `getProfiles()`, `setStageBackground(url)`, `setStageGrayscale(bool)`.
- Bentuk profil: `{id, name, mc, loader, loaderVer, java, ramAuto, ram, args, installed}`.
- Event: `profilecreate`, `profilechange`, `profiledelete` (`{id}`), `profileactivate` (`{id}`), `profileaction` (`{id, action: install | open-folder}`), `navigate` (`detail.page = "home"`).

## Larangan
- Warna aksen, kartu per profil, atau tombol Simpan.
- Menulis nama atau versi profil lebih dari sekali dalam satu baris. 
