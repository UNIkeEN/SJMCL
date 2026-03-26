import { ToolCallStatus } from "@/enums/tool-call";

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
