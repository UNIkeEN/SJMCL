import {
  ToolDefinition,
  ToolDefinitionParamProperty,
} from "@/models/intelligence/tool-call";

function renderParamType(prop: ToolDefinitionParamProperty): string {
  if (prop.enum) {
    return prop.enum.map((v) => `"${v}"`).join(" | ");
  }
  if (prop.type === "object" && prop.properties) {
    const entries = Object.entries(prop.properties).map(([key, p]) => {
      const opt = p.optional ? "?" : "";
      return `${key}${opt}: ${renderParamType(p)}`;
    });
    return `{ ${entries.join(", ")} }`;
  }
  return prop.type;
}

export function renderParamsSignature(def: ToolDefinition): string {
  const entries = Object.entries(def.parameters.properties);
  if (entries.length === 0) return "{}";
  const parts = entries.map(([key, prop]) => {
    const opt = prop.optional ? "?" : "";
    return `${key}${opt}: ${renderParamType(prop)}`;
  });
  return `{${parts.join(", ")}}`;
}
