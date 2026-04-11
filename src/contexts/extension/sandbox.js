function runSandboxedExtensionSource(__sjmclRealWindow, __sjmclRealDocument) {
  const __sjmclBlockedGlobalNames = new Set([
    "__TAURI__",
    "__TAURI_INTERNALS__",
  ]);
  const __sjmclBlockedPropertyNames = new Set(["constructor"]);
  const __sjmclTauriStub = Object.freeze({});
  let __sjmclWindowProxy;
  let __sjmclDocumentProxy;

  const __sjmclProxyHandler = {
    get(target, prop) {
      const key = String(prop);

      if (__sjmclBlockedGlobalNames.has(key)) {
        return __sjmclTauriStub;
      }

      if (__sjmclBlockedPropertyNames.has(key)) {
        return undefined;
      }

      if (key === "window" || key === "self" || key === "globalThis") {
        return __sjmclWindowProxy;
      }

      if (key === "parent" || key === "top" || key === "frames") {
        return undefined;
      }

      if (key === "document") {
        return __sjmclDocumentProxy;
      }

      const value = Reflect.get(target, prop, target);
      if (typeof value === "function") {
        return value.bind(target);
      }

      return value;
    },
    has(target, prop) {
      if (__sjmclBlockedPropertyNames.has(String(prop))) {
        return true;
      }

      if (__sjmclBlockedGlobalNames.has(String(prop))) {
        return true;
      }

      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (__sjmclBlockedPropertyNames.has(String(prop))) {
        return {
          configurable: true,
          enumerable: false,
          writable: false,
          value: undefined,
        };
      }

      if (__sjmclBlockedGlobalNames.has(String(prop))) {
        return {
          configurable: true,
          enumerable: false,
          writable: false,
          value: __sjmclTauriStub,
        };
      }

      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  };

  __sjmclWindowProxy = new Proxy(__sjmclRealWindow, __sjmclProxyHandler);
  __sjmclDocumentProxy = new Proxy(__sjmclRealDocument, {
    get(target, prop) {
      if (__sjmclBlockedPropertyNames.has(String(prop))) {
        return undefined;
      }

      if (String(prop) === "defaultView") {
        return __sjmclWindowProxy;
      }

      const value = Reflect.get(target, prop, target);
      if (typeof value === "function") {
        return value.bind(target);
      }

      return value;
    },
    has(target, prop) {
      if (__sjmclBlockedPropertyNames.has(String(prop))) {
        return true;
      }

      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (__sjmclBlockedPropertyNames.has(String(prop))) {
        return {
          configurable: true,
          enumerable: false,
          writable: false,
          value: undefined,
        };
      }

      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });

  const window = __sjmclWindowProxy;
  const self = __sjmclWindowProxy;
  const globalThis = __sjmclWindowProxy;
  const document = __sjmclDocumentProxy;
  const parent = undefined;
  const top = undefined;
  const frames = undefined;
  const __TAURI__ = __sjmclTauriStub;
  const __TAURI_INTERNALS__ = __sjmclTauriStub;

  ("__SJMCL_EXTENSION_SOURCE__");
}

/**
 * @param {string} source
 * @returns {string}
 */
export const buildSandboxedExtensionScript = (source) => {
  return `;(${runSandboxedExtensionSource
    .toString()
    .replace(
      '"__SJMCL_EXTENSION_SOURCE__";',
      `((eval, Function) => {${source}\n})(undefined, undefined);`
    )})(window, document);`;
};
