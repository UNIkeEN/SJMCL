const fs = require("fs");
const path = require("path");

const newVersion = process.argv[3];

if (!newVersion) {
  console.error("Usage: npm run version bump <new-version>");
  process.exit(1);
}

// Update package.json
const packageJsonPath = path.join(__dirname, "../../package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

// Update tauri.conf.json
const tauriConfigPath = path.join(__dirname, "../../src-tauri/tauri.conf.json");
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
tauriConfig.version = newVersion;
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + "\n");

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, "../../src-tauri/Cargo.toml");
let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
cargoToml = cargoToml.replace(
  /version\s*=\s*"[^"]+"/,
  `version = "${newVersion}"`
);
fs.writeFileSync(cargoTomlPath, cargoToml);

console.log(`✅ Updated all version numbers to ${newVersion}`);
