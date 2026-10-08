import test from "node:test";
import assert from "node:assert/strict";
import { validateDomain, DomainMismatchError } from "../dist/index.js";

test("Domain Validation Tests", async (t) => {
  await t.test("accepts valid @iitdh.ac.in emails", () => {
    assert.equal(validateDomain("abhishekjuvatkar@iitdh.ac.in", "iitdh.ac.in"), true);
    assert.equal(validateDomain("faculty.member@iitdh.ac.in", "iitdh.ac.in"), true);
    assert.equal(validateDomain("ADMIN@IITDH.AC.IN", "iitdh.ac.in"), true);
  });

  await t.test("rejects non-iitdh personal emails", () => {
    assert.equal(validateDomain("user@gmail.com", "iitdh.ac.in"), false);
    assert.equal(validateDomain("user@outlook.com", "iitdh.ac.in"), false);
    assert.equal(validateDomain("user@iitb.ac.in", "iitdh.ac.in"), false);
    assert.equal(validateDomain("attacker@fakeiitdh.ac.in", "iitdh.ac.in"), false);
  });

  await t.test("accepts matching Google hd (hosted domain) claim", () => {
    assert.equal(validateDomain("custom@other.com", "iitdh.ac.in", "iitdh.ac.in"), true);
  });

  await t.test("handles null or undefined input gracefully", () => {
    assert.equal(validateDomain(null as any, "iitdh.ac.in"), false);
    assert.equal(validateDomain(undefined as any, "iitdh.ac.in"), false);
    assert.equal(validateDomain("", "iitdh.ac.in"), false);
  });

  await t.test("DomainMismatchError has correct error code and status", () => {
    const err = new DomainMismatchError("iitdh.ac.in", "test@gmail.com");
    assert.equal(err.code, "DOMAIN_MISMATCH");
    assert.equal(err.statusCode, 401);
    assert.match(err.message, /@iitdh\.ac\.in/);
  });
});
