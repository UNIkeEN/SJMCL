export const base64ImgSrc = (base64: string): string => {
  return `data:image/png;base64,${base64}`;
};

export const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const cleanHtmlText = (input: string): string => {
  const unicodeDecoded = input.replace(/\\u([\dA-F]{4})/gi, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  const container = document.createElement("div");
  container.innerHTML = unicodeDecoded;
  return container.textContent?.trim() || "";
};

export const removeFileExt = (filename: string): string => {
  return filename.split(".").slice(0, -1).join(".");
};

export const formatByteSize = (bytes: number) => {
  bytes = Math.max(0, bytes);
  const sizes = ["B", "KB", "MB", "GB"];

  if (bytes >= 1024) {
    let i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  } else {
    return `${bytes} B`;
  }
};

export const formatDisplayCount = (count: number): string => {
  count = Math.max(0, count);
  const units = ["K", "M", "B"]; // K: thousand, M: million, B: billion
  let unitIndex = 0;
  let formattedCount = count;

  if (count < 10000) return `${count}`;

  while (formattedCount >= 1000 && unitIndex < units.length) {
    formattedCount /= 1000;
    unitIndex++;
  }

  return `${formattedCount.toFixed(2)} ${units[unitIndex - 1]}`;
};

export const isFileNameSanitized = (str: string): boolean => {
  const forbiddenChars = /[\\/:*?"<>|]/;
  const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
  const startsOrEndsWithInvalid = /^[\s.]+|[\s.]+$/;

  return (
    !forbiddenChars.test(str) &&
    !reservedNames.test(str) &&
    !startsOrEndsWithInvalid.test(str)
  );
};

export const sanitizeFileName = (str: string): string => {
  // Remove forbidden characters
  let sanitized = str.replace(/[\\/:*?"<>|]/g, "");
  // Trim leading/trailing spaces and dots
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, "");
  // If reserved name, append underscore
  const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
  if (reservedNames.test(sanitized)) {
    sanitized += "_";
  }
  return sanitized;
};

export const isPathSanitized = (path: string, maxLength = 255): boolean => {
  const forbiddenChars = /[<>:"|?*\0]/;
  const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  const startsOrEndsWithInvalid = /^\s+|[\s.]+$/;

  if (path.length === 0 || path.length > maxLength) {
    return false;
  }

  if (/\/{2,}|\\{2,}/.test(path)) {
    return false;
  }

  if (path === "\\" || path === "/") {
    return false;
  }

  const segments = path.split(/[\\/]/).filter((segment) => segment.length > 0);

  if (segments.length > 0 && /^[a-zA-Z]:$/.test(segments[0])) {
    segments.shift();
  }

  for (const segment of segments) {
    if (segment.length > maxLength) {
      return false;
    }
    if (forbiddenChars.test(segment)) {
      return false;
    }
    if (reservedNames.test(segment)) {
      return false;
    }
    if (startsOrEndsWithInvalid.test(segment)) {
      return false;
    }
  }

  return true;
};

export const isValidSemanticVersion = (version: string) =>
  /^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/.test(version);
