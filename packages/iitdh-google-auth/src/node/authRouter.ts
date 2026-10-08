import { Router } from "express";
import rateLimit from "express-rate-limit";
import { DEFAULT_COOKIE_NAME, DEFAULT_SESSION_MINUTES } from "../shared/constants.js";
import { IITDHNodeAuthConfig, IITDHUser } from "../shared/types.js";
import { normalizeUser } from "../shared/utils.js";
import { verifyGoogleCredential } from "./googleVerifier.js";
import { createAuthMiddleware } from "./middlewares.js";
import { getSessionCookieOptions, signSessionJwt } from "./sessionManager.js";

/**
 * Creates a fully functional Express Router for Google Workspace (@iitdh.ac.in) Authentication.
 */
export function createAuthRouter(config: IITDHNodeAuthConfig = {}): Router {
  const router = Router();
  const cookieName = config.cookieName || process.env.SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME;
  const sessionMinutes = config.sessionMinutes || Number(process.env.SESSION_MINUTES || DEFAULT_SESSION_MINUTES);
  const secret = config.jwtSecret || process.env.JWT_SECRET || "default_jwt_secret_change_in_prod";
  const defaultRole = config.defaultRole || process.env.DEFAULT_ROLE || "USER";

  const cookieOpts = getSessionCookieOptions(
    sessionMinutes,
    config.secureCookie !== undefined ? config.secureCookie : process.env.NODE_ENV === "production",
    config.sameSiteCookie || "lax"
  );

  const authMiddleware = createAuthMiddleware(config);

  const loginRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." },
  });

  const runAudit = async (req: any, auditData: any) => {
    if (config.onAudit) {
      try {
        await config.onAudit(req, auditData);
      } catch (e: any) {
        console.warn("[IITDH Auth] Audit hook notice:", e.message);
      }
    }
  };

  // POST /login/google
  router.post("/login/google", loginRateLimiter, async (req, res) => {
    let identity: any = null;
    try {
      identity = await verifyGoogleCredential(req.body, config);

      let user: IITDHUser | null = null;
      if (config.resolveUser) {
        user = await config.resolveUser(identity);
      }

      if (!user) {
        user = {
          id: 1,
          email: identity.email,
          name: identity.name,
          role: defaultRole,
          isActive: true,
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
          reason: !normalized ? "no_user" : "inactive",
        });
        return res.status(403).json({ error: "Access denied for this account" });
      }

      const token = signSessionJwt(normalized, secret, sessionMinutes);
      res.cookie(cookieName, token, cookieOpts);

      console.log("\n=======================================================");
      console.log("🚀 [IITDH AUTH] USER LOGGED IN SUCCESSFULLY:");
      console.log("   📧 Email :", normalized.email);
      console.log("   👤 Name  :", normalized.name);
      console.log("   🏷️  Role  :", normalized.role);
      console.log("=======================================================\n");

      await runAudit(req, {
        provider: "google",
        userId: normalized.id,
        email: identity.email,
        result: "ok",
      });

      return res.status(200).json(normalized);
    } catch (err: any) {
      console.error("[IITDH Auth Router] Login error:", err.message);
      await runAudit(req, {
        provider: "google",
        email: identity?.email || req.body?.email,
        result: "error",
        reason: err.code || "verify_failed",
      });

      const isDomainMismatch =
        err.name === "DomainMismatchError" ||
        err.message === "domain" ||
        (err.message && err.message.toLowerCase().includes("unauthorized domain"));

      return res.status(401).json({
        error: isDomainMismatch
          ? `Unauthorized domain. Please sign in with an official @${config.allowedDomain || "iitdh.ac.in"} account.`
          : `Invalid credentials: ${err.message}`,
      });
    }
  });

  // GET /me
  router.get("/me", authMiddleware, async (req, res) => {
    if (config.slidingSession !== false && req.user) {
      const refreshedToken = signSessionJwt(req.user, secret, sessionMinutes);
      res.cookie(cookieName, refreshedToken, cookieOpts);
    }
    return res.status(200).json(req.user);
  });

  // POST & GET /logout
  const logoutHandler = (req: any, res: any) => {
    res.clearCookie(cookieName, cookieOpts);
    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("shared_access_token", { path: "/" });
    return res.status(200).json({ ok: true, message: "Logged out successfully" });
  };

  router.post("/logout", logoutHandler);
  router.get("/logout", logoutHandler);

  return router;
}

export default createAuthRouter;
