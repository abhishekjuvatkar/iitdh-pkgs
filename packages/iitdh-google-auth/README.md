# @iitdh/google-auth

> **Unified, plug-and-play Google Workspace (`@iitdh.ac.in`) Authentication SDK for React and Node.js applications at IIT Dharwad.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![IIT Dharwad](https://img.shields.io/badge/IIT%20Dharwad-Official%20Auth-059669.svg)](https://www.iitdh.ac.in)

---

## 🚀 Overview

`@iitdh/google-auth` is the official, centralized authentication library designed to standardize Google Workspace Single Sign-On (SSO) across all current and future IIT Dharwad web platforms (ERP, MMD, Academics, Payroll, Portals, Intranets, and standalone microservices).

### ✨ Key Capabilities

* **⚡ Frictionless Google One Tap Auto Sign-In:** Automatically signs in returning users who have an active Google Workspace session in their browser (via Google FedCM API) with **zero manual clicks**.
* **🛡️ Zero-Trust Domain Enforcement:** Hardware and backend verified cryptographic validation strictly enforcing `@iitdh.ac.in` domain and Google hosted domain (`hd`) claims. Non-IITDH Google accounts are rejected with `401 Unauthorized`.
* **🔒 Secure HTTP-Only Cookie Sessions:** Automatic JWT signing and validation with sliding sessions, immune to XSS token theft.
* **📦 Universal Multi-Target Package:**
  * `@iitdh/google-auth/react` — Context Providers, Hooks (`useIITDHAuth`), Login Buttons, Protected Routes, and Animated Loaders.
  * `@iitdh/google-auth/node` — Express Router, Google ID Token/OAuth Verifier, and Role/Permission Middlewares.
  * `@iitdh/google-auth/client` — Vanilla JavaScript/TypeScript HTTP Auth Client & Storage Manager.
* **🎭 Multi-Level Role Authorization:** Flexible role-checking supporting simple role strings and structured permission matrices.
* **📘 100% TypeScript Coverage:** Full type safety (`IITDHUser`, `IITDHAuthState`, `GoogleIdentityClaims`).

---

## 📦 How to Use This Custom Package in Another Project

Future IIT Dharwad projects in separate GitHub repositories (public or private) can consume this library using one of three standard methods:

### Method A: Direct NPM Install (When published to NPM registry)
```bash
npm install @iitdh/google-auth
```

### Method B: GitHub Packages (For Private Organization Repos)
1. Add `.npmrc` to your project root:
```ini
@iitdh:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```
2. Install:
```bash
npm install @iitdh/google-auth
```

### Method C: Direct Git Repository Install (Zero Registry Setup)
```bash
# Public repository
npm install git+https://github.com/iitdh/google-auth.git

# Or target a specific release tag
npm install git+https://github.com/iitdh/google-auth.git#v1.0.0

# Private repository via SSH
npm install git+ssh://git@github.com:iitdh/google-auth.git
```

---

## 🏗️ End-to-End Walkthrough: React + Node.js + SQL Server Project with Auto-Login

Here is a complete, production-ready guide to building a new application using **React (Vite)**, **Node.js (Express)**, and **Microsoft SQL Server**, featuring **Automatic (0-Click) Google Sign-In**.

```text
                                  HOW AUTO-LOGIN WORKS
                                  
  1. Browser Opens App
         │
         ▼
  2. <IITDHAuthProvider autoSelect={true}>
         │
         ├──► Checks backend cookie (/api/auth/me) ──► (Active) ──► Instant Dashboard (0 Clicks)
         │
         └──► (No cookie) ──► Google One Tap (FedCM) checks browser session:
                                  │
                                  ▼
                              User is signed into @iitdh.ac.in on Chrome?
                                  │
                                  ├──► YES: Emits ID Token silently (select_by: "auto")
                                  │            │
                                  │            ▼
                                  │        POST /api/auth/login/google
                                  │            │
                                  │            ▼
                                  │        Backend verifies token + checks SQL Server DB
                                  │            │
                                  │            ▼
                                  │        Sets httpOnly session cookie & logs user in!
                                  │
                                  └──► NO / Multiple: Displays 1-click One Tap popup
```

---

### Step 1: SQL Server Database Setup

Create the basic user and role tables in your SQL Server database:

```sql
-- Create Database
CREATE DATABASE IITDH_AppDB;
GO
USE IITDH_AppDB;
GO

-- 1. Users Table
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    FullName NVARCHAR(255) NOT NULL,
    Department NVARCHAR(100) NULL,
    EmployeeId NVARCHAR(50) NULL,
    Role NVARCHAR(50) NOT NULL DEFAULT 'USER',
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
);

-- 2. Audit / Login History Table
CREATE TABLE AuthLogs (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL,
    Provider NVARCHAR(50) NOT NULL DEFAULT 'google',
    IpAddress NVARCHAR(50) NULL,
    LoginTime DATETIME2 DEFAULT GETUTCDATE()
);
GO

-- Seed an Admin User
INSERT INTO Users (Email, FullName, Department, Role, IsActive)
VALUES ('admin@iitdh.ac.in', 'System Administrator', 'Computer Center', 'ADMIN', 1);
```

---

### Step 2: Backend Setup (Node.js + Express + SQL Server)

#### 1. Install Backend Dependencies:
```bash
npm init -y
npm install express cors cookie-parser dotenv mssql @iitdh/google-auth
```

#### 2. Configure Backend Environment (`.env`):
```env
PORT=5000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

# Google & Auth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
JWT_SECRET=super_secret_jwt_encryption_key_64_characters_min
ALLOWED_DOMAIN=iitdh.ac.in
SESSION_MINUTES=60

# SQL Server Configuration
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=IITDH_AppDB
DB_USER=sa
DB_PASSWORD=YourStrongPassword123!
```

#### 3. Database Connection Helper (`db.js`):
```javascript
// db.js
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

export const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("Connected to SQL Server successfully");
    return pool;
  })
  .catch((err) => {
    console.error("SQL Server Connection Failed: ", err);
    throw err;
  });

export { sql };
```

#### 4. Express Server (`server.js`):
```javascript
// server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { poolPromise, sql } from "./db.js";
import {
  createAuthRouter,
  createAuthMiddleware,
  createRequireRoleMiddleware,
} from "@iitdh/google-auth/node";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// 1. Mount the IITDH Google Auth Router connected to SQL Server
app.use(
  "/api/auth",
  createAuthRouter({
    clientId: process.env.GOOGLE_CLIENT_ID,
    allowedDomain: "iitdh.ac.in",
    jwtSecret: process.env.JWT_SECRET,
    sessionMinutes: 60,

    // Hook: Resolve user from SQL Server (Auto-Registers new @iitdh.ac.in users)
    resolveUser: async (identity) => {
      const pool = await poolPromise;
      
      // 1. Find existing user
      let result = await pool
        .request()
        .input("email", sql.NVarChar, identity.email)
        .query("SELECT * FROM Users WHERE Email = @email");

      let user = result.recordset[0];

      // 2. Auto-create user if first time logging in
      if (!user) {
        const insertResult = await pool
          .request()
          .input("email", sql.NVarChar, identity.email)
          .input("name", sql.NVarChar, identity.name)
          .query(`
            INSERT INTO Users (Email, FullName, Role, IsActive)
            OUTPUT INSERTED.*
            VALUES (@email, @name, 'USER', 1)
          `);
        user = insertResult.recordset[0];
      }

      return {
        id: user.Id,
        email: user.Email,
        name: user.FullName,
        role: user.Role,
        department: user.Department,
        isActive: user.IsActive,
      };
    },

    // Hook: Audit log on each login
    onAudit: async (req, auditData) => {
      if (auditData.result === "ok") {
        const pool = await poolPromise;
        await pool
          .request()
          .input("email", sql.NVarChar, auditData.email)
          .input("ip", sql.NVarChar, req.ip || "")
          .query("INSERT INTO AuthLogs (Email, IpAddress) VALUES (@email, @ip)");
      }
    },
  })
);

// 2. Protect Application Routes with Authentication Middleware
const authenticate = createAuthMiddleware();

app.get("/api/user/profile", authenticate, (req, res) => {
  res.json({
    message: "Authenticated profile data from SQL Server",
    user: req.user,
  });
});

// 3. Protect Admin-only Routes
app.get(
  "/api/admin/users",
  authenticate,
  createRequireRoleMiddleware("ADMIN", "SUPERADMIN"),
  async (req, res) => {
    const pool = await poolPromise;
    const result = await pool.query("SELECT Id, Email, FullName, Role, CreatedAt FROM Users");
    res.json({ users: result.recordset });
  }
);

app.listen(PORT, () => {
  console.log(`IITDH Backend Server running on http://localhost:${PORT}`);
});
```

---

### Step 3: Frontend Setup (React + Vite)

#### 1. Create React App & Install Dependencies:
```bash
npm create vite@latest my-iitdh-app -- --template react
cd my-iitdh-app
npm install react-router-dom @iitdh/google-auth
```

#### 2. Configure Frontend Environment (`.env`):
```env
VITE_IITDH_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_IITDH_AUTH_API_URL=http://localhost:5000/api
```

#### 3. Main Entry (`src/main.jsx`):
```jsx
// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { IITDHAuthProvider } from "@iitdh/google-auth/react";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <IITDHAuthProvider
      clientId={import.meta.env.VITE_IITDH_GOOGLE_CLIENT_ID}
      apiUrl={import.meta.env.VITE_IITDH_AUTH_API_URL}
      autoSelect={true} // Enables automatic 0-click Google sign-in
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </IITDHAuthProvider>
  </React.StrictMode>
);
```

#### 4. App Routes (`src/App.jsx`):
```jsx
// src/App.jsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import {
  useIITDHAuth,
  ProtectedRoute,
  IITDHLoginButton,
  IITDHAppLoader,
} from "@iitdh/google-auth/react";

