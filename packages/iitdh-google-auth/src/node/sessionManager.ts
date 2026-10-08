import type { CookieOptions } from "express";
import jwt from "jsonwebtoken";
import { DEFAULT_COOKIE_NAME, DEFAULT_SESSION_MINUTES } from "../shared/constants.js";
import { IITDHUser } from "../shared/types.js";

export interface SessionJwtPayload {
  uid: string | number;
  email: string;
  name: string;
  role: string;
  roles?: any[];
  [key: string]: any;
}

export function signSessionJwt(
  user: Partial<IITDHUser>,
  secret: string = process.env.JWT_SECRET || "default_jwt_secret_change_in_prod",
  minutes: number = Number(process.env.SESSION_MINUTES || DEFAULT_SESSION_MINUTES)
): string {
  const payload: SessionJwtPayload = {
    uid: user.id || user.uid || 1,
    email: user.email!,
    name: user.name || user.email!.split("@")[0],
    role: user.role || "USER",
    roles: user.roles,
  };

  return jwt.sign(payload, secret, {
    expiresIn: `${minutes}m`,
  });
}

export function verifySessionJwt(
  token: string,
  secret: string = process.env.JWT_SECRET || "default_jwt_secret_change_in_prod"
): SessionJwtPayload {
  return jwt.verify(token, secret) as SessionJwtPayload;
}

export function getSessionCookieOptions(
  minutes: number = Number(process.env.SESSION_MINUTES || DEFAULT_SESSION_MINUTES),
  secure: boolean = process.env.NODE_ENV === "production",
  sameSite: "lax" | "strict" | "none" | boolean = "lax"
): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: sameSite as any,
    maxAge: minutes * 60 * 1000,
    path: "/",
  };
}
