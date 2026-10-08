import { AUTH_STORAGE_KEYS, DEFAULT_STORAGE_KEY } from "../shared/constants.js";
import { IITDHUser } from "../shared/types.js";
import { normalizeUser } from "../shared/utils.js";

/**
 * Token and localStorage / sessionStorage state manager for IITDH Auth
 */
export class IITDHTokenManager {
  private storageKey: string;

  constructor(storageKey: string = DEFAULT_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  public getStoredUser(): IITDHUser | null {
    if (typeof window === "undefined") return null;

    try {
      const raw =
        localStorage.getItem(this.storageKey) ||
        sessionStorage.getItem(this.storageKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      return normalizeUser(parsed);
    } catch {
      return null;
    }
  }

  public setStoredUser(user: IITDHUser | null | undefined): void {
    if (typeof window === "undefined") return;

    if (!user) {
      this.clear();
      return;
    }

    try {
      const normalized = normalizeUser(user);
      if (normalized) {
        localStorage.setItem(this.storageKey, JSON.stringify(normalized));
      }
    } catch {
      // ignore storage errors
    }
  }

  public clear(): void {
    if (typeof window === "undefined") return;

    AUTH_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    });
  }
}

export const tokenManager = new IITDHTokenManager();
