// scripts/index.js
const path = require("path");

const subCommand = process.argv[2];

if (!subCommand) {
  console.error("Please specify a subcommand for version (check or bump)");
  process.exit(1);
}

try {
  const args = process.argv.slice(4); // Get any additional arguments
  require(path.join(__dirname, `${subCommand}.js`));
} catch (error) {
  if (error.code === "MODULE_NOT_FOUND") {
    console.error(`Unknown subcommand: ${subCommand}`);
    console.error("Available subcommands: check, bump");
  } else {
    console.error(error);
  }
  process.exit(1);
}
