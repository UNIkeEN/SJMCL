const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Read package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8")
);

// Read tauri.conf.json
const tauriConfig = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../src-tauri/tauri.conf.json"),
    "utf8"
  )
);

// Read Cargo.toml
const cargoToml = fs.readFileSync(
  path.join(__dirname, "../../src-tauri/Cargo.toml"),
  "utf8"
);
const cargoVersion = cargoToml.match(/version\s*=\s*"([^"]+)"/)[1];

const versions = {
  "package.json": packageJson.version,
  "tauri.conf.json": tauriConfig.version,
  "Cargo.toml": cargoVersion,
};

console.log("Found versions:");
Object.entries(versions).forEach(([file, version]) => {
  console.log(`${file}: ${version}`);
});

// Check if all versions are the same
const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size !== 1) {
  console.error("\n❌ Version mismatch detected!");
  process.exit(1);
} else {
  console.log("\n✅ All versions match:", Object.values(versions)[0]);
}

// Check whether package-lock.json is in sync
try {
  execSync("git diff --exit-code package-lock.json");
  console.log("\n✅ package-lock.json is in sync");
} catch (error) {
  console.error("\n❌ package-lock.json is not in sync!");
  process.exit(1);
}
