import * as vscode from "vscode";

export interface FeatureContext {
  extensionContext: vscode.ExtensionContext;
  outputChannel: vscode.OutputChannel;
}

export interface ExtensionFeature {
  readonly id: string;
  activate(
    context: FeatureContext
  ):
    | void
    | vscode.Disposable
    | vscode.Disposable[]
    | Promise<void | vscode.Disposable | vscode.Disposable[]>;
}
