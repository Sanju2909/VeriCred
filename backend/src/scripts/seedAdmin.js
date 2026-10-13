/**
 * Administrator Bootstrap / Seeding Script
 * 
 * Usage:
 *   node src/scripts/seedAdmin.js
 * 
 * Configuration (via environment):
 *   BOOTSTRAP_ADMIN_EMAIL=admin@credentialplatform.local
 *   BOOTSTRAP_ADMIN_PASSWORD=<configured_secure_password>
 *   BOOTSTRAP_ADMIN_NAME="Platform Administrator"
 * 
 * SAFETY RULES:
 * - Never silently promote an existing non-admin account to administrator.
 * - Never overwrite or reset existing passwords or permissions.
 * - Requires explicit BOOTSTRAP_ADMIN_PASSWORD configuration for new administrator creation.
 */

require("dotenv").config();
const { connectDB, disconnectDB } = require("../config/db");
const { User, ROLES } = require("../models/User");
const { hashPassword } = require("../utils/passwordUtils");

async function seedAdmin() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@credentialplatform.local").toLowerCase().trim();
  const name = process.env.BOOTSTRAP_ADMIN_NAME || "Platform Administrator";
  const ethAddress = process.env.BOOTSTRAP_ADMIN_ETH_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  console.log("===============================================================");
  console.log("Decentralized Credential Platform: Administrator Seeding Script");
  console.log("===============================================================");

  const connected = await connectDB();
  if (!connected) {
    console.error("❌ Failed to connect to MongoDB. Ensure MONGODB_URI is set.");
    if (require.main === module) process.exit(1);
    throw new Error("Database connection failed during administrator seeding.");
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role === ROLES.ADMIN) {
        console.log(`ℹ️ Platform administrator '${email}' already exists (ID: ${existingUser._id}). Preserved existing administrator without modification.`);
      } else {
        console.warn(`⚠️ User '${email}' already exists with role '${existingUser.role}' (ID: ${existingUser._id}). Preserved existing record and permissions without modification.`);
      }
      return;
    }

    // Require explicit bootstrap password configuration for new administrator creation
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!password || typeof password !== "string" || password.trim().length === 0) {
      console.error(`❌ Administrator bootstrap failed: BOOTSTRAP_ADMIN_PASSWORD is not configured in backend/.env.`);
      console.error(`   To initialize the platform administrator on a fresh system, configure BOOTSTRAP_ADMIN_PASSWORD with a secure password.`);
      throw new Error("Missing required BOOTSTRAP_ADMIN_PASSWORD configuration for administrator creation.");
    }

    const passwordHash = await hashPassword(password.trim());
    const newAdmin = await User.create({
      name,
      email,
      passwordHash,
      role: ROLES.ADMIN,
      ethereumAddress: ethAddress.toLowerCase(),
      did: `did:ethr:${ethAddress.toLowerCase()}`,
      isActive: true,
      isVerified: true,
    });

    console.log(`✔ Successfully created initial administrator!`);
    console.log(`  - ID: ${newAdmin._id}`);
    console.log(`  - Name: ${newAdmin.name}`);
    console.log(`  - Email: ${newAdmin.email}`);
    console.log(`  - Role: ${newAdmin.role}`);
    console.log(`  - DID: ${newAdmin.did}`);
  } catch (error) {
    console.error("❌ Error seeding administrator:", error.message);
    if (require.main === module) process.exit(1);
    throw error;
  } finally {
    if (require.main === module) {
      await disconnectDB();
    }
    console.log("===============================================================");
  }
}

if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;
