import * as vscode from "vscode";
import { ExtensionFeature, FeatureContext } from "./feature";

export class FeatureRunner implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly features: ExtensionFeature[]) {}

  async activate(context: FeatureContext): Promise<void> {
    for (const feature of this.features) {
      try {
        const result = await feature.activate(context);
        if (Array.isArray(result)) {
          this.disposables.push(...result);
        } else if (result) {
          this.disposables.push(result);
        }
      } catch (error) {
        context.outputChannel.appendLine(
          `[${feature.id}] activation failed: ${formatError(error)}`
        );
      }
    }
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}
