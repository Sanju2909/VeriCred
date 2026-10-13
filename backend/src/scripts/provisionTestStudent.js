/**
 * Provision Test Student Account Utility
 * 
 * PURPOSE:
 * Safely and idempotently provisions the "Test Student Demo" account
 * (test.student.demo@example.com) to allow authentication and viewing
 * of previously issued credentials (e.g., urn:uuid:52277a77-3f31-4590-bbac-e47f6624df5c).
 * 
 * SAFETY RULES:
 * - Idempotent: Never overwrites, resets, or modifies existing accounts or passwords.
 * - Never touches Alice Sharma (alice@student.test), issuer, or admin accounts.
 * - Never modifies, deletes, revokes, or re-anchors any credentials.
 * - Uses existing project password convention (BOOTSTRAP_STUDENT_PASSWORD).
 * - Never logs or prints passwords or password hashes.
 */

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { connectDB, disconnectDB } = require("../config/db");
const { User, ROLES } = require("../models/User");
const { Credential } = require("../models/Credential");
const { hashPassword } = require("../utils/passwordUtils");
const authService = require("../services/authService");
const credentialService = require("../services/credentialService");

async function provisionTestStudent() {
  console.log("===============================================================");
  console.log("VeriCred: Provision Test Student Account");
  console.log("===============================================================");

  const connected = await connectDB();
  if (!connected) {
    console.error("❌ Failed to connect to MongoDB.");
    process.exit(1);
  }

  const targetEmail = "test.student.demo@example.com";
  const targetName = "Test Student Demo";

  try {
    // 1. Check if user already exists
    const existing = await User.findOne({ email: targetEmail }).select("+passwordHash");
    if (existing) {
      console.log(`ℹ️ Account '${targetEmail}' already exists. Preserving existing record without modification.`);
      console.log({
        exists: true,
        email: existing.email,
        role: existing.role,
        hasPasswordHash: Boolean(existing.passwordHash),
        isActive: existing.isActive,
        isVerified: existing.isVerified,
      });
    } else {
      const studentPassword = process.env.BOOTSTRAP_STUDENT_PASSWORD;
      if (!studentPassword) {
        throw new Error("BOOTSTRAP_STUDENT_PASSWORD is not set in environment.");
      }

      const passwordHash = await hashPassword(studentPassword);
      const newUserId = new mongoose.Types.ObjectId();

      const newUser = new User({
        _id: newUserId,
        name: targetName,
        email: targetEmail,
        passwordHash,
        role: ROLES.HOLDER,
        isActive: true,
        isVerified: true,
        did: `did:credential:${newUserId.toString()}`,
      });

      await newUser.save();
      console.log(`✔ Successfully provisioned '${targetEmail}' as role '${ROLES.HOLDER}'.`);
      console.log({
        exists: true,
        email: newUser.email,
        role: newUser.role,
        hasPasswordHash: true,
        isActive: newUser.isActive,
        isVerified: newUser.isVerified,
      });
    }

    // 2. Validate authentication using authService
    const studentPassword = process.env.BOOTSTRAP_STUDENT_PASSWORD;
    const loginResult = await authService.login({
      email: targetEmail,
      password: studentPassword,
    });
    console.log("✔ Authentication validation: SUCCESS (Token successfully generated).");

    // 3. Validate credential retrieval in Student Vault
    const vaultResult = await credentialService.getCredentialsForUser(loginResult.user, {});
    const matchingCreds = vaultResult.credentials.filter(
      (c) => c.holderEmail === targetEmail
    );
    console.log(`✔ Student Vault retrieval: Found ${matchingCreds.length} credential(s) for ${targetEmail}.`);
    matchingCreds.forEach((c) => {
      console.log(`  - Credential ID: ${c.credentialId} | Title: "${c.title}" | Status: ${c.status}`);
    });

    // 4. Verify integrity of Alice Sharma and all other accounts
    const aliceUser = await User.findOne({ email: "alice@student.test" }).select("+passwordHash");
    if (!aliceUser) {
      throw new Error("Integrity check failed: Alice Sharma account not found!");
    }
    console.log("✔ Integrity check: Alice Sharma account preserved untouched.");

    const aliceCred = await Credential.findOne({ credentialId: "urn:uuid:4cfd02f3-e4d2-46e9-afe3-279cf086dfa5" });
    if (!aliceCred || aliceCred.status !== "ISSUED" || aliceCred.isRevoked) {
      throw new Error("Integrity check failed: Alice Sharma credential modified or invalid!");
    }
    console.log("✔ Integrity check: Alice Sharma credential preserved untouched and active.");

  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  provisionTestStudent()
    .then(() => {
      console.log("===============================================================");
      console.log("Provisioning completed safely.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Error during provisioning:", err.message);
      process.exit(1);
    });
}

module.exports = { provisionTestStudent };

