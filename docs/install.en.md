# Installing SJMCL

Download the latest release from this site to get started. You can also find all releases, including nightly builds, on [GitHub Releases](https://github.com/UNIkeEN/SJMCL/releases).

## Supported Platforms

SJMCL currently supports the following platforms:

| Platform | Versions | Architectures | Provided Bundles |
|----------|----------|---------------|------------------|
| Windows  | 7 and above | `aarch64`, `i686`, `x86_64` | installer `.exe`, portable `.exe` (**portable recommended**) |
| macOS    | 10.15 and above | `aarch64`, `x86_64` | `.app`, `.dmg` (**`.dmg` recommended**) |
| Linux    | webkit2gtk 4.1 (e.g., Ubuntu 22.04) | `aarch64`, `x86_64` | `.AppImage`, `.deb`, `.rpm`, portable binary |

## Windows 7

If you need to run SJMCL on Windows 7, please first [download the Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download) and install it. We recommend choosing the 'Evergreen Bootstrapper'.

## Install from Command Line

### Arch Linux

SJMCL is available on the Arch User Repository (AUR). You can install it using a common [AUR helper](https://wiki.archlinux.org/title/AUR_helpers):

```bash
yay -S sjmcl-bin
```

Manual installation without an AUR helper:

```bash
git clone https://aur.archlinux.org/sjmcl-bin.git
cd sjmcl-bin
makepkg -si
```
