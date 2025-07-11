const fs = require("fs");
const path = require("path");

// Recursively add "%TODO " to all string values
function addTodoPlaceholder(value) {
  if (typeof value === "string") {
    // Prepend "%TODO " if not already present
    return value.startsWith("%TODO") ? value : `%TODO ${value}`;
  }
  if (Array.isArray(value)) {
    return value.map(addTodoPlaceholder);
  }
  if (typeof value === "object" && value !== null) {
    const result = {};
    for (const key in value) {
      result[key] = addTodoPlaceholder(value[key]);
    }
    return result;
  }
  // Return value as-is if not a string, array, or object
  return value;
}

function mergeWithPlaceholder(source, target) {
  const result = { ...target };
  for (const key in source) {
    // If key doesn't exist in target, add it with placeholder
    if (!(key in target)) {
      result[key] = addTodoPlaceholder(source[key]);
    }
    // If both are objects, recursively merge them
    else if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = mergeWithPlaceholder(source[key], target[key]);
    }
  }
  return result;
}

function generatePlaceholder(source, target) {
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
        // Target file doesn't exist, create it with all placeholders
        const placeholderData = addTodoPlaceholder(sourceLocaleData);
        fs.writeFile(
          targetFile,
          JSON.stringify(placeholderData, null, 2),
          "utf8",
          (writeErr) => {
            if (writeErr) {
              console.error(`Error creating file ${targetFile}:`, writeErr);
              process.exit(1);
            }
            console.log(`New placeholder file created: ${targetFile}`);
          }
        );
      } else {
        // Target file exists, read and update it
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

          const updatedData = mergeWithPlaceholder(
            sourceLocaleData,
            targetLocaleData
          );

          // Write the updated JSON to the target file
          fs.writeFile(
            targetFile,
            JSON.stringify(updatedData, null, 2),
            "utf8",
            (writeErr) => {
              if (writeErr) {
                console.error(`Error writing file ${targetFile}:`, writeErr);
                process.exit(1);
              }
              console.log(`Placeholder file updated: ${targetFile}`);
            }
          );
        });
      }
    });
  });
}

// Parse command-line arguments (skip node and the script path)
const args = process.argv.slice(3);
if (args.length < 2) {
  console.error("Usage: npm run locale genplaceholder <source> <target>");
  process.exit(1);
}

const [source, target] = args;
generatePlaceholder(source, target);
