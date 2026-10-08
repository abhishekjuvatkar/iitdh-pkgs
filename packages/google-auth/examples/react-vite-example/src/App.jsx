import React from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import {
  IITDHAuthProvider,
  useIITDHAuth,
  ProtectedRoute,
  IITDHLoginButton,
  IITDHAppLoader,
} from "@iitdh/google-auth/react";

function Navigation() {
  const { user, isAuthenticated, logout } = useIITDHAuth();
  return (
    <nav style={{ padding: "16px 24px", background: "#0f172a", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontWeight: "bold", fontSize: "18px" }}>🏛️ IIT Dharwad App</div>
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <Link to="/" style={{ color: "#94a3b8", textDecoration: "none" }}>Public Home</Link>
        <Link to="/portal" style={{ color: "#38bdf8", textDecoration: "none" }}>Protected Portal</Link>
        <Link to="/admin" style={{ color: "#fbbf24", textDecoration: "none" }}>Admin Only</Link>
        {isAuthenticated ? (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "14px" }}>{user?.name} ({user?.email})</span>
            <button onClick={logout} style={{ padding: "6px 12px", borderRadius: "6px", background: "#ef4444", color: "white", border: "none", cursor: "pointer" }}>
              Logout
            </button>
          </div>
        ) : (
          <IITDHLoginButton width={160} size="medium" />
        )}
      </div>
    </nav>
  );
}

function HomePage() {
  const { user, isAuthenticated, triggerGoogleSignIn } = useIITDHAuth();
  return (
    <div style={{ padding: "40px 24px", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
      <h1>Welcome to IIT Dharwad New Project</h1>
      <p style={{ color: "#64748b", fontSize: "16px" }}>
        This sample demonstrates how any new React application can integrate <strong>@iitdh/google-auth</strong> in less than 5 minutes.
      </p>

      {!isAuthenticated ? (
        <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <IITDHLoginButton size="large" width={280} />
          <p style={{ fontSize: "13px", color: "#94a3b8" }}>or click below for manual popup login</p>
          <button
            onClick={triggerGoogleSignIn}
            style={{ padding: "10px 24px", borderRadius: "8px", background: "#2563eb", color: "white", border: "none", fontWeight: 600, cursor: "pointer" }}
          >
            Sign in with @iitdh.ac.in
          </button>
        </div>
      ) : (
        <div style={{ marginTop: "24px", padding: "20px", background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: "12px", textAlign: "left" }}>
          <h3 style={{ color: "#065f46", margin: "0 0 8px 0" }}>🟢 Signed in successfully</h3>
          <p><strong>Name:</strong> {user?.name}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Role:</strong> {user?.role}</p>
        </div>
      )}
    </div>
  );
}

function PortalPage() {
  const { user } = useIITDHAuth();
  return (
    <div style={{ padding: "40px 24px", maxWidth: "800px", margin: "0 auto" }}>
      <h2>🔒 Protected IIT Dharwad Workspace</h2>
      <p>Only users with an active verified <strong>@iitdh.ac.in</strong> session can view this page.</p>
      <pre style={{ background: "#f1f5f9", padding: "16px", borderRadius: "8px" }}>
        {JSON.stringify(user, null, 2)}
      </pre>
    </div>
  );
}

function AdminPage() {
  return (
    <div style={{ padding: "40px 24px", maxWidth: "800px", margin: "0 auto" }}>
      <h2>🛡️ Admin Only Control Panel</h2>
      <p>This page is guarded with <code>allowedRoles={["ADMIN", "SUPERADMIN"]}</code>.</p>
    </div>
  );
}

export default function App() {
  return (
    <IITDHAuthProvider
      clientId={import.meta.env.VITE_IITDH_GOOGLE_CLIENT_ID}
      apiUrl={import.meta.env.VITE_IITDH_AUTH_API_URL || "http://localhost:3000/api"}
    >
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <PortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPERADMIN"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </IITDHAuthProvider>
  );
}
