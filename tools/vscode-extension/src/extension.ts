import * as vscode from "vscode";
import { FeatureContext } from "./core/feature";
import { FeatureRunner } from "./core/feature-runner";
import { FrontendI18nHoverFeature } from "./features/frontend-i18n-hover/feature";
import { InvokeCommandJumpFeature } from "./features/invoke-command-jump/feature";

let runner: FeatureRunner | undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel(
    "SJMCL Dev Extension"
  );
  context.subscriptions.push(outputChannel);

  const featureContext: FeatureContext = {
    extensionContext: context,
    outputChannel,
  };

  runner = new FeatureRunner([
    new InvokeCommandJumpFeature(),
    new FrontendI18nHoverFeature(),
  ]);
  context.subscriptions.push(runner);
  await runner.activate(featureContext);
}

export function deactivate(): void {
  runner?.dispose();
  runner = undefined;
}
