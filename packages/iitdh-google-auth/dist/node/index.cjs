'use strict';

var googleAuthLibrary = require('google-auth-library');
var jwt = require('jsonwebtoken');
var express = require('express');
var rateLimit = require('express-rate-limit');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var jwt__default = /*#__PURE__*/_interopDefault(jwt);
var rateLimit__default = /*#__PURE__*/_interopDefault(rateLimit);

// src/node/googleVerifier.ts

// src/shared/constants.ts
var DEFAULT_ALLOWED_DOMAIN = "iitdh.ac.in";
var DEFAULT_COOKIE_NAME = "mmd_session";
var DEFAULT_SESSION_MINUTES = 30;
var KNOWN_IITDH_GOOGLE_CLIENT_IDS = [
  "758304434030-l1j2a5ud36d378tu3h0ffnlvam89hffp.apps.googleusercontent.com",
  "204249943872-l4lk709sq1eooiv9stpbp3ccter3d2to.apps.googleusercontent.com",
  "780464298050-3m2am8gnb8qtsc7ouehbr0f1ddophqen.apps.googleusercontent.com",
  "204249943872-jeqk91pkq4dgrp4and0baj0vev259cc6.apps.googleusercontent.com"
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

// src/node/googleVerifier.ts
var client = new googleAuthLibrary.OAuth2Client();
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
  return jwt__default.default.sign(payload, secret, {
    expiresIn: `${minutes}m`
  });
}
function verifySessionJwt(token, secret = process.env.JWT_SECRET || "default_jwt_secret_change_in_prod") {
  return jwt__default.default.verify(token, secret);
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
  const router = express.Router();
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
  const loginRateLimiter = rateLimit__default.default({
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

exports.createAuthMiddleware = createAuthMiddleware;
exports.createAuthRouter = createAuthRouter;
exports.createRequireRoleMiddleware = createRequireRoleMiddleware;
exports.getSessionCookieOptions = getSessionCookieOptions;
exports.signSessionJwt = signSessionJwt;
exports.verifyGoogleCredential = verifyGoogleCredential;
exports.verifySessionJwt = verifySessionJwt;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map