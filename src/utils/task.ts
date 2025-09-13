export const parseTaskGroup = (
  taskGroup: string
): {
  name: string;
  version?: string;
  timestamp: number;
  isRetry: boolean;
} => {
  const [rawName, timestamp] = taskGroup.split("@");
  const [name, version] = rawName.split("?");
  return {
    name: name.replace(/^retry-/, ""),
    version,
    isRetry: name.startsWith("retry-"),
    timestamp: parseInt(timestamp),
  };
};
