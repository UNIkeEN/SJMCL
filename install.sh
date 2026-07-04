#!/bin/sh

set -eu

REPO="${SJMCL_REPO:-UNIkeEN/SJMCL}"
VERSION_INPUT="${SJMCL_VERSION:-}"
INSTALL_MODE="package"
DOWNLOAD_SOURCE="auto"
SJMC_RELEASE_API="https://mc.sjtu.cn/api-sjmcl/releases/latest"
SJMC_RELEASE_BASE="https://mc.sjtu.cn/sjmcl/releases"
CURL_CONNECT_TIMEOUT="10"
CURL_METADATA_MAX_TIME="15"

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

usage() {
  cat <<'EOF'
SJMCL Linux installer

Usage:
  install.sh [--portable] [--source <auto|github|sjmc>]

Options:
  --portable          Install the portable binary to ~/.sjmcl and link it from ~/.local/bin.
  --source <source>   Select download source: auto, github, or sjmc. Defaults to auto.
  -h, --help          Show this help message.

Environment:
  SJMCL_VERSION       Release version or tag to install. Defaults to the latest stable release.
  SJMCL_REPO          GitHub repository to download from. Defaults to UNIkeEN/SJMCL.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --portable)
      INSTALL_MODE="portable"
      ;;
    --source)
      shift
      [ "$#" -gt 0 ] || fail "--source requires a value: auto, github, or sjmc"
      DOWNLOAD_SOURCE="$1"
      ;;
    --source=*)
      DOWNLOAD_SOURCE="${1#--source=}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
  shift
done

if [ "$(uname -s)" != "Linux" ]; then
  fail "this installer currently supports Linux only"
fi

need_cmd curl
need_cmd uname
need_cmd sed
need_cmd tr
need_cmd mktemp
need_cmd rm

case "$INSTALL_MODE" in
  package|portable) ;;
  *) fail "unsupported install mode: $INSTALL_MODE (expected package or portable)" ;;
esac

case "$DOWNLOAD_SOURCE" in
  auto|github|sjmc) ;;
  *) fail "unsupported download source: $DOWNLOAD_SOURCE (expected auto, github, or sjmc)" ;;
esac

if [ "$INSTALL_MODE" = "portable" ]; then
  need_cmd mkdir
  need_cmd cp
  need_cmd chmod
  need_cmd ln
else
  need_cmd id
fi

if [ "$INSTALL_MODE" = "package" ]; then
  if command -v apt-get >/dev/null 2>&1; then
    PACKAGE_TYPE="deb"
    INSTALL_CMD="apt-get"
  elif command -v apt >/dev/null 2>&1; then
    PACKAGE_TYPE="deb"
    INSTALL_CMD="apt"
  elif command -v dnf >/dev/null 2>&1; then
    PACKAGE_TYPE="rpm"
    INSTALL_CMD="dnf"
  elif command -v yum >/dev/null 2>&1; then
    PACKAGE_TYPE="rpm"
    INSTALL_CMD="yum"
  elif command -v zypper >/dev/null 2>&1; then
    PACKAGE_TYPE="rpm"
    INSTALL_CMD="zypper"
  elif command -v pacman >/dev/null 2>&1; then
    fail "Arch Linux users should install SJMCL from AUR instead: yay -S sjmcl-bin"
  else
    fail "this installer requires apt, dnf, yum, or zypper"
  fi
fi

case "$(uname -m)" in
  x86_64|amd64)
    ARCH="x86_64"
    ;;
  aarch64|arm64)
    ARCH="aarch64"
    ;;
  *)
    fail "unsupported architecture: $(uname -m)"
    ;;
esac

normalize_tag() {
  TAG="$1"
  case "$TAG" in
    v*) ;;
    *) TAG="v$TAG" ;;
  esac
}

set_asset_name() {
  if [ "$INSTALL_MODE" = "portable" ]; then
    ASSET_NAME="SJMCL_${VERSION}_linux_${ARCH}_portable"
  else
    ASSET_NAME="SJMCL_${VERSION}_linux_${ARCH}.${PACKAGE_TYPE}"
  fi
}

prepare_github_download() {
  if [ -n "$VERSION_INPUT" ]; then
    normalize_tag "$VERSION_INPUT"
  else
    TAG="$(curl -fsSL --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_METADATA_MAX_TIME" -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" 2>/dev/null)" || return 1
    TAG="${TAG##*/}"
  fi

  [ -n "$TAG" ] || return 1
  VERSION="${TAG#v}"
  set_asset_name
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$TAG/$ASSET_NAME"
}

