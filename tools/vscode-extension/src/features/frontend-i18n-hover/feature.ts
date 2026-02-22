import * as vscode from "vscode";
import { ExtensionFeature, FeatureContext } from "../../core/feature";
import {
  COMMAND_OPEN_FRONTEND_I18N_LOCALE_KEY,
  FRONTEND_I18N_HOVER_FEATURE_ID,
  SUPPORTED_LANGUAGES,
} from "./config";
import { FrontendI18nHoverProvider } from "./providers/frontend-i18n-hover-provider";
import { ensureLocaleKeyAndReveal } from "./services/locale-key-service";
import { OpenLocaleKeyCommandArgs } from "./types";

export class FrontendI18nHoverFeature implements ExtensionFeature {
  readonly id = FRONTEND_I18N_HOVER_FEATURE_ID;

  activate(_context: FeatureContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    const hoverProvider = new FrontendI18nHoverProvider();

    for (const language of SUPPORTED_LANGUAGES) {
      disposables.push(
        vscode.languages.registerHoverProvider(
          { language, scheme: "file" },
          hoverProvider
        )
      );
    }

    disposables.push(
      vscode.commands.registerCommand(
        COMMAND_OPEN_FRONTEND_I18N_LOCALE_KEY,
        async (args: OpenLocaleKeyCommandArgs) => {
          if (!args?.uri || !args?.scopedKey) {
            return;
          }

          try {
            await ensureLocaleKeyAndReveal(
              vscode.Uri.parse(args.uri),
              args.scopedKey,
              args.leaf,
              args.createIfMissing
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(
              `SJMCL Dev Extension: ${message}`
            );
          }
        }
      )
    );

    return disposables;
  }
}
