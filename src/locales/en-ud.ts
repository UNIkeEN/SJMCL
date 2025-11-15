/**
 * Upside-Down English Transformer
 */
import en from "./en.json";

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

const PROTECTED_REGEX = new RegExp(
  [
    /\{\{[^}]+\}\}/.source, // {{param}}
    /\b[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^\s]+/.source,
  ].join("|"), // links
  "g"
);

function splitWithProtection(text: string) {
  const segments: Array<{ type: "text" | "protected"; content: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = PROTECTED_REGEX.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", content: text.slice(last, m.index) });
    }
    segments.push({ type: "protected", content: m[0] });
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    segments.push({ type: "text", content: text.slice(last) });
  }

  return segments;
}

function flipTextSegment(str: string): string {
  return str
    .split("")
    .map((c) => UPSIDE_DOWN_MAP[c] || c)
    .reverse()
    .join("");
}

function transform(obj: any): any {
  if (typeof obj === "string") {
    const segments = splitWithProtection(obj);

    return segments
      .map((seg) =>
        seg.type === "protected" ? seg.content : flipTextSegment(seg.content)
      )
      .reverse()
      .join("");
  }

  if (Array.isArray(obj)) {
    return obj.map(transform);
  }

  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, transform(v)])
    );
  }

  return obj;
}

const en_ud = transform(en);

export default en_ud;
