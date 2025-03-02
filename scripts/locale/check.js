const fs = require("fs");
const chalk = require("chalk");

// Recursively check if any string in the JSON contains "$TODO"
function containsTodo(item) {
  if (typeof item === "string") {
    return item.includes("%TODO");
  }
  if (Array.isArray(item)) {
    return item.some(containsTodo);
  }
  if (typeof item === "object" && item !== null) {
    return Object.values(item).some(containsTodo);
  }
  return false;
}

function checkFileForTodo(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(data);
    if (containsTodo(jsonData)) {
      const errorMessage = `Error: File ${filePath} contains %TODO`;
      console.error(chalk.hex("#FFA500")(errorMessage));
      throw new Error(errorMessage);
    } else {
      console.log(`File ${filePath} passed the check.`);
    }
  } catch (err) {
    // If there's a file read/parse error, output it in orange as well
    console.error(
      chalk.hex("#FFA500")(`Error processing file ${filePath}: ${err.message}`)
    );
    throw err;
  }
}

// Get file paths from command line arguments (skipping node and script path)
const files = process.argv.slice(3);

if (files.length === 0) {
  console.error(
    chalk.hex("#FFA500")(
      "Please provide one or more locale JSON file paths as arguments."
    )
  );
  process.exit(1);
}

files.forEach((filePath) => {
  checkFileForTodo(filePath);
});

console.log("All files checked without any $TODO token.");
