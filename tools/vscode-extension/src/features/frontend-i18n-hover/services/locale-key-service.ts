import * as path from "path";
import * as vscode from "vscode";
import { LOCALE_SOURCE_GLOB } from "../config";
import { LocaleFileInfo } from "../types";

const POST_WRITE_SYNC_DELAY_MS = 200;
const PREVIEW_MAX_CHARS = 72;

export interface LocaleKeyLookup {
  exists: boolean;
  range: vscode.Range | undefined;
  preview: string | undefined;
}

export async function listLocaleFiles(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<LocaleFileInfo[]> {
  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, LOCALE_SOURCE_GLOB)
  );

  return files
    .map((uri) => ({
      locale: path.basename(uri.fsPath, path.extname(uri.fsPath)),
      uri,
    }))
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

export async function lookupLocaleKey(
  uri: vscode.Uri,
  scopedKey: string
): Promise<LocaleKeyLookup> {
  const document = await vscode.workspace.openTextDocument(uri);
  const root = safeParseJsonObject(document.getText());
  const range = findKeyRangeInDocument(document, scopedKey);
  if (!range) {
    return { exists: false, range: undefined, preview: undefined };
  }

  const value = root ? getPathValue(root, scopedKey.split(".")) : undefined;

  return {
    exists: true,
    range,
    preview: toPreviewText(value),
  };
}

export async function ensureLocaleKeyAndReveal(
  uri: vscode.Uri,
  scopedKey: string,
  leaf: boolean,
  createIfMissing: boolean
): Promise<void> {
  let document = await vscode.workspace.openTextDocument(uri);
  const text = document.getText();
  const root = safeParseJsonObject(text);

  if (!root) {
    throw new Error(`Cannot parse locale file: ${uri.fsPath}`);
  }

  const hasKeyBeforeCreate = scanJsonKeyOffsets(text).has(scopedKey);

  if (!hasKeyBeforeCreate && createIfMissing) {
    const created = ensurePath(root, scopedKey.split("."), leaf);
    if (!created) {
      throw new Error(
        `Cannot create key "${scopedKey}" because part of path is not an object.`
      );
    }

    const updated = `${JSON.stringify(root, null, 2)}\n`;
    await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, "utf8"));
    await delay(POST_WRITE_SYNC_DELAY_MS);
  }

  document = await vscode.workspace.openTextDocument(uri);
  const range = findKeyRangeInDocument(document, scopedKey);
  if (!range) {
    throw new Error(`Cannot locate locale key after update: ${scopedKey}`);
  }

  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
  });

  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(
    range,
    vscode.TextEditorRevealType.InCenterIfOutsideViewport
  );
}

function safeParseJsonObject(
  source: string
): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (isObjectRecord(parsed)) {
      return parsed;
    }
  } catch {
    // no-op
  }
  return undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getLastPathSegment(scopedKey: string): string {
  const segments = scopedKey.split(".");
  return segments[segments.length - 1];
}

