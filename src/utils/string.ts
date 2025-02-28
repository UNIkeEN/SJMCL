export const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const extractFileName = (
  str: string,
  withExt: boolean = false
): string => {
  const fileName = str.split("/").pop() || "";
  return withExt ? fileName : fileName.split(".").slice(0, -1).join(".");
};

export const base64ImgSrc = (base64: string): string => {
  return `data:image/png;base64,${base64}`;
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
