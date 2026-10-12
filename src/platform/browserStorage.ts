import type { KeyValueStore } from "../core/index";

/**
 * Saves progress in the browser's localStorage, so it is still there on the
 * next visit. Storage can be switched off (for example in private browsing),
 * so every call is guarded: the site keeps working, it just will not remember.
 */
export function createBrowserStorage(): KeyValueStore {
  return {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Nothing to do: progress simply is not saved this time.
      }
    },
  };
}