function Navbar() {
  const { user, isAuthenticated, logout, triggerGoogleSignIn } = useIITDHAuth();

  return (
    <nav style={{ padding: "16px 24px", background: "#0f172a", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontWeight: 700, fontSize: "18px" }}>🏛️ IIT Dharwad Portal</div>
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <Link to="/" style={{ color: "#94a3b8", textDecoration: "none" }}>Home</Link>
        <Link to="/dashboard" style={{ color: "#38bdf8", textDecoration: "none" }}>Dashboard</Link>
        <Link to="/admin" style={{ color: "#fbbf24", textDecoration: "none" }}>Admin Panel</Link>
        {isAuthenticated ? (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span>{user?.name}</span>
            <button onClick={logout} style={{ padding: "6px 14px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
              Sign Out
            </button>
          </div>
        ) : (
          <button onClick={triggerGoogleSignIn} style={{ padding: "6px 14px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}

function HomePage() {
  const { user, isAuthenticated, loading } = useIITDHAuth();

  if (loading) {
    return <IITDHAppLoader title="Loading..." subtitle="Checking your session..." />;
  }

  return (
    <div style={{ padding: "40px 24px", maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
      <h1>IIT Dharwad Application Portal</h1>
      <p style={{ color: "#64748b" }}>
        Secure Google Workspace SSO with Microsoft SQL Server backend.
      </p>

      {!isAuthenticated ? (
        <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <IITDHLoginButton size="large" />
        </div>
      ) : (
        <div style={{ marginTop: "24px", padding: "24px", background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: "12px", textAlign: "left" }}>
          <h3 style={{ color: "#065f46", margin: "0 0 12px 0" }}>🟢 Logged in with Google Workspace</h3>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Name:</strong> {user?.name}</p>
          <p><strong>Role:</strong> {user?.role}</p>
          <Link to="/dashboard" style={{ display: "inline-block", marginTop: "12px", color: "#059669", fontWeight: 600 }}>
            Go to Protected Dashboard &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const { user } = useIITDHAuth();
  return (
    <div style={{ padding: "40px 24px", maxWidth: "800px", margin: "0 auto" }}>
      <h2>🔒 Protected Dashboard</h2>
      <p>This page is guarded by <code>&lt;ProtectedRoute&gt;</code>. Only verified <strong>@iitdh.ac.in</strong> accounts can view it.</p>
      <pre style={{ background: "#f1f5f9", padding: "16px", borderRadius: "8px" }}>
        {JSON.stringify(user, null, 2)}
      </pre>
    </div>
  );
}

function AdminPage() {
  return (
    <div style={{ padding: "40px 24px", maxWidth: "800px", margin: "0 auto" }}>
      <h2>🛡️ Admin Management</h2>
      <p>Guarded with <code>allowedRoles={["ADMIN", "SUPERADMIN"]}</code>.</p>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
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
    </div>
  );
}
```

---

## 🧪 Testing

Run the automated test suite:

```bash
cd packages/iitdh-google-auth
npm test
```

Tests verify:
- Domain validation (accepts `@iitdh.ac.in`, rejects personal emails)
- Cryptographic JWT signing and sliding expiration
- Role authorization logic
- Express authentication middleware

---

## 📄 License

MIT © Indian Institute of Technology Dharwad.
