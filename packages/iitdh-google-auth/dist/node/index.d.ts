import { f as IITDHNodeAuthConfig, a as GoogleIdentityClaims, I as IITDHUser } from '../types-z6LlfDC0.js';
import { CookieOptions, Request, Response, NextFunction, Router } from 'express';

/**
 * Verifies a Google ID Token or Access Token and validates the official IIT Dharwad domain.
 */
declare function verifyGoogleCredential(reqBody: {
    credential?: string;
    accessToken?: string;
    idToken?: string;
}, config?: IITDHNodeAuthConfig): Promise<{
    provider: "google";
    subject: string;
    email: string;
    name: string;
    claims: GoogleIdentityClaims;
}>;

interface SessionJwtPayload {
    uid: string | number;
    email: string;
    name: string;
    role: string;
    roles?: any[];
    [key: string]: any;
}
declare function signSessionJwt(user: Partial<IITDHUser>, secret?: string, minutes?: number): string;
declare function verifySessionJwt(token: string, secret?: string): SessionJwtPayload;
declare function getSessionCookieOptions(minutes?: number, secure?: boolean, sameSite?: "lax" | "strict" | "none" | boolean): CookieOptions;

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
declare function createAuthMiddleware(config?: IITDHNodeAuthConfig): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Creates role authorization middleware for Express routes
 */
declare function createRequireRoleMiddleware(...roles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;

/**
 * Creates a fully functional Express Router for Google Workspace (@iitdh.ac.in) Authentication.
 */
declare function createAuthRouter(config?: IITDHNodeAuthConfig): Router;

export { type SessionJwtPayload, createAuthMiddleware, createAuthRouter, createRequireRoleMiddleware, getSessionCookieOptions, signSessionJwt, verifyGoogleCredential, verifySessionJwt };
