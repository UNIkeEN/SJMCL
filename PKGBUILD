# Maintainer: kodatemitsuru <kodatemitsuru@sjtu.edu.cn>
pkgname='sjmcl'
_pkgname='SJMCL'
pkgdesc='🌟 A Minecraft launcher from @SJMC-Dev'
pkgver=0.0.0
pkgrel=1
arch=(x86_64)
license=(GPL-3.0,custom:LICENSE.EXTRA)
url='https://github.com/UNIkeEN/SJMCL'
source=("https://github.com/UNIkeEN/SJMCL/archive/refs/tags/v$pkgver.tar.gz")
sha512sums=('SKIP')
depends=('cairo' 'desktop-file-utils' 'gdk-pixbuf2' 'glib2' 'gtk3' 'hicolor-icon-theme' 'libsoup' 'pango' 'webkit2gtk-4.1')
makedepends=(pnpm npm cargo)
options=('!strip' '!emptydirs')
provides=('sjmcl')
conflicts=('sjmcl-bin' 'sjmcl-git')

prepare() {
  cd "$srcdir/$_pkgname-$pkgver" || return 1
  pnpm import
  pnpm install
}

build() {
  cd "$srcdir/$_pkgname-$pkgver" || return 1
  pnpm run tauri build --target x86_64-unknown-linux-gnu --bundles deb
}

package() {
  cd "$srcdir/$_pkgname-$pkgver" || return 1
  cp -r src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/${_pkgname}_${pkgver}_amd64/data/* "$pkgdir"
  install -Dm644 "LICENSE.EXTRA" "$pkgdir/usr/share/licenses/$pkgname/LICENSE.EXTRA"
}
