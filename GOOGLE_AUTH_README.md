# Google Workspace Authentication & Automatic Sign-In Guide (MMD Module)

This document provides a comprehensive technical overview of the **Google Workspace Authentication System** implemented in the MMD (Materials Management Division - Indent and Purchase) Module. It details the architecture, automatic sign-in mechanics, code walkthrough, multi-account handling, and security design.

---

## 1. System Architecture Overview

The authentication system is built on a **Provider-Pluggable Architecture**:
- **Authentication Providers** answer a single question: *"Who is this user?"* They verify incoming credentials and return a standardized identity `{ provider, subject, email, name, claims }`.
- **Shared Session & Access Layer:** Handles user resolution, HR/Proof database profile & role enrichment, sliding session cookie issuance (`mmd_session`), and endpoint authorization (`auth` and `requireRole` middlewares).

```
   ┌──────────────────────────────────────────────────────────┐
   │                       BROWSER                            │
   │  • Google Identity Services (GIS) / One Tap              │
   │  • 'auto_select: true' (Frictionless Silent Login)       │
   │  • 'hd: iitdh.ac.in' (Domain Restriction)                │
   └──────────────────────────┬───────────────────────────────┘
                              │ Sends Google ID Token / OAuth Token
                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │                    NODE.JS BACKEND                       │
   │                                                          │
   │  1. Provider Layer (authProviders/google.js)             │
   │     • Verifies cryptographic signature with Google       │
   │     • Validates @iitdh.ac.in domain                      │
   │                                                          │
   │  2. User Resolution & Role Enrichment (auth.js)          │
   │     • Database B: Users & UserIdentities lookup          │
   │     • Database A: HR (EmployeeBasicInfo) lookup          │
   │     • Proof Database: Dynamic RoleMaster lookup          │
   │                                                          │
   │  3. Session Issuance                                     │
   │     • Signs JWT session with { uid, email, name, role }  │
   │     • Sets httpOnly, sameSite: lax 'mmd_session' cookie  │
   └──────────────────────────────────────────────────────────┘
```

---

## 2. How Automatic (Frictionless) Login Works

Google Identity Services (GIS) supports **One Tap Automatic Sign-in**, which logs returning users in with **zero manual button clicks**.

### The Step-by-Step Lifecycle:

```
[User opens MMD / CIMS Card]
        │
        ▼
[1. Check Backend Session] ── (Session Valid) ──► Enter Dashboard Immediately
        │
    (No Session)
        ▼
[2. Google Identity Services Loaded]
        │
        ▼
[3. 'auto_select: true' Triggered]
        │
        ├──► Google checks:
        │    a) Is user signed into Google Workspace?
        │    b) Did user previously consent?
        │    c) Is domain @iitdh.ac.in?
        │
        ├──► (Conditions Met) ──► Google silently emits ID Token (select_by: "auto")
        │                                    │
        │                                    ▼
        │                         POST /api/auth/login/google
        │                                    │
        │                                    ▼
        │                         Backend verifies & sets session
        │                                    │
        │                                    ▼
        │                         Dashboard opens automatically (0 clicks)
        │
        └──► (First Visit / Multiple Accounts) ──► One Tap popup displays for 1-click select
```

---

## 3. Key Design Features & Edge Case Handling

### A. Multi-Account Handling (Personal Gmail vs. College Account)
- **Hosted Domain Filtering (`hd: "iitdh.ac.in"`):**  
  When a user is signed into both personal (`user@gmail.com`) and college (`user@iitdh.ac.in`) Google accounts in Chrome, the `hd` parameter automatically filters out personal accounts, ensuring only the `@iitdh.ac.in` profile is selected.
- **Multiple College Accounts:**  
  If the user has multiple `@iitdh.ac.in` accounts in the same browser, Google pauses auto-select and displays the Account Chooser so the user can select their intended profile.

### B. Sign-Out & Dead-Loop Prevention
- When a user explicitly clicks **Logout**, the frontend invokes `google.accounts.id.disableAutoSelect()`.
- This prevents the "dead-loop" where an explicitly logged-out user is instantly auto-signed back in upon redirecting to the login page.

### C. FedCM (Federated Credential Management) Compliance
- Modern browsers (Chrome M121+) require FedCM for federated logins. The integration opts into FedCM via `use_fedcm_for_prompt: true` and adheres to FedCM event notifications (`isNotDisplayed()`, `isDismissedMoment()`).

### D. CIMS Launch URL Tolerance
- CIMS launches MMD via a static URL formatted like `http://<host>/mmd-module/&MG_ConfigurationID=35`.
- `App.jsx` automatically detects and normalizes the `&` parameter to standard query string format (`?MG_ConfigurationID=35`), ensuring clean routing.

---

## 4. Code Walkthrough

### Frontend Implementation

#### 1. Library Preload (`frontend/index.html`)
Preloads the official Google Identity Services client script:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

#### 2. Auth Context & Auto Sign-In (`frontend/src/context/AuthContext.jsx`)
Initializes Google One Tap with `auto_select: true` and handles the returned credential:
```javascript
// Check active session on mount; if absent, initialize Google One Tap
window.google.accounts.id.initialize({
  client_id: CLIENT_ID,
  callback: (response) => {
    // response.credential contains the Google ID Token
    googleLogin(response);
  },
  hd: "iitdh.ac.in",           // Strictly allow college accounts
  auto_select: true,            // Enable frictionless auto sign-in
  use_fedcm_for_prompt: true,   // Modern FedCM browser standard
  state_cookie_domain: "iitdh.ac.in", // Shared state across subdomains
});

// Trigger One Tap prompt
window.google.accounts.id.prompt((notification) => {
  if (notification?.isNotDisplayed?.()) {
    console.log("One Tap not displayed:", notification.getNotDisplayedReason());
  }
});
```

