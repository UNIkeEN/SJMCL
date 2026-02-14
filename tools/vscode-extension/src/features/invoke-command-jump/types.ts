import * as vscode from "vscode";

export interface TauriCommandDefinition {
  name: string;
  uri: vscode.Uri;
  range: vscode.Range;
}

export interface InvokeCommandMatch {
  commandName: string;
  range: vscode.Range;
}
