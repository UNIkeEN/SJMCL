import * as vscode from "vscode";
import { INVOKE_FUNCTION_NAMES } from "../config";
import { WorkspaceIndexManager } from "../index/workspace-index-manager";
import { findInvokeCommandAtPosition } from "../parsers/invoke-parser";

export class InvokeDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly indexManager: WorkspaceIndexManager) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
    const match = findInvokeCommandAtPosition(
      document,
      position,
      INVOKE_FUNCTION_NAMES
    );

    if (!match) {
      return undefined;
    }

    const definitions = this.indexManager.getDefinitions(match.commandName);
    if (definitions.length === 0) {
      return undefined;
    }

    return definitions.map(
      (definition) => new vscode.Location(definition.uri, definition.range)
    );
  }
}
