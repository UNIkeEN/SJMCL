/**
 * Upside-Down English Transformer
 * Converts normal English text to upside-down English using character mapping
 */

const UPSIDE_DOWN_MAP: Record<string, string> = {
  a: "ɐ",
  b: "q",
  c: "ɔ",
  d: "p",
  e: "ǝ",
  f: "ɟ",
  g: "ᵷ",
  h: "ɥ",
  i: "ᴉ",
  j: "ɾ",
  k: "ʞ",
  l: "ꞁ",
  m: "ɯ",
  n: "u",
  o: "o",
  p: "d",
  q: "b",
  r: "ɹ",
  s: "s",
  t: "ʇ",
  u: "n",
  v: "ʌ",
  w: "ʍ",
  x: "x",
  y: "ʎ",
  z: "z",

  A: "Ɐ",
  B: "ᗺ",
  C: "Ɔ",
  D: "ᗡ",
  E: "Ǝ",
  F: "Ⅎ",
  G: "⅁",
  H: "H",
  I: "I",
  J: "ſ",
  K: "ʞ",
  L: "Ꞁ",
  M: "W",
  N: "N",
  O: "O",
  P: "Ԁ",
  Q: "Ὂ",
  R: "ᴚ",
  S: "S",
  T: "⟘",
  U: "∩",
  V: "Λ",
  W: "M",
  X: "X",
  Y: "ʎ",
  Z: "Z",

  "0": "0",
  "1": "Ɩ",
  "2": "ᘔ",
  "3": "Ɛ",
  "4": "ㄣ",
  "5": "ϛ",
  "6": "9",
  "7": "ㄥ",
  "8": "8",
  "9": "6",

  _: "‾",
  "'": ",",
  ";": "⸵",
  ".": "˙",
  "?": "¿",
  "!": "¡",
  "/": "\\",
  "\\": "/",
  ",": "'",
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "{": "}",
  "}": "{",
};

function flipText(text: string): string {
  const segments: Array<{ type: "text" | "protected"; content: string }> = [];
  let lastIndex = 0;

  const protectedPattern = /(\{\{[^}]+\}\})|(\b(?:https?|ftp):\/\/[^\s]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = protectedPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }

    segments.push({
      type: "protected",
      content: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  const flippedSegments = segments.map((segment) => {
    if (segment.type === "protected") {
      return segment.content;
    } else {
      return segment.content
        .split("")
        .map((char) => UPSIDE_DOWN_MAP[char] || char)
        .reverse()
        .join("");
    }
  });

  return flippedSegments.reverse().join("");
}

function transformObject(obj: any): any {
  if (typeof obj === "string") {
    return flipText(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(transformObject);
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = transformObject(value);
    }
    return result;
  }

  return obj;
}

export function generateUpsideDownTranslation(
  englishTranslation: Record<string, any>
): Record<string, any> {
  return transformObject(englishTranslation);
}
