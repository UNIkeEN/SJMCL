export const parseTaskGroup = (
  taskGroup: string
): {
  name: string;
  version?: string;
  timestamp: number;
} => {
  const [rawName, timestamp] = taskGroup.split("@");
  const [name, version] = rawName.split("?");
  return { name, version, timestamp: parseInt(timestamp) };
};
