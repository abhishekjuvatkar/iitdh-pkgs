// src/shared/constants.ts
var DEFAULT_ALLOWED_DOMAIN = "iitdh.ac.in";
var DEFAULT_STORAGE_KEY = "mmd_auth";
var AUTH_STORAGE_KEYS = [
  "mmd_auth",
  "iitdh_auth",
  "auth",
  "authData",
  "user",
  "access_token",
  "token",
  "roles",
  "mmd_user",
  "current_user"
];

// src/shared/errors.ts
var IITDHAuthError = class extends Error {
  code;
  statusCode;
  constructor(message, code = "AUTH_ERROR", statusCode = 401) {
    super(message);
    this.name = "IITDHAuthError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var DomainMismatchError = class extends IITDHAuthError {
  constructor(domain = "iitdh.ac.in", email) {
    const msg = email ? `Unauthorized domain for account '${email}'. Only official @${domain} accounts are allowed.` : `Unauthorized domain. Please sign in with an official @${domain} account.`;
    super(msg, "DOMAIN_MISMATCH", 401);
    this.name = "DomainMismatchError";
  }
};

// src/shared/utils.ts
function validateDomain(email, allowedDomain = "iitdh.ac.in", hd) {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  const cleanDomain = allowedDomain.toLowerCase().trim();
  if (cleanEmail.endsWith(`@${cleanDomain}`)) {
    return true;
  }
  return false;
}
function normalizeUser(user) {
  if (!user || !user.email) return null;
  const email = user.email.toLowerCase().trim();
  const name = user.name || user.employeeName || email.split("@")[0];
  const role = user.role || "USER";
  const rawRoles = user.roles || user.employee && user.employee.roles || [{ roleName: role, roleId: 0 }];
  const roles = Array.isArray(rawRoles) ? rawRoles.map((r) => typeof r === "string" ? { roleName: r } : r) : [{ roleName: String(rawRoles) }];
  const employee = user.employee || {
    EmployeeId: user.employeeId || user.id || "1",
    UserName: user.username || email.split("@")[0],
    EmployeeName: name,
    EmployeeDesignationName: user.designation || role,
    DepartmentName: user.department || user.departmentName || "General Section",
    OfficialMailID: email,
    roles
  };
  return {
    ...user,
    id: user.id || user.uid || 1,
    email,
    name,
    role,
    roles,
    employeeId: employee.EmployeeId || user.employeeId || "1",
    username: employee.UserName || user.username || email.split("@")[0],
    designation: employee.EmployeeDesignationName || user.designation || role,
    department: employee.DepartmentName || user.department || "General Section",
    departmentName: employee.DepartmentName || user.departmentName || "General Section",
    employee,
    isActive: user.isActive !== false
  };
}

// src/client/tokenManager.ts
var IITDHTokenManager = class {
  storageKey;
  constructor(storageKey = DEFAULT_STORAGE_KEY) {
    this.storageKey = storageKey;
  }
  getStoredUser() {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(this.storageKey) || sessionStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return normalizeUser(parsed);
    } catch {
      return null;
    }
  }
  setStoredUser(user) {
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
    }
  }
  clear() {
    if (typeof window === "undefined") return;
    AUTH_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch {
      }
    });
  }
};
var tokenManager = new IITDHTokenManager();

// src/client/authClient.ts
function loadGoogleGsiScript() {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve();
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
var IITDHAuthClient = class {
  config;
  tokenManager;
  constructor(config = {}) {
    const rawApi = config.apiUrl || typeof window !== "undefined" && window.__IITDH_API_URL__ || "/api";
    const cleanApi = rawApi.endsWith("/") ? rawApi.slice(0, -1) : rawApi;
    this.config = {
      clientId: config.clientId || "",
      apiUrl: cleanApi,
      allowedDomain: config.allowedDomain || DEFAULT_ALLOWED_DOMAIN,
      autoSelect: config.autoSelect !== false,
      storageKey: config.storageKey || DEFAULT_STORAGE_KEY,
      onSuccess: config.onSuccess || (() => {
      }),
      onError: config.onError || (() => {
      })
    };
    this.tokenManager = new IITDHTokenManager(this.config.storageKey);
  }
  /**
   * Authenticate with Google Credential or Access Token with Backend
   */
  async loginWithGoogle(response) {
    const isAuto = typeof response === "object" && response?.select_by === "auto";
    if (isAuto) {
      console.log(
        "%c[IITDH GOOGLE AUTH] \u26A1 Automatic frictionless sign-in triggered!",
        "color: #10b981; font-weight: bold;"
      );
    }
    let payload = {};
    if (typeof response === "string") {
      payload = { credential: response };
    } else if (response.credential) {
      payload = { credential: response.credential };
    } else if (response.access_token) {
      payload = { accessToken: response.access_token };
    } else {
      payload = response;
    }
    try {
      const res = await fetch(`${this.config.apiUrl}/auth/login/google`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
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
      if (!validateDomain(normalized.email, this.config.allowedDomain)) {
        throw new DomainMismatchError(this.config.allowedDomain, normalized.email);
      }
      this.tokenManager.setStoredUser(normalized);
      this.config.onSuccess(normalized);
      return normalized;
    } catch (err) {
      this.tokenManager.clear();
      this.config.onError(err);
      throw err;
    }
  }
  /**
   * Check and restore active session via HTTP cookies
   */
  async getCurrentUser() {
    try {
      const res = await fetch(`${this.config.apiUrl}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
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
  async logout() {
    try {
      await fetch(`${this.config.apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (e) {
      console.warn("[IITDH AuthClient] Logout request warning:", e);
    } finally {
      if (typeof window !== "undefined") {
        window.google?.accounts?.id?.disableAutoSelect?.();
      }
      this.tokenManager.clear();
    }
  }
};

export { IITDHAuthClient, IITDHTokenManager, loadGoogleGsiScript, tokenManager };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map