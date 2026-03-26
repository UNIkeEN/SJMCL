const fs = require("fs");
const path = require("path");

// Recursively remove keys from target that don't exist in source
function removeExtraKeys(source, target) {
  // If target is not an object, return it as-is
  if (typeof target !== "object" || target === null || Array.isArray(target)) {
    return target;
  }

  // If source is not an object structure, but target is an object,
  // return empty object to prune all keys in target
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    return {};
  }

  const result = {};

  // Only keep keys that exist in source
  for (const key in target) {
    if (key in source) {
      // If target is an object (not array), recursively process it
      if (
        typeof target[key] === "object" &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        result[key] = removeExtraKeys(source[key], target[key]);
      } else {
        // Keep the target value as-is
        result[key] = target[key];
      }
    }
    // If key doesn't exist in source, it will be omitted (deleted)
  }

  return result;
}

function removeRedundantKeys(source, target) {
  // Define paths for source and target locale files
  const sourceFile = path.join(
    __dirname,
    "..",
    "..",
    "src",
    "locales",
    `${source}.json`
  );
  const targetFile = path.join(
    __dirname,
    "..",
    "..",
    "src",
    "locales",
    `${target}.json`
  );

  // Read the source file
  fs.readFile(sourceFile, "utf8", (readErr, sourceData) => {
    if (readErr) {
      console.error(`Error reading file ${sourceFile}:`, readErr);
      process.exit(1);
    }

    let sourceLocaleData;
    try {
      sourceLocaleData = JSON.parse(sourceData);
    } catch (parseErr) {
      console.error(`Error parsing JSON from ${sourceFile}:`, parseErr);
      process.exit(1);
    }

    // Check if target file exists
    fs.access(targetFile, fs.constants.F_OK, (err) => {
      if (err) {
        console.error(`Target file does not exist: ${targetFile}`);
        process.exit(1);
      }

      // Read the target file
      fs.readFile(targetFile, "utf8", (readErr, targetData) => {
        if (readErr) {
          console.error(`Error reading file ${targetFile}:`, readErr);
          process.exit(1);
        }

        let targetLocaleData;
        try {
          targetLocaleData = JSON.parse(targetData);
        } catch (parseErr) {
          console.error(`Error parsing JSON from ${targetFile}:`, parseErr);
          process.exit(1);
        }

        // Remove keys from target that don't exist in source
        const cleanedData = removeExtraKeys(sourceLocaleData, targetLocaleData);

        // Write the cleaned JSON to the target file
        fs.writeFile(
          targetFile,
          JSON.stringify(cleanedData, null, 2),
          "utf8",
          (writeErr) => {
            if (writeErr) {
              console.error(`Error writing file ${targetFile}:`, writeErr);
              process.exit(1);
            }
            console.log(
              `Extra keys removed from ${target}.json (keys not in ${source}.json)`
            );
          }
        );
      });
    });
  });
}

// Parse command-line arguments (skip node and the script path)
const args = process.argv.slice(3);
if (args.length < 2) {
  console.error("Usage: npm run locale rm_redundancy <source> <target>");
  process.exit(1);
}

const [source, target] = args;
removeRedundantKeys(source, target);
