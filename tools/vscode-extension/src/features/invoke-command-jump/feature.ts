import * as vscode from "vscode";

import { ExtensionFeature, FeatureContext } from "../../core/feature";
import { WorkspaceIndexManager } from "./index/workspace-index-manager";
import { InvokeDefinitionProvider } from "./providers/invoke-definition-provider";
import {
  COMMAND_REBUILD_INVOKE_COMMAND_INDEX,
  INVOKE_COMMAND_JUMP_FEATURE_ID,
  SUPPORTED_LANGUAGES,
} from "./config";

export class InvokeCommandJumpFeature implements ExtensionFeature {
  readonly id = INVOKE_COMMAND_JUMP_FEATURE_ID;

  async activate(context: FeatureContext): Promise<vscode.Disposable[]> {
    if (!vscode.workspace.workspaceFolders?.length) {
      return [];
    }

    const disposables: vscode.Disposable[] = [];
    const indexManager = new WorkspaceIndexManager();
    await indexManager.initialize();

    disposables.push(indexManager);

    const definitionProvider = new InvokeDefinitionProvider(indexManager);

    for (const language of SUPPORTED_LANGUAGES) {
      disposables.push(
        vscode.languages.registerDefinitionProvider(
          { language, scheme: "file" },
          definitionProvider
        )
      );
    }

    disposables.push(
      vscode.commands.registerCommand(
        COMMAND_REBUILD_INVOKE_COMMAND_INDEX,
        async () => {
        await indexManager.rebuildAll();
        void vscode.window.showInformationMessage(
            "SJMCL Dev Extension: Invoke command index rebuilt."
        );
        }
      )
    );

    context.outputChannel.appendLine(
      `[${this.id}] activated with ${SUPPORTED_LANGUAGES.length} language providers`
    );

    return disposables;
  }
}
