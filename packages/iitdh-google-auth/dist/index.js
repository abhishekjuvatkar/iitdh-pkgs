import { createContext, useState, useRef, useMemo, useEffect, useCallback, useContext } from 'react';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

// src/shared/constants.ts
var DEFAULT_ALLOWED_DOMAIN = "iitdh.ac.in";
var DEFAULT_COOKIE_NAME = "mmd_session";
var DEFAULT_STORAGE_KEY = "mmd_auth";
var DEFAULT_SESSION_MINUTES = 30;
var KNOWN_IITDH_GOOGLE_CLIENT_IDS = [
  "758304434030-l1j2a5ud36d378tu3h0ffnlvam89hffp.apps.googleusercontent.com",
  "204249943872-l4lk709sq1eooiv9stpbp3ccter3d2to.apps.googleusercontent.com",
  "780464298050-3m2am8gnb8qtsc7ouehbr0f1ddophqen.apps.googleusercontent.com",
  "204249943872-jeqk91pkq4dgrp4and0baj0vev259cc6.apps.googleusercontent.com"
];
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
var TokenVerificationError = class extends IITDHAuthError {
  constructor(message = "Could not verify Google Workspace session") {
    super(message, "TOKEN_VERIFICATION_FAILED", 401);
    this.name = "TokenVerificationError";
  }
};
var UnauthenticatedError = class extends IITDHAuthError {
  constructor(message = "Unauthenticated: Active session is required") {
    super(message, "UNAUTHENTICATED", 401);
    this.name = "UnauthenticatedError";
  }
};
var ForbiddenRoleError = class extends IITDHAuthError {
  constructor(message = "Forbidden: Insufficient privileges for this resource") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenRoleError";
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
  if (hd && hd.toLowerCase().trim() === cleanDomain) {
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
function checkRoleAccess(user, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!user) return false;
  const userRole = String(user.role || "").trim().toUpperCase();
  const userRolesList = (user.roles || []).map(
    (r) => String(r?.roleName || r?.role_name || r || "").trim().toUpperCase()
  );
  return allowedRoles.some((targetRole) => {
    const target = String(targetRole || "").trim().toUpperCase();
    if (!target) return false;
    if (userRole === target || userRole.includes(target) || target.includes(userRole)) {
      return true;
    }
    return userRolesList.some(
      (ur) => ur === target || ur.includes(target) || target.includes(ur)
    );
  });
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
var IITDHAuthContext = createContext(null);
function IITDHAuthProvider({
  children,
  clientId,
  apiUrl,
  allowedDomain = DEFAULT_ALLOWED_DOMAIN,
  autoSelect = true,
  storageKey = DEFAULT_STORAGE_KEY,
  onSuccess,
  onError
}) {
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    const clientInstance = new IITDHAuthClient({ storageKey });
    return clientInstance.tokenManager.getStoredUser();
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);
  const tokenClientRef = useRef(null);
  const hasPromptedRef = useRef(false);
  const client2 = useMemo(() => {
    return new IITDHAuthClient({
      clientId,
      apiUrl,
      allowedDomain,
      autoSelect,
      storageKey,
      onSuccess: (u) => {
        setUser(u);
        setError(null);
        onSuccess?.(u);
      },
      onError: (err) => {
        setError(err.message || "Authentication failed");
        onError?.(err);
      }
    });
  }, [clientId, apiUrl, allowedDomain, autoSelect, storageKey, onSuccess, onError]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const login = useCallback(
    async (response) => {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      try {
        const u = await client2.loginWithGoogle(response);
        if (isMountedRef.current) {
          setUser(u);
          setError(null);
        }
        return u;
      } catch (err) {
        if (isMountedRef.current) {
          setUser(null);
          setError(err.message || "Authentication failed");
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [client2]
  );
  const logout = useCallback(async () => {
    try {
      await client2.logout();
    } finally {
      if (isMountedRef.current) {
        setUser(null);
        setError(null);
      }
    }
  }, [client2]);
  const refreshUser = useCallback(async () => {
    try {
      const u = await client2.getCurrentUser();
      if (isMountedRef.current) {
        setUser(u);
      }
      return u;
    } catch {
      return null;
    }
  }, [client2]);
  const triggerGoogleSignIn = useCallback(() => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: "select_account" });
    } else if (typeof window !== "undefined" && window.google?.accounts?.oauth2 && clientId) {
      const oauthClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: (resp) => {
          if (resp?.access_token) {
            login(resp);
          }
        }
      });
      tokenClientRef.current = oauthClient;
      oauthClient.requestAccessToken({ prompt: "select_account" });
    } else {
      setError("Google Identity Services loading. Please try again in a moment.");
    }
  }, [clientId, login]);
  const renderGoogleButton = useCallback(
    (container, options = {}) => {
      if (typeof window === "undefined" || !container) return;
      if (window.google?.accounts?.id) {
        try {
          container.innerHTML = "";
          window.google.accounts.id.renderButton(container, {
            theme: "outline",
            size: "large",
            shape: "rectangular",
            width: 280,
            logo_alignment: "left",
            text: "signin_with",
            ...options
          });
        } catch (e) {
          console.warn("[IITDH Google Auth] renderButton error:", e);
        }
      }
    },
    []
  );
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        const activeUser = await client2.getCurrentUser();
        if (activeUser && !isCancelled) {
          console.log(
            "%c[IITDH GOOGLE AUTH] \u{1F504} Active session restored for:",
            "color: #10b981; font-weight: bold;",
            activeUser.email
          );
          setUser(activeUser);
          setLoading(false);
          return;
        }
      } catch {
      }
      if (!clientId) {
        if (!isCancelled) setLoading(false);
        return;
      }
      await loadGoogleGsiScript();
      if (typeof window !== "undefined" && window.google?.accounts && !isCancelled) {
        try {
          if (window.google.accounts.oauth2) {
            tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: "openid email profile",
              callback: (resp) => {
                if (!isCancelled && resp?.access_token) {
                  login(resp);
                }
              }
            });
          }
          if (window.google.accounts.id) {
            const domain = window.location.hostname;
            const stateCookieDomain = domain.endsWith(allowedDomain) ? allowedDomain : void 0;
            window.google.accounts.id.initialize({
              client_id: clientId,
              callback: (res) => {
                if (!isCancelled) login(res);
              },
              hd: allowedDomain,
              auto_select: autoSelect,
              use_fedcm_for_prompt: true,
              cancel_on_tap_outside: false,
              state_cookie_domain: stateCookieDomain
            });
            if (!hasPromptedRef.current) {
              hasPromptedRef.current = true;
              window.google.accounts.id.prompt((notification) => {
                if (!isCancelled) setLoading(false);
              });
            }
          }
        } catch (e) {
          console.warn("[IITDH Google Auth] One Tap init notice:", e.message);
        }
      }
      if (!isCancelled) {
        setLoading(false);
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [client2, clientId, allowedDomain, autoSelect, login]);
  const value = useMemo(() => {
    return {
      user,
      isAuthenticated: !!user,
      loading,
      error,
      client: client2,
      login,
      triggerGoogleSignIn,
      logout,
      refreshUser,
      renderGoogleButton
    };
  }, [user, loading, error, client2, login, triggerGoogleSignIn, logout, refreshUser, renderGoogleButton]);
  return /* @__PURE__ */ jsx(IITDHAuthContext.Provider, { value, children });
}
var useIITDHAuth = () => {
  const context = useContext(IITDHAuthContext);
  if (!context) {
    throw new Error("useIITDHAuth must be used within an <IITDHAuthProvider>");
  }
  return context;
};
var IITDHAppLoader = ({
  title = "Signing you in...",
  subtitle = "Verifying your Google Workspace session and preparing your workspace...",
  minHeight = "100vh",
  className = ""
}) => {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className,
      style: {
        minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, #ffffff 0%, #fbfdfc 45%, #f2f6f4 100%)",
        position: "relative",
        padding: "24px",
        boxSizing: "border-box",
        userSelect: "none",
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              maxWidth: "480px",
              width: "100%"
            },
            children: [
              /* @__PURE__ */ jsxs(
                "div",
                {
                  style: {
                    position: "relative",
                    width: "120px",
                    height: "120px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "32px"
                  },
                  children: [
                    /* @__PURE__ */ jsx(
                      "svg",
                      {
                        width: "116",
                        height: "116",
                        viewBox: "0 0 116 116",
                        style: { position: "absolute", transform: "rotate(-90deg)" },
                        children: /* @__PURE__ */ jsx(
                          "circle",
                          {
                            cx: "58",
                            cy: "58",
                            r: "54",
                            fill: "none",
                            stroke: "rgba(16, 185, 129, 0.15)",
                            strokeWidth: "3"
                          }
                        )
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "svg",
                      {
                        width: "116",
                        height: "116",
                        viewBox: "0 0 116 116",
                        style: {
                          position: "absolute",
                          animation: "iitdhSpin 1.4s linear infinite"
                        },
                        children: /* @__PURE__ */ jsx(
                          "circle",
                          {
                            cx: "58",
                            cy: "58",
                            r: "54",
                            fill: "none",
                            stroke: "#10b981",
                            strokeWidth: "3",
                            strokeDasharray: "180 340",
                            strokeLinecap: "round"
                          }
                        )
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "div",
                      {
                        style: {
                          width: "72px",
                          height: "72px",
                          borderRadius: "50%",
                          background: "linear-gradient(145deg, #10b981 0%, #059669 100%)",
                          boxShadow: "0 10px 25px -4px rgba(16, 185, 129, 0.45), 0 0 0 6px rgba(16, 185, 129, 0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 1
                        },
                        children: /* @__PURE__ */ jsxs(
                          "div",
                          {
                            style: {
                              display: "flex",
                              alignItems: "flex-end",
                              justifyContent: "center",
                              gap: "3.5px",
                              height: "22px",
                              paddingBottom: "1px"
                            },
                            children: [
                              /* @__PURE__ */ jsx(
                                "div",
                                {
                                  style: {
                                    width: "4px",
                                    height: "8px",
                                    backgroundColor: "#ffffff",
                                    borderRadius: "2px",
                                    animation: "iitdhBarWave 1.2s ease-in-out infinite",
                                    animationDelay: "0s"
                                  }
                                }
                              ),
                              /* @__PURE__ */ jsx(
                                "div",
                                {
                                  style: {
                                    width: "4px",
                                    height: "18px",
                                    backgroundColor: "#ffffff",
                                    borderRadius: "2px",
                                    animation: "iitdhBarWave 1.2s ease-in-out infinite",
                                    animationDelay: "0.2s"
                                  }
                                }
                              ),
                              /* @__PURE__ */ jsx(
                                "div",
                                {
                                  style: {
                                    width: "4px",
                                    height: "12px",
                                    backgroundColor: "#ffffff",
                                    borderRadius: "2px",
                                    animation: "iitdhBarWave 1.2s ease-in-out infinite",
                                    animationDelay: "0.4s"
                                  }
                                }
                              )
                            ]
                          }
                        )
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                "h3",
                {
                  style: {
                    fontWeight: 800,
                    color: "#0f172a",
                    fontSize: "24px",
                    letterSpacing: "-0.03em",
                    margin: "0 0 10px 0"
                  },
                  children: title
                }
              ),
              /* @__PURE__ */ jsx(
                "p",
                {
                  style: {
                    color: "#64748b",
                    fontSize: "14.5px",
                    lineHeight: 1.6,
                    maxWidth: "360px",
                    margin: 0
                  },
                  children: subtitle
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx("style", { children: `
          @keyframes iitdhSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes iitdhBarWave {
            0%, 100% {
              transform: scaleY(0.4);
              opacity: 0.7;
            }
            50% {
              transform: scaleY(1);
              opacity: 1;
            }
          }
        ` })
      ]
    }
  );
};
var ProtectedRoute = ({
  roles,
  allowedRoles,
  children,
  fallbackLoader,
  fallbackUnauthenticated,
  fallbackForbidden
}) => {
  const { user, loading, error, logout, renderGoogleButton } = useIITDHAuth();
  const effectiveRoles = roles || allowedRoles;
  const btnRef = useRef(null);
  useEffect(() => {
    if (!loading && !user && btnRef.current) {
      renderGoogleButton(btnRef.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        width: 300,
        text: "signin_with"
      });
    }
  }, [loading, user, renderGoogleButton]);
  if (loading) {
    return fallbackLoader || /* @__PURE__ */ jsx(
      IITDHAppLoader,
      {
        title: "Signing you in...",
        subtitle: "Verifying your Google Workspace session and preparing your workspace..."
      }
    );
  }
  if (!user) {
    if (fallbackUnauthenticated) {
      return /* @__PURE__ */ jsx(Fragment, { children: fallbackUnauthenticated });
    }
    return /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          padding: "24px",
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        children: /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              maxWidth: "420px",
              width: "100%",
              padding: "36px 32px",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px"
            },
            children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    backgroundColor: "#ecfdf5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#059669",
                    fontSize: "24px",
                    fontWeight: "bold"
                  },
                  children: "\u{1F3DB}\uFE0F"
                }
              ),
              /* @__PURE__ */ jsx("h2", { style: { fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }, children: "IIT Dharwad Authentication" }),
              /* @__PURE__ */ jsxs("p", { style: { fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }, children: [
                "Please sign in using your official ",
                /* @__PURE__ */ jsx("strong", { children: "@iitdh.ac.in" }),
                " Google Workspace account."
              ] }),
              error && /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    fontSize: "13px",
                    textAlign: "left",
                    border: "1px solid #fecaca"
                  },
                  children: error
                }
              ),
              /* @__PURE__ */ jsx("div", { ref: btnRef, style: { minHeight: "44px", display: "flex", justifyContent: "center" } }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "#94a3b8", marginTop: "8px" }, children: "Indian Institute of Technology Dharwad" })
            ]
          }
        )
      }
    );
  }
  const hasAccess = checkRoleAccess(user, effectiveRoles);
  if (effectiveRoles && effectiveRoles.length > 0 && !hasAccess) {
    if (fallbackForbidden) {
      return /* @__PURE__ */ jsx(Fragment, { children: fallbackForbidden });
    }
    return /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          padding: "24px",
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        children: /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              maxWidth: "460px",
              padding: "36px 32px",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px"
            },
            children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: "42px" }, children: "\u{1F512}" }),
              /* @__PURE__ */ jsx("h2", { style: { fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }, children: "Access Denied" }),
              /* @__PURE__ */ jsxs("p", { style: { fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }, children: [
                "Your account (",
                /* @__PURE__ */ jsx("strong", { children: user.email }),
                ", Role: ",
                /* @__PURE__ */ jsx("strong", { children: user.role }),
                ") does not have sufficient permissions to access this page."
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: logout,
                  style: {
                    marginTop: "8px",
                    padding: "9px 20px",
                    backgroundColor: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "13.5px"
                  },
                  children: "Sign in with another account"
                }
              )
            ]
          }
        )
      }
    );
  }
  return /* @__PURE__ */ jsx(Fragment, { children });
};
var IITDHLoginButton = ({
  theme = "outline",
  size = "large",
  text = "signin_with",
  shape = "rectangular",
  width = 280,
  className = "",
  customButton
}) => {
  const { user, triggerGoogleSignIn, renderGoogleButton } = useIITDHAuth();
  const btnRef = useRef(null);
  useEffect(() => {
    if (!user && btnRef.current) {
      renderGoogleButton(btnRef.current, {
        theme,
        size,
        text,
        shape,
        width
      });
    }
  }, [user, theme, size, text, shape, width, renderGoogleButton]);
  if (user) {
    return null;
  }
  if (customButton) {
    return /* @__PURE__ */ jsx("div", { onClick: triggerGoogleSignIn, style: { cursor: "pointer" }, className, children: customButton });
  }
  return /* @__PURE__ */ jsx("div", { ref: btnRef, className, style: { minHeight: "44px", display: "inline-flex" } });
};
var client = new OAuth2Client();
async function verifyGoogleCredential(reqBody, config = {}) {
  const allowedDomain = config.allowedDomain || process.env.ALLOWED_DOMAIN || DEFAULT_ALLOWED_DOMAIN;
  let payload = null;
  const credential = reqBody?.credential || reqBody?.idToken;
  if (credential) {
    const configuredAudiences = [
      config.clientId,
      process.env.GOOGLE_CLIENT_ID,
      process.env.VITE_GOOGLE_CLIENT_ID,
      ...config.allowedAudiences || [],
      ...KNOWN_IITDH_GOOGLE_CLIENT_IDS
    ].filter(Boolean);
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: configuredAudiences.length > 0 ? configuredAudiences : void 0
      });
      payload = ticket.getPayload();
    } catch (err) {
      try {
        const ticket = await client.verifyIdToken({ idToken: credential });
        payload = ticket.getPayload();
      } catch (fallbackErr) {
        console.warn("[IITDH Google Verifier] ID token verification notice:", fallbackErr.message);
      }
    }
  }
  if (!payload && reqBody?.accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${reqBody.accessToken}` }
      });
      if (res.ok) {
        payload = await res.json();
      }
    } catch (tokenErr) {
      console.error("[IITDH Google Verifier] Access token lookup error:", tokenErr.message);
    }
  }
  if (!payload || !payload.email) {
    throw new TokenVerificationError("Could not verify Google Workspace session with Google Identity Services");
  }
  const userEmail = payload.email.toLowerCase().trim();
  if (!validateDomain(userEmail, allowedDomain, payload.hd)) {
    console.error(`[IITDH Google Verifier] Domain mismatch for: ${userEmail} (hd: ${payload.hd})`);
    throw new DomainMismatchError(allowedDomain, userEmail);
  }
  return {
    provider: "google",
    subject: payload.sub || `google_${userEmail}`,
    email: userEmail,
    name: payload.name || userEmail.split("@")[0],
    claims: {
      sub: payload.sub,
      email: userEmail,
      email_verified: payload.email_verified,
      name: payload.name,
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name,
      hd: payload.hd
    }
  };
}
function signSessionJwt(user, secret = process.env.JWT_SECRET || "default_jwt_secret_change_in_prod", minutes = Number(process.env.SESSION_MINUTES || DEFAULT_SESSION_MINUTES)) {
  const payload = {
    uid: user.id || user.uid || 1,
    email: user.email,
    name: user.name || user.email.split("@")[0],
    role: user.role || "USER",
    roles: user.roles
  };
  return jwt.sign(payload, secret, {
    expiresIn: `${minutes}m`
  });
}
function verifySessionJwt(token, secret = process.env.JWT_SECRET || "default_jwt_secret_change_in_prod") {
  return jwt.verify(token, secret);
}
function getSessionCookieOptions(minutes = Number(process.env.SESSION_MINUTES || DEFAULT_SESSION_MINUTES), secure = process.env.NODE_ENV === "production", sameSite = "lax") {
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: minutes * 60 * 1e3,
    path: "/"
  };
}

// src/node/middlewares.ts
function createAuthMiddleware(config = {}) {
  const secret = config.jwtSecret || process.env.JWT_SECRET || "default_jwt_secret_change_in_prod";
  const cookieName = config.cookieName || process.env.SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME;
  return async (req, res, next) => {
    try {
      let token = req.cookies?.[cookieName] || req.cookies?.access_token || req.cookies?.token;
      if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
          token = parts[1];
        }
      }
      if (!token) {
        return res.status(401).json({ error: "Unauthenticated" });
      }
      const decoded = verifySessionJwt(token, secret);
      let user = {
        id: decoded.uid || 1,
        uid: decoded.uid || 1,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role || config.defaultRole || "USER",
        roles: decoded.roles,
        isActive: true
      };
      if (config.enrichUser) {
        try {
          const enriched = await config.enrichUser(user);
          if (enriched) user = enriched;
        } catch (e) {
          console.warn("[IITDH Auth Middleware] User enrichment notice:", e.message);
        }
      }
      const normalized = normalizeUser(user);
      if (!normalized || normalized.isActive === false) {
        return res.status(401).json({ error: "Unauthenticated" });
      }
      req.user = normalized;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Unauthenticated" });
    }
  };
}
function createRequireRoleMiddleware(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthenticated" });
    }
    const hasAccess = checkRoleAccess(req.user, roles);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: Insufficient privileges" });
    }
    next();
  };
}
function createAuthRouter(config = {}) {
  const router = Router();
  const cookieName = config.cookieName || process.env.SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME;
  const sessionMinutes = config.sessionMinutes || Number(process.env.SESSION_MINUTES || DEFAULT_SESSION_MINUTES);
  const secret = config.jwtSecret || process.env.JWT_SECRET || "default_jwt_secret_change_in_prod";
  const defaultRole = config.defaultRole || process.env.DEFAULT_ROLE || "USER";
  const cookieOpts = getSessionCookieOptions(
    sessionMinutes,
    config.secureCookie !== void 0 ? config.secureCookie : process.env.NODE_ENV === "production",
    config.sameSiteCookie || "lax"
  );
  const authMiddleware = createAuthMiddleware(config);
  const loginRateLimiter = rateLimit({
    windowMs: 60 * 1e3,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." }
  });
  const runAudit = async (req, auditData) => {
    if (config.onAudit) {
      try {
        await config.onAudit(req, auditData);
      } catch (e) {
        console.warn("[IITDH Auth] Audit hook notice:", e.message);
      }
    }
  };
  router.post("/login/google", loginRateLimiter, async (req, res) => {
    let identity = null;
    try {
      identity = await verifyGoogleCredential(req.body, config);
      let user = null;
      if (config.resolveUser) {
        user = await config.resolveUser(identity);
      }
      if (!user) {
        user = {
          id: 1,
          email: identity.email,
          name: identity.name,
          role: defaultRole,
          isActive: true
        };
      }
      if (config.enrichUser) {
        user = await config.enrichUser(user);
      }
      const normalized = normalizeUser(user);
      if (!normalized || normalized.isActive === false) {
        await runAudit(req, {
          provider: "google",
          email: identity?.email,
          result: "denied",
          reason: !normalized ? "no_user" : "inactive"
        });
        return res.status(403).json({ error: "Access denied for this account" });
      }
      const token = signSessionJwt(normalized, secret, sessionMinutes);
      res.cookie(cookieName, token, cookieOpts);
      console.log("\n=======================================================");
      console.log("\u{1F680} [IITDH AUTH] USER LOGGED IN SUCCESSFULLY:");
      console.log("   \u{1F4E7} Email :", normalized.email);
      console.log("   \u{1F464} Name  :", normalized.name);
      console.log("   \u{1F3F7}\uFE0F  Role  :", normalized.role);
      console.log("=======================================================\n");
      await runAudit(req, {
        provider: "google",
        userId: normalized.id,
        email: identity.email,
        result: "ok"
      });
      return res.status(200).json(normalized);
    } catch (err) {
      console.error("[IITDH Auth Router] Login error:", err.message);
      await runAudit(req, {
        provider: "google",
        email: identity?.email || req.body?.email,
        result: "error",
        reason: err.code || "verify_failed"
      });
      const isDomainMismatch = err.name === "DomainMismatchError" || err.message === "domain" || err.message && err.message.toLowerCase().includes("unauthorized domain");
      return res.status(401).json({
        error: isDomainMismatch ? `Unauthorized domain. Please sign in with an official @${config.allowedDomain || "iitdh.ac.in"} account.` : `Invalid credentials: ${err.message}`
      });
    }
  });
  router.get("/me", authMiddleware, async (req, res) => {
    if (config.slidingSession !== false && req.user) {
      const refreshedToken = signSessionJwt(req.user, secret, sessionMinutes);
      res.cookie(cookieName, refreshedToken, cookieOpts);
    }
    return res.status(200).json(req.user);
  });
  const logoutHandler = (req, res) => {
    res.clearCookie(cookieName, cookieOpts);
    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("shared_access_token", { path: "/" });
    return res.status(200).json({ ok: true, message: "Logged out successfully" });
  };
  router.post("/logout", logoutHandler);
  router.get("/logout", logoutHandler);
  return router;
}

export { AUTH_STORAGE_KEYS, DEFAULT_ALLOWED_DOMAIN, DEFAULT_COOKIE_NAME, DEFAULT_SESSION_MINUTES, DEFAULT_STORAGE_KEY, DomainMismatchError, ForbiddenRoleError, IITDHAppLoader, IITDHAuthClient, IITDHAuthError, IITDHAuthProvider, IITDHLoginButton, IITDHTokenManager, KNOWN_IITDH_GOOGLE_CLIENT_IDS, ProtectedRoute, TokenVerificationError, UnauthenticatedError, checkRoleAccess, createAuthMiddleware, createAuthRouter, createRequireRoleMiddleware, getSessionCookieOptions, loadGoogleGsiScript, normalizeUser, signSessionJwt, tokenManager, useIITDHAuth, validateDomain, verifyGoogleCredential, verifySessionJwt };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map