# Changelog

All notable changes to the `@iitdh/google-auth` library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-06

### Added
* Initial release of `@iitdh/google-auth`.
* Unified React Authentication Provider `<IITDHAuthProvider />` supporting Google One Tap (FedCM / `auto_select="true"`) and popup OAuth2 token flow.
* Reusable hook `useIITDHAuth()` for accessing user state, session restoration, login, and logout.
* Route Guard `<ProtectedRoute />` with granular role and permission checks.
* Zero-dependency animated Equalizer loader component `<IITDHAppLoader />`.
* Official Google button renderer component `<IITDHLoginButton />`.
* Universal Express Auth Router factory `createAuthRouter()` with sliding sessions, rate limiting, and audit hooks.
* Multi-audience Google ID token and Access Token verifier with strict `@iitdh.ac.in` domain enforcement.
* Express middlewares `createAuthMiddleware()` and `createRequireRoleMiddleware()`.
* Fully typed TypeScript declarations for React, Node, and Client submodules.
* Unit and integration test suite covering domain validation, JWT session handling, and role checks.
* Example applications for React Vite and Express backend.
