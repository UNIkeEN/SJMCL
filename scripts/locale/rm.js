#!/usr/bin/env node
/**
 * This script removes specified keys from locale JSON files.
 * Supports removing single keys or entire subtrees using dot notation.
 *
 * Usage:
 *   npm run locale rm <key_path> [locales]
 *   e.g.
 *     npm run locale rm common.save zh-Hans      # Remove from specific locale
 *     npm run locale rm component.button         # Remove from all locales
 *
 * Parameters:
 *   key_path : str (required) - Dot-separated path to the key/subtree to remove
 *   locales  : str (optional) - Space-separated list of locale codes to target
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const keyPath = process.argv[3];
if (!keyPath) {
  console.error(chalk.red("Error: Missing key path argument"));
  console.log("Usage: npm run locale rm <key_path> [locales]");
  process.exit(1);
}

const rawLocales = process.argv.slice(4);
const localesPath = path.resolve(__dirname, "../../src/locales");

let targetLocales = [];
if (rawLocales.length > 0) {
  targetLocales = [...new Set(rawLocales)] // Remove duplicates
    .map((locale) => {
      // Extract pure locale code if path is provided
      if (locale.includes("/") || locale.endsWith(".json")) {
        return locale.split("/").pop().replace(".json", "");
      }
      return locale;
    })
    .filter((locale) => locale !== "");
} else {
  targetLocales = fs
    .readdirSync(localesPath)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(".json", ""));
}

if (targetLocales.length === 0) {
  console.error(chalk.red("Error: No valid locales specified"));
  process.exit(1);
}

/**
 * Removes a key path from an object and prunes empty parent objects
 * @param {Object} obj - Target object to modify
 * @param {string} path - Dot-separated key path (e.g. 'a.b.c')
 * @returns {boolean} True if any changes were made
 */
function removeKeyPath(obj, path) {
  const keys = path.split(".");
  let current = obj;
  let changed = false;
  const stack = [];

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== "object") {
      return false;
    }
    stack.push({ obj: current, key });
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  if (current.hasOwnProperty(lastKey)) {
    delete current[lastKey];
    changed = true;

    while (stack.length > 0) {
      const { obj, key } = stack.pop();
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key];
      } else {
        break;
      }
    }
  }

  return changed;
}

/**
 * Processes a locale file by removing the specified key path
 * @param {string} locale - Locale code (e.g. 'zh-Hans')
 */
function processLocale(locale) {
  const filePath = path.join(localesPath, `${locale}.json`);

  if (!fs.existsSync(filePath)) {
    console.warn(chalk.yellow(`⚠️  Locale not found: ${locale}.json`));
    return;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const localeObj = JSON.parse(content);

    const changed = removeKeyPath(localeObj, keyPath);

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(localeObj, null, 2) + "\n");
      console.log(chalk.green(`✅ Removed '${keyPath}' from ${locale}.json`));
    } else {
      console.log(chalk.dim(`- Key '${keyPath}' not found in ${locale}.json`));
    }
  } catch (error) {
    console.error(chalk.red(`Error processing ${locale}.json:`), error.message);
  }
}

console.log(chalk.bold(`Removing key path: '${keyPath}'`));
console.log(chalk.dim(`Target locales: ${targetLocales.join(", ")}`));
console.log("-".repeat(40));

targetLocales.forEach(processLocale);

console.log("-".repeat(40));
console.log(chalk.bold("Operation completed"));
