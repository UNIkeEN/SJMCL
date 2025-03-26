export function isUuidValid(uuid: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid
  );
}

export function isOfflinePlayernameValid(name: string) {
  return /^[a-zA-Z0-9_]{1,16}$/.test(name);
}
