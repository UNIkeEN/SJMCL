import * as vscode from "vscode";
import { InvokeCommandMatch } from "../types";

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findInvokeCommandAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
  invokeFunctionNames: readonly string[]
): InvokeCommandMatch | undefined {
  if (invokeFunctionNames.length === 0) {
    return undefined;
  }

  const escapedNames = invokeFunctionNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map(escapeRegExp);

  if (escapedNames.length === 0) {
    return undefined;
  }

  const source = document.getText();
  const positionOffset = document.offsetAt(position);
  const pattern = new RegExp(
    `\\b(?:${escapedNames.join(
      "|"
    )})(?:\\s*<[^>\\n]+>)?\\s*\\(\\s*(['"\`])([A-Za-z_][A-Za-z0-9_]*)\\1`,
    "g"
  );

  for (const match of source.matchAll(pattern)) {
    const matchedText = match[0];
    const quote = match[1];
    const commandName = match[2];
    const fullMatchOffset = match.index;

    if (
      matchedText === undefined ||
      quote === undefined ||
      commandName === undefined ||
      fullMatchOffset === undefined
    ) {
      continue;
    }

    const literalText = `${quote}${commandName}${quote}`;
    const literalOffset = matchedText.indexOf(literalText);
    if (literalOffset < 0) {
      continue;
    }

    const commandStart = fullMatchOffset + literalOffset + 1;
    const commandEnd = commandStart + commandName.length;

    if (positionOffset >= commandStart && positionOffset <= commandEnd) {
      return {
        commandName,
        range: new vscode.Range(
          document.positionAt(commandStart),
          document.positionAt(commandEnd)
        ),
      };
    }
  }

  return undefined;
}