function getPathValue(
  root: Record<string, unknown>,
  segments: string[]
): unknown | undefined {
  let current: unknown = root;

  for (const segment of segments) {
    if (!isObjectRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function toPreviewText(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  let text: string;
  if (typeof value === "string") {
    text = value.length > 0 ? value : '""';
  } else {
    text = JSON.stringify(value) ?? String(value);
  }

  const flattened = text.replace(/\s+/g, " ").trim();
  if (flattened.length <= PREVIEW_MAX_CHARS) {
    return flattened;
  }

  return `${flattened.slice(0, PREVIEW_MAX_CHARS - 1)}…`;
}

function findKeyRangeInDocument(
  document: vscode.TextDocument,
  scopedKey: string
): vscode.Range | undefined {
  const offsets = scanJsonKeyOffsets(document.getText());
  const offset = offsets.get(scopedKey);
  if (offset === undefined) {
    return undefined;
  }

  const keyName = getLastPathSegment(scopedKey);
  const start = document.positionAt(offset);
  const end = document.positionAt(offset + keyName.length);
  return new vscode.Range(start, end);
}

function ensurePath(
  root: Record<string, unknown>,
  segments: string[],
  leaf: boolean
): boolean {
  let current: Record<string, unknown> = root;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;
    const value = current[segment];

    if (isLast) {
      if (value === undefined) {
        current[segment] = leaf ? "" : {};
      }
      return true;
    }

    if (value === undefined) {
      const next: Record<string, unknown> = {};
      current[segment] = next;
      current = next;
      continue;
    }

    if (isObjectRecord(value)) {
      current = value;
      continue;
    }

    return false;
  }

  return true;
}

function scanJsonKeyOffsets(source: string): Map<string, number> {
  try {
    return new JsonKeyOffsetScanner(source).scan();
  } catch {
    return new Map<string, number>();
  }
}

class JsonKeyOffsetScanner {
  private index = 0;
  private readonly offsets = new Map<string, number>();

  constructor(private readonly source: string) {}

  scan(): Map<string, number> {
    this.skipWhitespace();
    this.parseValue([]);
    this.skipWhitespace();
    return this.offsets;
  }

  private parseValue(path: string[]): void {
    this.skipWhitespace();
    const ch = this.peek();

    if (ch === "{") {
      this.parseObject(path);
      return;
    }
    if (ch === "[") {
      this.parseArray(path);
      return;
    }
    if (ch === '"') {
      this.parseString();
      return;
    }
    if (ch === "-" || isDigit(ch)) {
      this.parseNumber();
      return;
    }
    if (this.source.startsWith("true", this.index)) {
      this.index += 4;
      return;
    }
    if (this.source.startsWith("false", this.index)) {
      this.index += 5;
      return;
    }
    if (this.source.startsWith("null", this.index)) {
      this.index += 4;
      return;
    }

    throw new Error("Invalid JSON value");
  }

  private parseObject(path: string[]): void {
    this.expect("{");
    this.skipWhitespace();

    if (this.peek() === "}") {
      this.index += 1;
      return;
    }

    while (this.index < this.source.length) {
      this.skipWhitespace();
      const keyOffset = this.index + 1;
      const key = this.parseString();
      const nextPath = [...path, key];
      this.offsets.set(nextPath.join("."), keyOffset);

      this.skipWhitespace();
      this.expect(":");
      this.parseValue(nextPath);
      this.skipWhitespace();

      const ch = this.peek();
      if (ch === ",") {
        this.index += 1;
        continue;
      }
      if (ch === "}") {
        this.index += 1;
        return;
      }

      throw new Error("Invalid JSON object");
    }
  }

  private parseArray(path: string[]): void {
    this.expect("[");
    this.skipWhitespace();

    if (this.peek() === "]") {
      this.index += 1;
      return;
    }

    while (this.index < this.source.length) {
      this.parseValue(path);
      this.skipWhitespace();

      const ch = this.peek();
      if (ch === ",") {
        this.index += 1;
        continue;
      }
      if (ch === "]") {
        this.index += 1;
        return;
      }

      throw new Error("Invalid JSON array");
    }
  }

  private parseString(): string {
    this.expect('"');
    let raw = "";

    while (this.index < this.source.length) {
      const ch = this.source[this.index];
      this.index += 1;

      if (ch === '"') {
        return JSON.parse(`"${raw}"`) as string;
      }

      if (ch === "\\") {
        if (this.index >= this.source.length) {
          throw new Error("Invalid JSON escape sequence");
        }

        const escaped = this.source[this.index];
        this.index += 1;
        raw += `\\${escaped}`;

        if (escaped === "u") {
          const hex = this.source.slice(this.index, this.index + 4);
          if (!/^[0-9A-Fa-f]{4}$/.test(hex)) {
            throw new Error("Invalid unicode escape");
          }
          raw += hex;
          this.index += 4;
        }

        continue;
      }

      raw += ch;
    }

    throw new Error("Unterminated JSON string");
  }

  private parseNumber(): void {
    const remaining = this.source.slice(this.index);
    const matched = remaining.match(
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/
    );

    if (!matched) {
      throw new Error("Invalid number");
    }

    this.index += matched[0].length;
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length) {
      const ch = this.source.charCodeAt(this.index);
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
        this.index += 1;
        continue;
      }
      break;
    }
  }

  private expect(expected: string): void {
    if (this.source[this.index] !== expected) {
      throw new Error(`Expected '${expected}'`);
    }
    this.index += 1;
  }

  private peek(): string {
    return this.source[this.index] ?? "";
  }
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
