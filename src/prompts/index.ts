import { ToolDefinition } from "@/models/intelligence/tool-call";
import { renderParamsSignature } from "@/utils/tool-call/definition-renderer";
import {
  chatSystemPrompt as chatEn,
  gameErrorSystemPrompt as gameErrorEn,
} from "./en";
import { TOOL_DEFINITIONS } from "./tool";
import {
  chatSystemPrompt as chatZhHans,
  gameErrorSystemPrompt as gameErrorZhHans,
} from "./zh-Hans";

const chatPrompts: Record<string, string> = {
  "zh-Hans": chatZhHans,
  en: chatEn,
  // Add other languages here as needed, defaulting to zh-Hans for now
};

const gameErrorPrompts: Record<
  string,
  (os: string, javaVersion: string, mcVersion: string, log: string) => string
> = {
  "zh-Hans": gameErrorZhHans,
  en: gameErrorEn,
};

type Locale = "zh-Hans" | "en";

function generateToolLine(def: ToolDefinition, locale: Locale): string {
  const desc = def.description[locale];
  const params = renderParamsSignature(def);
  const notes = def.usageNotes?.[locale];

  let line = `- \`${def.name}\`: ${desc} (params: \`${params}\`)`;

  if (notes && notes.length > 0) {
    const separator = locale === "zh-Hans" ? "，" : ", ";
    const joiner = locale === "zh-Hans" ? "。" : ". ";
    const noteText = notes.join(joiner);
    const needsEnding = !/[.。…]$/.test(noteText);
    const ending = locale === "zh-Hans" ? "。" : ".";
    line += `${separator}${noteText}${needsEnding ? ending : ""}`;
  } else {
    line += locale === "zh-Hans" ? "。" : ".";
  }

  return line;
}

function generateToolSection(locale: string): string {
  const loc: Locale = locale === "zh-Hans" ? "zh-Hans" : "en";

  const header = loc === "zh-Hans" ? "\n\n可用咒语:" : "\n\nAvailable Spells:";
  const footer =
    loc === "zh-Hans"
      ? "\n请在回答的同时附带咒语，让魔法生效吧！"
      : "\nPlease include the spell in your response to make the magic happen!";

  const lines = TOOL_DEFINITIONS.map((def) => generateToolLine(def, loc));

  return header + "\n" + lines.join("\n") + footer;
}

export const getChatSystemPrompt = (locale: string) => {
  const base = chatPrompts[locale] || chatPrompts["en"];
  return base + generateToolSection(locale);
};

export const getGameErrorSystemPrompt = (locale: string) => {
  return gameErrorPrompts[locale] || gameErrorPrompts["en"];
};
