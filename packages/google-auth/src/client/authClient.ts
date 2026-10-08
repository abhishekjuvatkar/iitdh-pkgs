import { DEFAULT_ALLOWED_DOMAIN, DEFAULT_STORAGE_KEY } from "../shared/constants.js";
import { DomainMismatchError, IITDHAuthError } from "../shared/errors.js";
import {
  GoogleCredentialResponse,
  GoogleTokenResponse,
  IITDHClientConfig,
  IITDHUser,
} from "../shared/types.js";
import { normalizeUser, validateDomain } from "../shared/utils.js";
import { IITDHTokenManager } from "./tokenManager.js";

/**
 * Loads the Google Identity Services SDK script asynchronously.
 */
export function loadGoogleGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise((resolve) => {
    if ((window as any).google?.accounts?.id) return resolve();

    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });
}

/**
 * IIT Dharwad Universal Google Auth Client
 */
export class IITDHAuthClient {
  public config: Required<IITDHClientConfig>;
  public tokenManager: IITDHTokenManager;

  constructor(config: IITDHClientConfig = {}) {
    const rawApi = config.apiUrl || (typeof window !== "undefined" && (window as any).__IITDH_API_URL__) || "/api";
    const cleanApi = rawApi.endsWith("/") ? rawApi.slice(0, -1) : rawApi;

    this.config = {
      clientId: config.clientId || "",
      apiUrl: cleanApi,
      allowedDomain: config.allowedDomain || DEFAULT_ALLOWED_DOMAIN,
      autoSelect: config.autoSelect !== false,
      storageKey: config.storageKey || DEFAULT_STORAGE_KEY,
      onSuccess: config.onSuccess || (() => {}),
      onError: config.onError || (() => {}),
    };

    this.tokenManager = new IITDHTokenManager(this.config.storageKey);
  }

  /**
   * Authenticate with Google Credential or Access Token with Backend
   */
  public async loginWithGoogle(
    response: GoogleCredentialResponse | GoogleTokenResponse | string
  ): Promise<IITDHUser> {
    const isAuto = typeof response === "object" && (response as GoogleCredentialResponse)?.select_by === "auto";
    if (isAuto) {
      console.log(
        "%c[IITDH GOOGLE AUTH] ⚡ Automatic frictionless sign-in triggered!",
        "color: #10b981; font-weight: bold;"
      );
    }

    let payload: Record<string, any> = {};
    if (typeof response === "string") {
      payload = { credential: response };
    } else if ((response as GoogleCredentialResponse).credential) {
      payload = { credential: (response as GoogleCredentialResponse).credential };
    } else if ((response as GoogleTokenResponse).access_token) {
      payload = { accessToken: (response as GoogleTokenResponse).access_token };
    } else {
      payload = response as any;
    }

    try {
      const res = await fetch(`${this.config.apiUrl}/auth/login/google`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error && data.error.includes("Unauthorized domain")) {
          throw new DomainMismatchError(this.config.allowedDomain);
        }
        throw new IITDHAuthError(
          data.error || "Authentication failed. Please use your official @iitdh.ac.in account.",
          "LOGIN_FAILED",
          res.status
        );
      }

      const normalized = normalizeUser(data);
      if (!normalized) {
        throw new IITDHAuthError("Malformed user profile returned from authentication backend");
      }

      // Validate domain on client side as an extra safeguard
      if (!validateDomain(normalized.email, this.config.allowedDomain)) {
        throw new DomainMismatchError(this.config.allowedDomain, normalized.email);
      }

      this.tokenManager.setStoredUser(normalized);
      this.config.onSuccess(normalized);
      return normalized;
    } catch (err: any) {
      this.tokenManager.clear();
      this.config.onError(err);
      throw err;
    }
  }

  /**
   * Check and restore active session via HTTP cookies
   */
  public async getCurrentUser(): Promise<IITDHUser | null> {
    try {
      const res = await fetch(`${this.config.apiUrl}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      const normalized = normalizeUser(data);
      if (normalized) {
        this.tokenManager.setStoredUser(normalized);
      }
      return normalized;
    } catch {
      return null;
    }
  }

  /**
   * Sign out and prohibit auto-select loop
   */
  public async logout(): Promise<void> {
    try {
      await fetch(`${this.config.apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.warn("[IITDH AuthClient] Logout request warning:", e);
    } finally {
      if (typeof window !== "undefined") {
        (window as any).google?.accounts?.id?.disableAutoSelect?.();
      }
      this.tokenManager.clear();
    }
  }
}
