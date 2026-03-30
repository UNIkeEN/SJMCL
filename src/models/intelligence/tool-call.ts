export interface ToolCallMatch {
  type: "success";
  name: string;
  params: Record<string, any>;
  raw: string;
  startIndex: number;
  endIndex: number;
}

export interface ToolCallError {
  type: "error";
  error: string;
  raw: string;
  startIndex: number;
  endIndex: number;
}

export type ToolCallParseResult = ToolCallMatch | ToolCallError;

export interface ToolDefinitionParamProperty {
  type: string;
  enum?: string[];
  optional?: boolean;
  properties?: Record<string, ToolDefinitionParamProperty>;
}

export interface ToolDefinition {
  name: string;
  category: "query" | "write" | "repair";
  description: {
    "zh-Hans": string;
    en: string;
  };
  parameters: {
    type: "object";
    properties: Record<string, ToolDefinitionParamProperty>;
    required: string[];
  };
  usageNotes?: {
    "zh-Hans"?: string[];
    en?: string[];
  };
  preconditions?: string[];
  requiresConfirmation?: boolean;
}
