import { I as IITDHUser } from './types-z6LlfDC0.js';
export { G as GoogleCredentialResponse, a as GoogleIdentityClaims, b as GoogleTokenResponse, c as IITDHAuthState, d as IITDHClientConfig, e as IITDHEmployeeMetadata, f as IITDHNodeAuthConfig, g as IITDHUserRole } from './types-z6LlfDC0.js';
export { IITDHAuthClient, IITDHTokenManager, loadGoogleGsiScript, tokenManager } from './client/index.js';
export { IITDHAppLoader, IITDHAppLoaderProps, IITDHAuthContextValue, IITDHAuthProvider, IITDHAuthProviderProps, IITDHLoginButton, IITDHLoginButtonProps, ProtectedRoute, ProtectedRouteProps, useIITDHAuth } from './react/index.js';
export { SessionJwtPayload, createAuthMiddleware, createAuthRouter, createRequireRoleMiddleware, getSessionCookieOptions, signSessionJwt, verifyGoogleCredential, verifySessionJwt } from './node/index.js';
import 'react';
import 'express';

/**
 * Constants used across IIT Dharwad Authentication modules
 */
declare const DEFAULT_ALLOWED_DOMAIN = "iitdh.ac.in";
declare const DEFAULT_COOKIE_NAME = "mmd_session";
declare const DEFAULT_STORAGE_KEY = "mmd_auth";
declare const DEFAULT_SESSION_MINUTES = 30;
declare const KNOWN_IITDH_GOOGLE_CLIENT_IDS: string[];
declare const AUTH_STORAGE_KEYS: string[];

/**
 * Custom Error classes for IIT Dharwad Authentication
 */
declare class IITDHAuthError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code?: string, statusCode?: number);
}
declare class DomainMismatchError extends IITDHAuthError {
    constructor(domain?: string, email?: string);
}
declare class TokenVerificationError extends IITDHAuthError {
    constructor(message?: string);
}
declare class UnauthenticatedError extends IITDHAuthError {
    constructor(message?: string);
}
declare class ForbiddenRoleError extends IITDHAuthError {
    constructor(message?: string);
}

/**
 * Validates whether an email belongs to the allowed IIT Dharwad domain.
 */
declare function validateDomain(email: string | undefined | null, allowedDomain?: string, hd?: string): boolean;
/**
 * Normalizes user and employee metadata for seamless interop across components.
 */
declare function normalizeUser(user: Partial<IITDHUser> | null | undefined): IITDHUser | null;
/**
 * Checks whether the user satisfies at least one required role.
 */
declare function checkRoleAccess(user: IITDHUser | null | undefined, allowedRoles?: string[] | null): boolean;

export { AUTH_STORAGE_KEYS, DEFAULT_ALLOWED_DOMAIN, DEFAULT_COOKIE_NAME, DEFAULT_SESSION_MINUTES, DEFAULT_STORAGE_KEY, DomainMismatchError, ForbiddenRoleError, IITDHAuthError, IITDHUser, KNOWN_IITDH_GOOGLE_CLIENT_IDS, TokenVerificationError, UnauthenticatedError, checkRoleAccess, normalizeUser, validateDomain };
