import { ToolCallStatus } from "@/enums/tool-call";
import { ToolCallParseResult } from "@/models/intelligence/tool-call";

export const TOOL_CALL_MARKER = "::tool::";
export const LEGACY_FUNCTION_CALL_MARKER = "::function::";

/**
 * Finds all tool calls in the given content.
 * Handles nested braces for JSON parsing.
 */
export function findToolCalls(content: string): ToolCallParseResult[] {
  const matches: ToolCallParseResult[] = [];
  const markers = [TOOL_CALL_MARKER, LEGACY_FUNCTION_CALL_MARKER];
  let currentIndex = 0;

  while (true) {
    let markerIndex = -1;
    let marker = "";
    for (const candidate of markers) {
      const idx = content.indexOf(candidate, currentIndex);
      if (idx !== -1 && (markerIndex === -1 || idx < markerIndex)) {
        markerIndex = idx;
        marker = candidate;
      }
    }

    if (markerIndex === -1) break;

    const jsonStart = content.indexOf("{", markerIndex + marker.length);
    if (jsonStart === -1) {
      // No opening brace found after marker, skip this marker
      currentIndex = markerIndex + marker.length;
      continue;
    }

    // Check if there's only whitespace between marker and {
    const textBetween = content.substring(
      markerIndex + marker.length,
      jsonStart
    );
    if (textBetween.trim() !== "") {
      // Invalid format (text between marker and brace), skip this marker
      currentIndex = markerIndex + marker.length;
      continue;
    }

    // Brace counting to find full JSON object with support for nesting
    let braceCount = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < content.length; i++) {
      if (content[i] === "{") braceCount++;
      else if (content[i] === "}") {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }

    if (jsonEnd !== -1) {
      const jsonStr = content.substring(jsonStart, jsonEnd);
      const raw = content.substring(markerIndex, jsonEnd);
      try {
        const data = JSON.parse(jsonStr);
        if (data && data.name && data.params) {
          matches.push({
            type: "success",
            name: data.name,
            params: data.params,
            raw,
            startIndex: markerIndex,
            endIndex: jsonEnd,
          });
        } else {
          matches.push({
            type: "error",
            error: `Invalid Call Structure: ${jsonStr}`,
            raw,
            startIndex: markerIndex,
            endIndex: jsonEnd,
          });
        }
      } catch (e: any) {
        matches.push({
          type: "error",
          error: `Invalid JSON: ${jsonStr}`, // matching existing behavior roughly
          raw,
          startIndex: markerIndex,
          endIndex: jsonEnd,
        });
      }
      currentIndex = jsonEnd;
    } else {
      // Unclosed brace, treat as text
      currentIndex = jsonStart + 1;
    }
  }

  return matches;
}

export function splitByToolCalls(
  content: string
): (string | ToolCallParseResult)[] {
  const matches = findToolCalls(content);
  const result: (string | ToolCallParseResult)[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    if (match.startIndex > lastIndex) {
      result.push(content.substring(lastIndex, match.startIndex));
    }
    result.push(match);
    lastIndex = match.endIndex;
  }

  if (lastIndex < content.length) {
    result.push(content.substring(lastIndex));
  }

  return result;
}

export function parseToolCallStatus(
  result: string | null | undefined
): ToolCallStatus | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    switch (parsed?.status) {
      case ToolCallStatus.Success:
      case ToolCallStatus.Error:
      case ToolCallStatus.PendingConfirmation:
      case ToolCallStatus.Cancelled:
        return parsed.status as ToolCallStatus;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
