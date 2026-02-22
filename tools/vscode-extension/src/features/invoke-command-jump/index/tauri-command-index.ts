import * as vscode from "vscode";
import { TextOffsetMapper } from "../../../shared/text-offset-mapper";
import { TAURI_SOURCE_EXCLUDE_GLOB, TAURI_SOURCE_GLOB } from "../config";
import { TauriCommandDefinition } from "../types";

const TAURI_COMMAND_AND_FN_PATTERN =
  /#\s*\[\s*tauri::command(?:\([^\)]*\))?\s*\][\s\S]*?(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

const FN_PATTERN = /fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
const GENERATE_HANDLER_PATTERN = /generate_handler!\s*\[([\s\S]*?)\]/g;
const GENERATE_HANDLER_ENTRY_PATTERN = /([A-Za-z_][A-Za-z0-9_:]*)\s*,/g;

export class TauriCommandIndex implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly commandMap = new Map<string, TauriCommandDefinition[]>();
  private rebuildTimer: NodeJS.Timeout | undefined;

  constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {}

  async initialize(): Promise<void> {
    await this.rebuild();
    this.setupWatchers();
  }

  dispose(): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = undefined;
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables.length = 0;
    this.commandMap.clear();
  }

  getDefinitions(commandName: string): TauriCommandDefinition[] {
    return this.commandMap.get(commandName) ?? [];
  }

  async rebuild(): Promise<void> {
    const include = new vscode.RelativePattern(
      this.workspaceFolder,
      TAURI_SOURCE_GLOB
    );
    const rustFiles = await vscode.workspace.findFiles(
      include,
      TAURI_SOURCE_EXCLUDE_GLOB
    );

    const discoveredCommands: TauriCommandDefinition[] = [];
    const registeredCommands = new Set<string>();

    for (const uri of rustFiles) {
      const contentBuffer = await vscode.workspace.fs.readFile(uri);
      const source = Buffer.from(contentBuffer).toString("utf8");

      collectGenerateHandlerCommands(source, registeredCommands);
      discoveredCommands.push(...collectTauriCommandDefinitions(uri, source));
    }

    const shouldFilterByGenerateHandler = registeredCommands.size > 0;
    const nextMap = new Map<string, TauriCommandDefinition[]>();

    for (const command of discoveredCommands) {
      if (
        shouldFilterByGenerateHandler &&
        !registeredCommands.has(command.name)
      ) {
        continue;
      }

      const existed = nextMap.get(command.name);
      if (existed) {
        existed.push(command);
      } else {
        nextMap.set(command.name, [command]);
      }
    }

    this.commandMap.clear();
    for (const [name, definitions] of nextMap.entries()) {
      this.commandMap.set(name, definitions);
    }
  }

  private setupWatchers(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceFolder, TAURI_SOURCE_GLOB)
    );

    this.disposables.push(watcher);

    this.disposables.push(
      watcher.onDidCreate(() => this.scheduleRebuild()),
      watcher.onDidChange(() => this.scheduleRebuild()),
      watcher.onDidDelete(() => this.scheduleRebuild())
    );
  }

  private scheduleRebuild(): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
    }

    this.rebuildTimer = setTimeout(() => {
      void this.rebuild();
    }, 250);
  }
}

function collectGenerateHandlerCommands(
  source: string,
  output: Set<string>
): void {
  for (const match of source.matchAll(GENERATE_HANDLER_PATTERN)) {
    const body = match[1];
    if (!body) {
      continue;
    }

    for (const entryMatch of body.matchAll(GENERATE_HANDLER_ENTRY_PATTERN)) {
      const entry = entryMatch[1];
      if (!entry) {
        continue;
      }

      const commandName = entry.split("::").at(-1);
      if (commandName) {
        output.add(commandName);
      }
    }
  }
}

function collectTauriCommandDefinitions(
  uri: vscode.Uri,
  source: string
): TauriCommandDefinition[] {
  const mapper = new TextOffsetMapper(source);
  const definitions: TauriCommandDefinition[] = [];

  for (const match of source.matchAll(TAURI_COMMAND_AND_FN_PATTERN)) {
    const commandName = match[1];
    const fullMatch = match[0];
    const fullMatchStart = match.index;
    if (!commandName || !fullMatch || fullMatchStart === undefined) {
      continue;
    }

    const fnMatch = FN_PATTERN.exec(fullMatch);
    if (!fnMatch || fnMatch.index === undefined) {
      continue;
    }

    const fnName = fnMatch[1];
    if (!fnName) {
      continue;
    }

    const fnNameOffsetInFnMatch = fnMatch[0].indexOf(fnName);
    if (fnNameOffsetInFnMatch < 0) {
      continue;
    }

    const commandNameOffset =
      fullMatchStart + fnMatch.index + fnNameOffsetInFnMatch;

    const start = mapper.toPosition(commandNameOffset);
    const end = mapper.toPosition(commandNameOffset + fnName.length);

    definitions.push({
      name: commandName,
      uri,
      range: new vscode.Range(start, end),
    });
  }

  return definitions;
}
