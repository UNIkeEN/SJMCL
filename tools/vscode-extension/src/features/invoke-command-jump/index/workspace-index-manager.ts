import * as vscode from "vscode";

import { TauriCommandDefinition } from "../types";
import { TauriCommandIndex } from "./tauri-command-index";

export class WorkspaceIndexManager implements vscode.Disposable {
  private readonly indexes = new Map<string, TauriCommandIndex>();
  private readonly disposables: vscode.Disposable[] = [];

  async initialize(): Promise<void> {
    await this.syncWorkspaceIndexes();

    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void this.syncWorkspaceIndexes();
      })
    );
  }

  dispose(): void {
    for (const index of this.indexes.values()) {
      index.dispose();
    }

    this.indexes.clear();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables.length = 0;
  }

  async rebuildAll(): Promise<void> {
    await Promise.all(
      Array.from(this.indexes.values()).map((index) => index.rebuild())
    );
  }

  getDefinitions(commandName: string): TauriCommandDefinition[] {
    const definitions: TauriCommandDefinition[] = [];
    for (const index of this.indexes.values()) {
      definitions.push(...index.getDefinitions(commandName));
    }
    return definitions;
  }

  private async syncWorkspaceIndexes(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const expectedFolderKeys = new Set(
      folders.map((folder) => folder.uri.toString())
    );

    for (const [folderKey, index] of this.indexes.entries()) {
      if (!expectedFolderKeys.has(folderKey)) {
        index.dispose();
        this.indexes.delete(folderKey);
      }
    }

    for (const folder of folders) {
      const folderKey = folder.uri.toString();
      if (this.indexes.has(folderKey)) {
        continue;
      }

      const index = new TauriCommandIndex(folder);
      this.indexes.set(folderKey, index);
      await index.initialize();
    }
  }
}
