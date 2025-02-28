export const ISOToDatetime = (isoString: string): string => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const ISOToDate = (isoString: string): string => {
  const datetime = ISOToDatetime(isoString);
  return datetime.split(" ")[0];
};

export const UNIXToDatetime = (unixTimestamp: number): string => {
  const isoString = new Date(unixTimestamp * 1000).toISOString();
  return ISOToDatetime(isoString);
};

export const UNIXToDate = (unixTimestamp: number): string => {
  const isoString = new Date(unixTimestamp * 1000).toISOString();
  return ISOToDate(isoString);
};

export const UNIXToISOString = (unixTimestamp: number): string => {
  const isoString = new Date(unixTimestamp * 1000).toISOString();
  return isoString;
};

export const formatRelativeTime = (
  isoString: string,
  t: (key: string, options?: any) => string
): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMilliseconds = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMilliseconds / (1000 * 60));
  const diffHours = Math.floor(diffMilliseconds / (1000 * 60 * 60));
  const diffDays = Math.floor(
    (now.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) /
      (1000 * 60 * 60 * 24)
  );

  if (diffMinutes < 3) {
    return t("Utils.datetime.formatRelativeTime.now");
  } else if (diffMinutes < 60) {
    return t("Utils.datetime.formatRelativeTime.minutes-ago", {
      count: diffMinutes,
    });
  } else if (diffHours < 24 && now.getDate() === date.getDate()) {
    if (diffHours === 1) {
      return t("Utils.datetime.formatRelativeTime.last-hour");
    }
    return t("Utils.datetime.formatRelativeTime.hours-ago", {
      count: diffHours,
    });
  } else if (diffDays === 1) {
    return t("Utils.datetime.formatRelativeTime.yesterday");
  } else if (now.getFullYear() === date.getFullYear()) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return t("Utils.datetime.formatRelativeTime.others", {
      time: `${month}-${day}`,
    });
  } else {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return t("Utils.datetime.formatRelativeTime.others", {
      time: `${year}-${month}-${day}`,
    });
  }
};

export const formatTimeInterval = (sec: number) => {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSeconds = sec % 60;

  const formattedHours = hours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = remainingSeconds.toString().padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
};
