import * as path from "path";
import * as vscode from "vscode";
import {
  COMMAND_OPEN_FRONTEND_I18N_LOCALE_KEY,
  FRONTEND_SOURCE_PREFIX,
} from "../config";
import { findTranslationKeySelectionAtPosition } from "../parsers/i18n-key-parser";
import {
  listLocaleFiles,
  lookupLocaleKey,
} from "../services/locale-key-service";
import { OpenLocaleKeyCommandArgs } from "../types";

export class FrontendI18nHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return undefined;
    }

    const relativePath = path
      .relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
      .replaceAll(path.sep, "/");

    if (!relativePath.startsWith(FRONTEND_SOURCE_PREFIX)) {
      return undefined;
    }

    const selection = findTranslationKeySelectionAtPosition(document, position);
    if (!selection) {
      return undefined;
    }

    const localeFiles = await listLocaleFiles(workspaceFolder);
    if (localeFiles.length === 0) {
      return undefined;
    }

    const markdown = new vscode.MarkdownString();
    markdown.supportThemeIcons = true;
    markdown.isTrusted = {
      enabledCommands: [COMMAND_OPEN_FRONTEND_I18N_LOCALE_KEY],
    };

    markdown.appendMarkdown(`**i18n Key Segment** \n\n`);
    markdown.appendMarkdown(
      `\`${selection.scopedKey}\` (${selection.segmentIndex + 1}/${selection.segments.length})\n\n***\n\n`
    );

    const isLeafSelection =
      selection.segmentIndex === selection.segments.length - 1;
    const localeItems: string[] = [];

    for (const localeFile of localeFiles) {
      const lookup = await lookupLocaleKey(localeFile.uri, selection.scopedKey);
      const commandLink = buildLocaleCommandLink({
        uri: localeFile.uri.toString(),
        locale: localeFile.locale,
        scopedKey: selection.scopedKey,
        leaf: selection.segmentIndex === selection.segments.length - 1,
        createIfMissing: !lookup.exists,
      });

      const label = lookup.exists
        ? localeFile.locale
        : `${localeFile.locale} (missing)`;
      if (isLeafSelection && lookup.exists) {
        const preview = lookup.preview ?? '""';
        localeItems.push(
          `[${escapeMarkdown(label)}](${commandLink}): ${escapeMarkdown(preview)}`
        );
      } else {
        localeItems.push(`[${escapeMarkdown(label)}](${commandLink})`);
      }
    }

    if (isLeafSelection) {
      markdown.appendMarkdown(localeItems.join("  \n"));
    } else {
      markdown.appendMarkdown("Go to " + localeItems.join(" | "));
    }

    return new vscode.Hover(markdown, selection.range);
  }
}

function buildLocaleCommandLink(args: OpenLocaleKeyCommandArgs): string {
  const query = encodeURIComponent(JSON.stringify([args]));
  return vscode.Uri.parse(
    `command:${COMMAND_OPEN_FRONTEND_I18N_LOCALE_KEY}?${query}`
  ).toString();
}

function escapeMarkdown(source: string): string {
  return source
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}
