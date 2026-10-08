import React, { useEffect, useRef } from "react";
import { checkRoleAccess } from "../shared/utils.js";
import { IITDHAppLoader } from "./IITDHAppLoader.js";
import { useIITDHAuth } from "./IITDHAuthProvider.js";

export interface ProtectedRouteProps {
  roles?: string[];
  allowedRoles?: string[];
  children: React.ReactNode;
  fallbackLoader?: React.ReactNode;
  fallbackUnauthenticated?: React.ReactNode;
  fallbackForbidden?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  roles,
  allowedRoles,
  children,
  fallbackLoader,
  fallbackUnauthenticated,
  fallbackForbidden,
}) => {
  const { user, loading, error, logout, renderGoogleButton } = useIITDHAuth();
  const effectiveRoles = roles || allowedRoles;
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user && btnRef.current) {
      renderGoogleButton(btnRef.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        width: 300,
        text: "signin_with",
      });
    }
  }, [loading, user, renderGoogleButton]);

  if (loading) {
    return (
      fallbackLoader || (
        <IITDHAppLoader
          title="Signing you in..."
          subtitle="Verifying your Google Workspace session and preparing your workspace..."
        />
      )
    );
  }

  if (!user) {
    if (fallbackUnauthenticated) {
      return <>{fallbackUnauthenticated}</>;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          padding: "24px",
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            padding: "36px 32px",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#059669",
              fontSize: "24px",
              fontWeight: "bold",
            }}
          >
            🏛️
          </div>

          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            IIT Dharwad Authentication
          </h2>

          <p style={{ fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
            Please sign in using your official <strong>@iitdh.ac.in</strong> Google Workspace account.
          </p>

          {error && (
            <div
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#fef2f2",
                color: "#dc2626",
                fontSize: "13px",
                textAlign: "left",
                border: "1px solid #fecaca",
              }}
            >
              {error}
            </div>
          )}

          <div ref={btnRef} style={{ minHeight: "44px", display: "flex", justifyContent: "center" }} />

          <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>
            Indian Institute of Technology Dharwad
          </span>
        </div>
      </div>
    );
  }

  const hasAccess = checkRoleAccess(user, effectiveRoles);
  if (effectiveRoles && effectiveRoles.length > 0 && !hasAccess) {
    if (fallbackForbidden) {
      return <>{fallbackForbidden}</>;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          padding: "24px",
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: "460px",
            padding: "36px 32px",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div style={{ fontSize: "42px" }}>🔒</div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Access Denied
          </h2>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
            Your account (<strong>{user.email}</strong>, Role: <strong>{user.role}</strong>) does not have sufficient permissions to access this page.
          </p>
          <button
            onClick={logout}
            style={{
              marginTop: "8px",
              padding: "9px 20px",
              backgroundColor: "#f1f5f9",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "13.5px",
            }}
          >
            Sign in with another account
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
