export interface FunctionCallMatch {
  type: "success";
  name: string;
  params: Record<string, any>;
  raw: string;
  startIndex: number;
  endIndex: number;
}

export interface FunctionCallError {
  type: "error";
  error: string;
  raw: string;
  startIndex: number;
  endIndex: number;
}

export type FunctionCallResult = FunctionCallMatch | FunctionCallError;

export const FUNCTION_CALL_MARKER = "::function::";

/**
 * Finds all function calls in the given content.
 * Handles nested braces for JSON parsing.
 */
export function findFunctionCalls(content: string): FunctionCallResult[] {
  const matches: FunctionCallResult[] = [];
  let currentIndex = 0;

  while (true) {
    const markerIndex = content.indexOf(FUNCTION_CALL_MARKER, currentIndex);
    if (markerIndex === -1) break;

    const jsonStart = content.indexOf(
      "{",
      markerIndex + FUNCTION_CALL_MARKER.length
    );
    if (jsonStart === -1) {
      // No opening brace found after marker, skip this marker
      currentIndex = markerIndex + FUNCTION_CALL_MARKER.length;
      continue;
    }

    // Check if there's only whitespace between marker and {
    const textBetween = content.substring(
      markerIndex + FUNCTION_CALL_MARKER.length,
      jsonStart
    );
    if (textBetween.trim() !== "") {
      // Invalid format (text between marker and brace), skip this marker
      currentIndex = markerIndex + FUNCTION_CALL_MARKER.length;
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

export function splitByFunctionCalls(
  content: string
): (string | FunctionCallResult)[] {
  const matches = findFunctionCalls(content);
  const result: (string | FunctionCallResult)[] = [];
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
