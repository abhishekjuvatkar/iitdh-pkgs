import test from "node:test";
import assert from "node:assert/strict";
import { createAuthMiddleware, createRequireRoleMiddleware, signSessionJwt } from "../dist/node/index.js";

test("Express Auth Middleware Tests", async (t) => {
  const secret = "router_test_secret_xyz";
  const authMiddleware = createAuthMiddleware({ jwtSecret: secret });

  await t.test("rejects request without cookies or bearer token", async () => {
    let statusCalledWith: number | null = null;
    let jsonCalledWith: any = null;

    const req: any = { cookies: {}, headers: {} };
    const res: any = {
      status(code: number) {
        statusCalledWith = code;
        return this;
      },
      json(data: any) {
        jsonCalledWith = data;
        return this;
      },
    };
    const next = () => {
      assert.fail("next() should not be called for unauthenticated request");
    };

    await authMiddleware(req, res, next);
    assert.equal(statusCalledWith, 401);
    assert.deepEqual(jsonCalledWith, { error: "Unauthenticated" });
  });

  await t.test("authenticates valid cookie session and sets req.user", async () => {
    const user = {
      id: 42,
      email: "staff@iitdh.ac.in",
      name: "Staff Member",
      role: "ADMIN",
    };
    const token = signSessionJwt(user, secret, 30);

    const req: any = {
      cookies: { mmd_session: token },
      headers: {},
    };
    const res: any = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authMiddleware(req, res, next);
    assert.equal(nextCalled, true);
    assert.ok(req.user);
    assert.equal(req.user.email, "staff@iitdh.ac.in");
    assert.equal(req.user.role, "ADMIN");
  });

  await t.test("requireRole middleware allows authorized role and rejects unauthorized", async () => {
    const adminOnly = createRequireRoleMiddleware("ADMIN");

    // 1. Authorized
    const authReq: any = {
      user: { email: "admin@iitdh.ac.in", role: "ADMIN" },
    };
    let nextCalled = false;
    adminOnly(authReq, {} as any, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);

    // 2. Unauthorized
    let statusCalled = null;
    const unauthReq: any = {
      user: { email: "user@iitdh.ac.in", role: "STUDENT" },
    };
    const res: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json() {},
    };
    adminOnly(unauthReq, res, () => {
      assert.fail("Should not allow unauthorized role");
    });
    assert.equal(statusCalled, 403);
  });
});
