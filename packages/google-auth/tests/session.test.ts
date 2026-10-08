import test from "node:test";
import assert from "node:assert/strict";
import { signSessionJwt, verifySessionJwt } from "../dist/node/index.js";
import { checkRoleAccess, normalizeUser } from "../dist/index.js";

test("Session JWT & Role Authorization Tests", async (t) => {
  const secret = "test_super_secret_jwt_key_12345";

  await t.test("signs and verifies session JWT correctly", () => {
    const user = {
      id: 101,
      email: "test.user@iitdh.ac.in",
      name: "Test User",
      role: "FACULTY",
      roles: [{ roleName: "FACULTY" }, { roleName: "INDENTOR" }],
    };

    const token = signSessionJwt(user, secret, 15);
    assert.ok(token);

    const decoded = verifySessionJwt(token, secret);
    assert.equal(decoded.uid, 101);
    assert.equal(decoded.email, "test.user@iitdh.ac.in");
    assert.equal(decoded.role, "FACULTY");
  });

  await t.test("throws error when verifying with wrong secret", () => {
    const user = { email: "test@iitdh.ac.in", name: "User" };
    const token = signSessionJwt(user, secret, 15);

    assert.throws(() => {
      verifySessionJwt(token, "wrong_secret_key");
    });
  });

  await t.test("checkRoleAccess validates role strings and objects correctly", () => {
    const user = normalizeUser({
      email: "hod@iitdh.ac.in",
      role: "REPORTING_OFFICER_HOD",
      roles: [{ roleName: "REPORTING_OFFICER_HOD" }, { roleName: "FACULTY" }],
    });

    assert.equal(checkRoleAccess(user, ["REPORTING_OFFICER_HOD"]), true);
    assert.equal(checkRoleAccess(user, ["FACULTY"]), true);
    assert.equal(checkRoleAccess(user, ["ADMIN"]), false);
    assert.equal(checkRoleAccess(user, ["ADMIN", "REPORTING_OFFICER_HOD"]), true);
  });

  await t.test("normalizeUser produces valid and complete user structure", () => {
    const normalized = normalizeUser({
      email: "abhishek@iitdh.ac.in",
      name: "Abhishek",
    });

    assert.ok(normalized);
    assert.equal(normalized.email, "abhishek@iitdh.ac.in");
    assert.equal(normalized.username, "abhishek");
    assert.equal(normalized.role, "USER");
    assert.ok(normalized.employee);
    assert.equal(normalized.employee?.OfficialMailID, "abhishek@iitdh.ac.in");
  });
});
