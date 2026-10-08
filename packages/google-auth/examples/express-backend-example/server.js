import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  createAuthRouter,
  createAuthMiddleware,
  createRequireRoleMiddleware,
} from "@iitdh/google-auth/node";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// 1. Mount the plug-and-play IITDH Google Auth Router
const authRouter = createAuthRouter({
  clientId: process.env.GOOGLE_CLIENT_ID,
  allowedDomain: "iitdh.ac.in",
  jwtSecret: process.env.JWT_SECRET || "change_this_in_production",
  sessionMinutes: 60,
  // Optional: Custom User Database Resolver & Role Mapping
  resolveUser: async (identity) => {
    return {
      email: identity.email,
      name: identity.name,
      role: identity.email.startsWith("admin") ? "ADMIN" : "USER",
    };
  },
});

app.use("/api/auth", authRouter);

// 2. Protect any application routes with createAuthMiddleware
const authMiddleware = createAuthMiddleware();

app.get("/api/profile", authMiddleware, (req, res) => {
  res.json({ message: "Hello from protected backend", user: req.user });
});

// 3. Protect admin routes with createRequireRoleMiddleware
app.get(
  "/api/admin/metrics",
  authMiddleware,
  createRequireRoleMiddleware("ADMIN"),
  (req, res) => {
    res.json({ metrics: "System operational", admin: req.user.email });
  }
);

app.listen(PORT, () => {
  console.log(`IIT Dharwad Auth Server running on http://localhost:${PORT}`);
});
