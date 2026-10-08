/**
 * Custom Error classes for IIT Dharwad Authentication
 */

export class IITDHAuthError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string = "AUTH_ERROR", statusCode: number = 401) {
    super(message);
    this.name = "IITDHAuthError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DomainMismatchError extends IITDHAuthError {
  constructor(domain: string = "iitdh.ac.in", email?: string) {
    const msg = email
      ? `Unauthorized domain for account '${email}'. Only official @${domain} accounts are allowed.`
      : `Unauthorized domain. Please sign in with an official @${domain} account.`;
    super(msg, "DOMAIN_MISMATCH", 401);
    this.name = "DomainMismatchError";
  }
}

export class TokenVerificationError extends IITDHAuthError {
  constructor(message: string = "Could not verify Google Workspace session") {
    super(message, "TOKEN_VERIFICATION_FAILED", 401);
    this.name = "TokenVerificationError";
  }
}

export class UnauthenticatedError extends IITDHAuthError {
  constructor(message: string = "Unauthenticated: Active session is required") {
    super(message, "UNAUTHENTICATED", 401);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenRoleError extends IITDHAuthError {
  constructor(message: string = "Forbidden: Insufficient privileges for this resource") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenRoleError";
  }
}
