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
  fs.readFile(sourceFile, "utf8", (readErr, data) => {
    if (readErr) {
      console.error(`Error reading file ${sourceFile}:`, readErr);
      process.exit(1);
    }

    let localeData;
    try {
      localeData = JSON.parse(data);
    } catch (parseErr) {
      console.error(`Error parsing JSON from ${sourceFile}:`, parseErr);
      process.exit(1);
    }

    // Process the JSON to add placeholders
    const updatedData = addTodoPlaceholder(localeData);

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
        console.log(`Placeholder file generated: ${targetFile}`);
      }
    );
  });
}

// Parse command-line arguments (skip node and the script path)
const args = process.argv.slice(3);
console.log(args);
if (args.length < 2) {
  console.error("Usage: npm run locale genplaceholder <source> <target>");
  process.exit(1);
}

const [source, target] = args;
generatePlaceholder(source, target);
