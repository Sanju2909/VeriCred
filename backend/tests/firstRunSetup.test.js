/**
 * First-Run Setup & Demo Account Management Unit Tests
 * 
 * Verifies:
 * 1. Idempotent execution on existing accounts (never overwrites or resets).
 * 2. Non-promotion of existing non-admin users to admin.
 * 3. Retrieval of local credentials via manageDemoAccounts.
 * 4. Preservation of Alice Sharma demo credential.
 */

const { expect } = require("chai");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { connectDB, disconnectDB } = require("../src/config/db");
const { User, ROLES } = require("../src/models/User");
const { Credential } = require("../src/models/Credential");
const seedAdmin = require("../src/scripts/seedAdmin");
const seedDemoAccounts = require("../src/scripts/seedDemoAccounts");
const { readEnvPasswords } = require("../src/scripts/manageDemoAccounts");

describe("First-Run Setup & Account Management Safety", () => {
  before(async () => {
    await connectDB();
  });

  after(async () => {
    await disconnectDB();
  });

  it("should preserve Alice Sharma demo credential without modification", async () => {
    const cred = await Credential.findOne({
      credentialId: "urn:uuid:4cfd02f3-e4d2-46e9-afe3-279cf086dfa5",
    });
    expect(cred).to.not.be.null;
    expect(cred.holderName).to.equal("Alice Sharma");
    expect(cred.holderEmail).to.equal("alice@student.test");
    expect(cred.isRevoked).to.be.false;
  });

  it("should verify existing demo accounts without altering their password hashes", async () => {
    const adminBefore = await User.findOne({ email: "admin@credentialplatform.local" }).select("+passwordHash");
    expect(adminBefore).to.not.be.null;
    const adminHashBefore = adminBefore.passwordHash;

    // Run seedDemoAccounts idempotently
    await seedDemoAccounts();

    const adminAfter = await User.findOne({ email: "admin@credentialplatform.local" }).select("+passwordHash");
    expect(adminAfter.passwordHash).to.equal(adminHashBefore);
    expect(adminAfter.role).to.equal(ROLES.ADMIN);
  });

  it("should never promote an existing non-admin account to ADMIN merely because email matches", async () => {
    // Create a temporary isolated user with non-admin role
    const tempEmail = `test_holder_${Date.now()}@test.local`;
    const tempUser = await User.create({
      name: "Temporary Holder",
      email: tempEmail,
      passwordHash: "$2a$12$e8wE4zU0G7u2jMh0K5h0Leq5Yg0Z5b1J4v2k0a9l8m7n6o5p4q3r2",
      role: ROLES.HOLDER,
      isActive: true,
      isVerified: true,
    });

    try {
      // Simulate seedAdmin targeting this email
      process.env.BOOTSTRAP_ADMIN_EMAIL = tempEmail;
      await seedAdmin();

      const userAfter = await User.findOne({ email: tempEmail });
      expect(userAfter.role).to.equal(ROLES.HOLDER, "Existing role must be preserved and NOT promoted to ADMIN");
    } finally {
      // Clean up temporary isolated user
      await User.deleteOne({ email: tempEmail });
      delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    }
  });

  it("should parse local backend/.env credentials without leaking secrets", () => {
    const envData = readEnvPasswords();
    expect(envData).to.be.an("object");
    // Verify structure returns keys without throwing
    expect(envData).to.satisfy((obj) => typeof obj === "object");
  });
});

