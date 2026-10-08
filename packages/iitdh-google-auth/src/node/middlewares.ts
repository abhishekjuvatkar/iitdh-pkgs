import type { NextFunction, Request, Response } from "express";
import { DEFAULT_COOKIE_NAME } from "../shared/constants.js";
import { ForbiddenRoleError, UnauthenticatedError } from "../shared/errors.js";
import { IITDHNodeAuthConfig, IITDHUser } from "../shared/types.js";
import { checkRoleAccess, normalizeUser } from "../shared/utils.js";
import { verifySessionJwt } from "./sessionManager.js";

declare global {
  namespace Express {
    interface Request {
      user?: IITDHUser;
    }
  }
}

/**
 * Creates authentication middleware for Express applications
 */
export function createAuthMiddleware(config: IITDHNodeAuthConfig = {}) {
  const secret = config.jwtSecret || process.env.JWT_SECRET || "default_jwt_secret_change_in_prod";
  const cookieName = config.cookieName || process.env.SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME;

  return async (req: Request, res: Response, next: NextFunction) => {
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

      let user: IITDHUser | null = {
        id: decoded.uid || 1,
        uid: decoded.uid || 1,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role || config.defaultRole || "USER",
        roles: decoded.roles,
        isActive: true,
      };

      if (config.enrichUser) {
        try {
          const enriched = await config.enrichUser(user);
          if (enriched) user = enriched;
        } catch (e: any) {
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

/**
 * Creates role authorization middleware for Express routes
 */
export function createRequireRoleMiddleware(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
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