#### 3. Sign-Out (`frontend/src/context/AuthContext.jsx`)
```javascript
const logout = async () => {
  try {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
  } finally {
    // Prohibit automatic re-sign-in after explicit logout
    window.google?.accounts?.id?.disableAutoSelect();
    setUser(null);
  }
};
```

---

### Backend Implementation

#### 1. Google Provider Module (`backend/src/auth/authProviders/google.js`)
Cryptographically verifies the Google ID Token using `google-auth-library` and checks domain restrictions:
```javascript
import { OAuth2Client } from "google-auth-library";
const client = new OAuth2Client();

export default async function googleProvider(req) {
  const credential = req.body?.credential;
  if (!credential) throw new Error("Missing Google ID token");

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const allowedDomain = process.env.ALLOWED_DOMAIN || "iitdh.ac.in";
  const userEmail = payload.email.toLowerCase().trim();

  // Enforce verified email & domain
  if (!payload.email_verified || (allowedDomain && !userEmail.endsWith(`@${allowedDomain}`))) {
    throw new Error("domain");
  }

  return {
    provider: "google",
    subject: payload.sub,
    email: userEmail,
    name: payload.name || userEmail,
    claims: { picture: payload.picture, hd: payload.hd },
  };
}
```

#### 2. Auth Controller & Session Issuance (`backend/src/auth/auth.js`)
Handles login, dynamic role enrichment from HR/Proof databases, and sets the sliding HTTP-only session cookie:
```javascript
router.post("/login/:provider", rateLimit({ windowMs: 60000, max: 30 }), async (req, res) => {
  const providerName = req.params.provider;
  const identity = await getProvider(providerName)(req);

  // Resolves user from MMD DB & enriches with HR details & Proof roles
  const user = await resolveUser(identity);

  if (!user || user.isActive === false) {
    return res.status(403).json({ error: "No access to MMD" });
  }

  // Issue signed httpOnly cookie
  res.cookie("mmd_session", sign(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60 * 1000, // 30 minutes sliding session
    path: "/",
  });

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
  });
});
```

---

## 5. Environment Variables Configuration

### Backend (`backend/.env`)
```env
PORT=3000
NODE_ENV=production

# Database Connections
DATABASE_B_URL="sqlserver://<host>:1433;database=mmd;user=sa;password=...;encrypt=true;trustServerCertificate=true"

# Google Auth & Session
GOOGLE_CLIENT_ID=204249943872-xxxxxxxxxxxx.apps.googleusercontent.com
JWT_SECRET=your_long_64_character_cryptographic_secret
FRONTEND_ORIGIN=https://cims.iitdh.ac.in
AUTH_PROVIDERS=google
ALLOWED_DOMAIN=iitdh.ac.in
SESSION_MINUTES=30
SLIDING=true
```

### Frontend (`frontend/.env`)
```env
VITE_GOOGLE_CLIENT_ID=204249943872-xxxxxxxxxxxx.apps.googleusercontent.com
VITE_API_BASE=/mmd-module/api
```

---

## 6. Google Cloud Console Setup Checklist

For Google Identity Services to issue credentials without `403 Forbidden` errors:
1. Open [Google Cloud Console &rarr; Credentials](https://console.cloud.google.com/apis/credentials).
2. Under **OAuth 2.0 Client IDs**, select your Web Client ID.
3. Add all operational hostnames to **Authorized JavaScript origins**:
   - `https://cims.iitdh.ac.in` (Production domain)
   - `http://localhost:5173` (Vite dev server)
   - `http://127.0.0.1:5173`
   - `http://localhost:3000`
4. Set OAuth Consent Screen to **Internal** (restricts sign-in to `@iitdh.ac.in` users only).

---

## 7. Security Highlights

- **Cryptographic Backend Verification:** The backend never trusts client-supplied emails or usernames. It always cryptographically verifies the Google ID token signature with Google's public keys.
- **XSS & CSRF Protection:** Session tokens are stored in `httpOnly`, `sameSite: "lax"` cookies, preventing JavaScript access and cross-site request forgery.
- **Provider Extensibility:** Adding future authentication mechanisms (such as CIMS signed tickets or SAML) only requires adding a file under `backend/src/auth/authProviders/` without touching core session, authorization, or business logic.

---

## 8. Standalone Reusable SDK (`@iitdh/google-auth`)

To enable future IIT Dharwad projects in separate GitHub repositories (public or private) to integrate this authentication system with zero code duplication, the core auth layer has been packaged into **`@iitdh/google-auth`** located in [`packages/iitdh-google-auth`](file:///c:/Users/hp/Documents/GitHub/MMD-MODULE/packages/iitdh-google-auth).

### How to use in any new project:
```bash
npm install @iitdh/google-auth
```

```jsx
import { IITDHAuthProvider, useIITDHAuth, ProtectedRoute } from "@iitdh/google-auth/react";

export default function App() {
  return (
    <IITDHAuthProvider
      clientId={import.meta.env.VITE_IITDH_GOOGLE_CLIENT_ID}
      apiUrl={import.meta.env.VITE_IITDH_AUTH_API_URL}
    >
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </IITDHAuthProvider>
  );
}
```

Refer to [`packages/iitdh-google-auth/README.md`](file:///c:/Users/hp/Documents/GitHub/MMD-MODULE/packages/iitdh-google-auth/README.md) for full SDK documentation and multi-repo distribution instructions.

