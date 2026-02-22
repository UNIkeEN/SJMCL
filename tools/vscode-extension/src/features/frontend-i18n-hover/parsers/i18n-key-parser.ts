import * as vscode from "vscode";
import { TranslationKeySelection } from "../types";

const T_CALL_PATTERN = /\bt\s*\(\s*(['"`])([A-Za-z0-9_.-]+)\1/g;

export function findTranslationKeySelectionAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): TranslationKeySelection | undefined {
  const source = document.getText();
  const positionOffset = document.offsetAt(position);

  for (const match of source.matchAll(T_CALL_PATTERN)) {
    const matchedText = match[0];
    const quote = match[1];
    const fullKey = match[2];
    const fullMatchOffset = match.index;

    if (
      matchedText === undefined ||
      quote === undefined ||
      fullKey === undefined ||
      fullMatchOffset === undefined
    ) {
      continue;
    }

    const literalText = `${quote}${fullKey}${quote}`;
    const literalOffset = matchedText.indexOf(literalText);
    if (literalOffset < 0) {
      continue;
    }

    const keyStart = fullMatchOffset + literalOffset + 1;
    const keyEnd = keyStart + fullKey.length;
    if (positionOffset < keyStart || positionOffset > keyEnd) {
      continue;
    }

    const segment = resolveSegmentAtOffset(fullKey, positionOffset - keyStart);
    if (!segment) {
      continue;
    }

    const segmentStart = keyStart + segment.start;
    const segmentEnd = keyStart + segment.end;
    const scopedKey = segment.segments
      .slice(0, segment.segmentIndex + 1)
      .join(".");

    return {
      fullKey,
      segments: segment.segments,
      segmentIndex: segment.segmentIndex,
      scopedKey,
      selectedSegment: segment.segments[segment.segmentIndex],
      range: new vscode.Range(
        document.positionAt(segmentStart),
        document.positionAt(segmentEnd)
      ),
    };
  }

  return undefined;
}

function resolveSegmentAtOffset(
  key: string,
  rawOffset: number
):
  | {
      segments: string[];
      segmentIndex: number;
      start: number;
      end: number;
    }
  | undefined {
  if (key.length === 0) {
    return undefined;
  }

  const segments = key.split(".");
  if (segments.some((segment) => segment.length === 0)) {
    return undefined;
  }

  let offset = Math.min(Math.max(rawOffset, 0), key.length - 1);
  while (offset > 0 && key[offset] === ".") {
    offset -= 1;
  }
  if (key[offset] === ".") {
    return undefined;
  }

  let cursor = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const start = cursor;
    const end = start + segment.length;
    if (offset >= start && offset <= end) {
      return {
        segments,
        segmentIndex: index,
        start,
        end,
      };
    }
    cursor = end + 1;
  }

  return undefined;
}
