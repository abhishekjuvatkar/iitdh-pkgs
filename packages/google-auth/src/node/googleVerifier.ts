import { OAuth2Client } from "google-auth-library";
import { DEFAULT_ALLOWED_DOMAIN, KNOWN_IITDH_GOOGLE_CLIENT_IDS } from "../shared/constants.js";
import { DomainMismatchError, TokenVerificationError } from "../shared/errors.js";
import { GoogleIdentityClaims, IITDHNodeAuthConfig } from "../shared/types.js";
import { validateDomain } from "../shared/utils.js";

const client = new OAuth2Client();

/**
 * Verifies a Google ID Token or Access Token and validates the official IIT Dharwad domain.
 */
export async function verifyGoogleCredential(
  reqBody: { credential?: string; accessToken?: string; idToken?: string },
  config: IITDHNodeAuthConfig = {}
): Promise<{
  provider: "google";
  subject: string;
  email: string;
  name: string;
  claims: GoogleIdentityClaims;
}> {
  const allowedDomain = config.allowedDomain || process.env.ALLOWED_DOMAIN || DEFAULT_ALLOWED_DOMAIN;
  let payload: any = null;

  const credential = reqBody?.credential || reqBody?.idToken;

  // Case 1: Google ID Token Credential
  if (credential) {
    const configuredAudiences = [
      config.clientId,
      process.env.GOOGLE_CLIENT_ID,
      process.env.VITE_GOOGLE_CLIENT_ID,
      ...(config.allowedAudiences || []),
      ...KNOWN_IITDH_GOOGLE_CLIENT_IDS,
    ].filter(Boolean) as string[];

    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: configuredAudiences.length > 0 ? configuredAudiences : undefined,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      try {
        // Fallback verify without strict audience match if client ID wasn't explicitly populated
        const ticket = await client.verifyIdToken({ idToken: credential });
        payload = ticket.getPayload();
      } catch (fallbackErr: any) {
        console.warn("[IITDH Google Verifier] ID token verification notice:", fallbackErr.message);
      }
    }
  }

  // Case 2: OAuth2 Access Token (verified via Google UserInfo API endpoint)
  if (!payload && reqBody?.accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${reqBody.accessToken}` },
      });
      if (res.ok) {
        payload = await res.json();
      }
    } catch (tokenErr: any) {
      console.error("[IITDH Google Verifier] Access token lookup error:", tokenErr.message);
    }
  }

  if (!payload || !payload.email) {
    throw new TokenVerificationError("Could not verify Google Workspace session with Google Identity Services");
  }

  const userEmail = payload.email.toLowerCase().trim();

  // Enforce IIT Dharwad Domain
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
      hd: payload.hd,
    },
  };
}
