const fs = require("fs");
const https = require("https");
const path = require("path");

const url = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

// Resolve output path relative to the script location
const outputPath = path.resolve(
  __dirname,
  "../../src-tauri/assets/game/versions.txt"
);

https
  .get(url, (res) => {
    if (res.statusCode !== 200) {
      console.error(`Request failed with status code: ${res.statusCode}`);
      return;
    }
    let data = "";

    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        const versions = json.versions
          .map((v) => ({
            id: v.id,
            timestamp: new Date(v.releaseTime).getTime(),
          }))
          .sort((a, b) => {
            if (a.timestamp === b.timestamp) {
              // If release times are the same, sort by "id" in ascending order
              return a.id.localeCompare(b.id);
            } else {
              // Otherwise, sort by release time in ascending order
              return a.timestamp - b.timestamp;
            }
          });
        const versionIds = versions.map((v) => v.id);
        const text = versionIds.join("\n") + "\n";

        // Ensure the directory exists
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        fs.writeFileSync(outputPath, text);
        console.log(`Version list saved to: ${outputPath}`);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    });
  })
  .on("error", (err) => {
    console.error("Error fetching data:", err);
  });
