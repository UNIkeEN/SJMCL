// Prevent prototype pollution by blocking dangerous keys
// ref: https://github.com/UNIkeEN/SJMCL/security/code-scanning/4
const isUnsafeKey = (key: string): boolean =>
  ["__proto__", "constructor", "prototype"].includes(key);

export const updateByKeyPath = (obj: any, path: string, value: any): void => {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (isUnsafeKey(key)) return;

    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  if (isUnsafeKey(lastKey)) return;

  current[lastKey] = value;
};
