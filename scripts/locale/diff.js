#!/usr/bin/env node
/**
 * This script compares locale JSON files, checking for missing or extra keys
 * compared to a reference locale file.
 *
 * Usage:
 *   npm run locale diff <base_locale> <target_locales>
 *   e.g. npm run locale diff en zh-Hans
 *
 * Parameters:
 *   base_locale (optional) : str, defaults to zh-Hans, the base language
 *   which determines the reference locale file against which all other locale files will be compared.
 *   target_locales (optional) : str divided by spaces(can be multiple args)
 *   every target locale in target_locales(if not empty) will be compared with base_locale
 *   if target locale is empty, then all other locales will be checked.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

try {
  const arg = process.argv[3];
  if (arg.includes("/") || arg.match(/\.json$/)) {
    base = arg.split("/").pop().replace(".json", "");
  } else {
    base = arg || "zh-Hans";
  }
} catch (error) {
  base = "zh-Hans";
}

let targets = process.argv.slice(4);
if (targets !== null && targets.length !== 0) {
  for (let i = 0; i < targets.length; i++) {
    let target = targets[i];
    if (target.includes("/") || target.match(/\.json$/)) {
      target = target.split("/").pop().replace(".json", "");
    }
    targets[i] = target;
  }

  targets = targets.filter((target) => target !== base); // delete item same as base
  targets = [...new Set(targets)]; // delete duplicate item
  if (targets.length === 0) {
    console.log(
      "The target language is provided, but it is identical to the base language. Exiting..."
    );
    process.exit(0);
  }
}

function flattenDict(obj, parentKey = "") {
  const items = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        items.push(...flattenDict(value, newKey));
      } else {
        items.push(newKey);
      }
    }
  }
  return items;
}

function loadLocaleFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}
function compareKeys(baseKeys, targetKeys) {
  const baseSet = new Set(baseKeys);
  const targetSet = new Set(targetKeys);
  const missing = [...baseSet].filter((k) => !targetSet.has(k)).sort();
  const extra = [...targetSet].filter((k) => !baseSet.has(k)).sort();
  return [missing, extra];
}
function checkTodoValues(locale, localeName) {
  const todoValues = [];

  function recursiveCheck(obj, parentKey = "") {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        if (typeof value === "string" && value.startsWith("%TODO")) {
          todoValues.push(fullKey);
        } else if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          recursiveCheck(value, fullKey);
        }
      }
    }
  }

  recursiveCheck(locale);

  if (todoValues.length > 0) {
    console.log(
      chalk.hex("#FFA500")(
        `⚠️ Warning: '${localeName}.json' contains %TODO values:`
      )
    );
    todoValues.forEach((key) => {
      console.log(chalk.yellow(`  %TODO found: ${key}`));
    });
    throw new Error("  %TODO values detected");
  }
}

function compareLocales(base, target) {
  const localesPath = path.join(path.resolve(__dirname), `../../src/locales/`);

  const baseLocalePath = path.join(localesPath, `${base}.json`);
  const baseLocale = loadLocaleFile(baseLocalePath);
  const baseKeys = flattenDict(baseLocale).sort();

  const targetLocalePath = path.join(localesPath, `${target}.json`);
  if (!fs.existsSync(targetLocalePath)) {
    console.log(`Locale file '${target}.json' not found in: ${localesPath}`);
    return;
  }
  const targetLocale = loadLocaleFile(targetLocalePath);
  const targetKeys = flattenDict(targetLocale).sort();

  const [missing, extra] = compareKeys(baseKeys, targetKeys);

  if (missing.length === 0 && extra.length === 0) {
    console.log(
      chalk.green(`✅ '${target}.json' is identical to '${base}.json'.`)
    );
  } else {
    console.log(`Comparing ${target} to ${base}:`);
    console.log(`${missing.length} missing, ${extra.length} extra keys`);

    missing.forEach((key) => {
      console.log(chalk.red(`  Missing:   ${key}`));
    });
    extra.forEach((key) => {
      console.log(chalk.green(`  Extra:     ${key}`));
    });

    throw new Error("  Inconsistent locales detected");
  }

  checkTodoValues(targetLocale, target);

  console.log("-".repeat(40));
}

function compareAll(baseLocaleName) {
  const localesPath = path.join(path.resolve(__dirname), `../../src/locales/`);
  const baseLocalePath = path.join(localesPath, `${baseLocaleName}.json`);

  if (!fs.existsSync(baseLocalePath)) {
    console.log(
      `Locale file '${baseLocaleName}.json' not found in: ${localesPath}`
    );
    return;
  }

  fs.readdirSync(localesPath).forEach((fileName) => {
    if (fileName.endsWith(".json") && fileName !== `${baseLocaleName}.json`) {
      const targetLocaleName = fileName.replace(".json", "");
      compareLocales(baseLocaleName, targetLocaleName);
    }
  });
}

if (targets == null || targets.length === 0) {
  compareAll(base);
} else {
  targets.forEach((target) => compareLocales(base, target));
}