prepare_sjmc_download() {
  RELEASE_META=""
  RELEASE_META_COMPACT=""
  if [ -n "$VERSION_INPUT" ]; then
    normalize_tag "$VERSION_INPUT"
    VERSION="${TAG#v}"
  else
    RELEASE_META="$(curl -fsSL --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_METADATA_MAX_TIME" "$SJMC_RELEASE_API" 2>/dev/null)" || return 1
    RELEASE_META_COMPACT="$(printf '%s' "$RELEASE_META" | tr -d '\r\n')"
    VERSION="$(printf '%s\n' "$RELEASE_META_COMPACT" | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    VERSION="${VERSION#v}"
  fi

  [ -n "$VERSION" ] || return 1
  set_asset_name

  if [ -n "$RELEASE_META_COMPACT" ]; then
    case "$RELEASE_META_COMPACT" in
      *"\"name\":\"$ASSET_NAME\""*) ;;
      *) return 1 ;;
    esac
  fi

  DOWNLOAD_URL="$SJMC_RELEASE_BASE/$ASSET_NAME"
}

if [ "$DOWNLOAD_SOURCE" = "auto" ]; then
  TRACE="$(curl -fsSL --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_METADATA_MAX_TIME" "https://cloudflare.com/cdn-cgi/trace" 2>/dev/null || true)"
  CF_LOC="$(printf '%s\n' "$TRACE" | sed -n 's/^loc=//p')"
  if [ -n "$CF_LOC" ] && [ "$CF_LOC" != "CN" ]; then
    SOURCE_ORDER="github sjmc"
  else
    SOURCE_ORDER="sjmc github"
  fi
else
  SOURCE_ORDER="$DOWNLOAD_SOURCE"
fi

TMPDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT INT TERM

DOWNLOADED="0"
for SOURCE in $SOURCE_ORDER; do
  case "$SOURCE" in
    github)
      prepare_github_download || {
        log "Failed to prepare download from GitHub source."
        continue
      }
      ;;
    sjmc)
      prepare_sjmc_download || {
        log "Failed to prepare download from SJMC source."
        continue
      }
      ;;
  esac

  PACKAGE_PATH="$TMPDIR/$ASSET_NAME"

  log "Installing SJMCL $VERSION for $ARCH"
  log "Using $SOURCE source"
  log "Downloading $DOWNLOAD_URL"
  if curl -fL --progress-bar --connect-timeout "$CURL_CONNECT_TIMEOUT" "$DOWNLOAD_URL" -o "$PACKAGE_PATH"; then
    DOWNLOADED="1"
    break
  fi

  log "Download failed from $SOURCE source."
done

[ "$DOWNLOADED" = "1" ] || fail "failed to download SJMCL from available sources"

if [ "$INSTALL_MODE" = "portable" ]; then
  HOME_DIR="${HOME:-}"
  [ -n "$HOME_DIR" ] || fail "HOME is not set; cannot install portable SJMCL"

  INSTALL_DIR="$HOME_DIR/.sjmcl"
  LOCAL_BIN_DIR="$HOME_DIR/.local/bin"
  PORTABLE_PATH="$INSTALL_DIR/SJMCL"
  LINK_PATH="$LOCAL_BIN_DIR/sjmcl"

  mkdir -p "$INSTALL_DIR" "$LOCAL_BIN_DIR"
  cp "$PACKAGE_PATH" "$PORTABLE_PATH"
  chmod 755 "$PORTABLE_PATH"

  if [ -e "$LINK_PATH" ] && [ ! -L "$LINK_PATH" ]; then
    fail "$LINK_PATH already exists and is not a symlink; refusing to overwrite it"
  fi

  ln -sfn "$PORTABLE_PATH" "$LINK_PATH"

  log "Installed portable SJMCL to $PORTABLE_PATH"
  log "Created command link at $LINK_PATH"

  case ":${PATH:-}:" in
    *":$LOCAL_BIN_DIR:"*) ;;
    *)
      log "Note: $LOCAL_BIN_DIR is not in PATH."
      log "Add it to PATH or run SJMCL directly with: $PORTABLE_PATH"
      ;;
  esac

  FOUND_SJMCL="$(command -v sjmcl 2>/dev/null || true)"
  if [ -n "$FOUND_SJMCL" ] && [ "$FOUND_SJMCL" != "$LINK_PATH" ]; then
    log "Note: 'sjmcl' currently resolves to $FOUND_SJMCL."
    log "Your shell may run that version before the portable install at $LINK_PATH."
  fi

  log "SJMCL $VERSION installed successfully."
  exit 0
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  need_cmd sudo
  SUDO="sudo"
fi

log "Installing package with $INSTALL_CMD"
case "$INSTALL_CMD" in
  apt-get)
    if [ -n "$SUDO" ]; then
      $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "$PACKAGE_PATH"
    else
      DEBIAN_FRONTEND=noninteractive apt-get install -y "$PACKAGE_PATH"
    fi
    ;;
  apt)
    if [ -n "$SUDO" ]; then
      $SUDO env DEBIAN_FRONTEND=noninteractive apt install -y "$PACKAGE_PATH"
    else
      DEBIAN_FRONTEND=noninteractive apt install -y "$PACKAGE_PATH"
    fi
    ;;
  dnf)
    $SUDO dnf install -y "$PACKAGE_PATH"
    ;;
  yum)
    $SUDO yum install -y "$PACKAGE_PATH"
    ;;
  zypper)
    $SUDO zypper --non-interactive install "$PACKAGE_PATH"
    ;;
esac

log "SJMCL $VERSION installed successfully."
