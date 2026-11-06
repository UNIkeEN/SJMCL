{
  description = "SJMC Launcher";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];

      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system nixpkgs.legacyPackages.${system});

      linuxInputs =
        pkgs: with pkgs; [
          dbus
          expat
          fontconfig
          freetype
          glib-networking
          gsettings-desktop-schemas
          gtk3
          librsvg
          libsoup_3
          webkitgtk_4_1
        ];
    in
    {
      packages = forAllSystems (
        system: pkgs:
        let
          sjmcl = pkgs.rustPlatform.buildRustPackage (finalAttrs: {
            pname = "sjmcl";
            version = (pkgs.lib.importJSON ./package.json).version;

            src = self;

            cargoRoot = "src-tauri";
            buildAndTestSubdir = finalAttrs.cargoRoot;

            cargoHash = "sha256-nq5YHtHMSsABapor97wYcuqyIJucpHIP6brXM8gbWiE=";

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname version src;
              pnpm = pkgs.pnpm_10;
              fetcherVersion = 4;
              hash = "sha256-yHpqMch4iqEL/Mn/yw89isvBIQTJxP4tW1oGOe4IuxQ=";
            };

            nativeBuildInputs = with pkgs; [
              cargo-tauri.hook
              nodejs_24
              pkg-config
              pnpm_10
              pnpmConfigHook
              wrapGAppsHook3
            ];

            buildInputs = linuxInputs pkgs;

            env = {
              NEXT_TELEMETRY_DISABLED = "1";
              SJMCL_BUILD_TYPE = "release";
              SJMCL_COMMIT_SHA = self.rev or self.dirtyRev or "unknown";
              # The launcher prefers the runtime value, so CurseForge can still
              # be enabled by exporting the variable when launching the app.
              SJMCL_CURSEFORGE_API_KEY = "";
            };

            preFixup = ''
              gappsWrapperArgs+=(
                --prefix PATH : ${
                  pkgs.lib.makeBinPath [
                    pkgs.desktop-file-utils
                    pkgs.xdg-utils
                  ]
                }
              )
            '';

            # The upstream test workflow only performs a build; there is no test suite.
            doCheck = false;

            meta = {
              description = "A Minecraft launcher from SJMC";
              homepage = "https://mc.sjtu.cn/sjmcl";
              changelog = "https://github.com/UNIkeEN/SJMCL/releases";
              license = with pkgs.lib.licenses; [
                gpl3Only
                (mkLicense {
                  shortName = "SJMCL-additional-terms";
                  fullName = "SJMCL additional terms";
                  url = "https://github.com/UNIkeEN/SJMCL/blob/main/LICENSE.EXTRA";
                })
              ];
              mainProgram = "SJMCL";
              platforms = pkgs.lib.platforms.linux;
              sourceProvenance = [ pkgs.lib.sourceTypes.fromSource ];
            };
          });
        in
        {
          inherit sjmcl;
          default = sjmcl;
        }
      );

      apps = forAllSystems (
        system: _: {
          default = {
            type = "app";
            program = nixpkgs.lib.getExe self.packages.${system}.sjmcl;
            meta.description = "Launch SJMC Launcher";
          };
        }
      );

      devShells = forAllSystems (
        system: pkgs: {
          default = pkgs.mkShell {
            packages = with pkgs; [
              cargo
              clippy
              nodejs_24
              pkg-config
              pnpm_10
              rust-analyzer
              rustc
              rustfmt
            ];

            buildInputs = linuxInputs pkgs;

            RUST_SRC_PATH = "${pkgs.rustPlatform.rustLibSrc}";

            shellHook = ''
              export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:''${XDG_DATA_DIRS:-/run/current-system/sw/share}"
            '';
          };
        }
      );

      formatter = forAllSystems (_: pkgs: pkgs.nixfmt);
    };
}
