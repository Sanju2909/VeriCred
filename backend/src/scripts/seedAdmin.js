/**
 * Administrator Bootstrap / Seeding Script
 * 
 * Usage:
 *   node src/scripts/seedAdmin.js
 * 
 * Configuration (via environment or CLI arguments):
 *   BOOTSTRAP_ADMIN_EMAIL=admin@credentialplatform.local
 *   BOOTSTRAP_ADMIN_PASSWORD=SecureAdminPassword123!
 *   BOOTSTRAP_ADMIN_NAME="Platform Administrator"
 */

require("dotenv").config();
const { connectDB, disconnectDB } = require("../config/db");
const { User, ROLES } = require("../models/User");
const { hashPassword } = require("../utils/passwordUtils");
const logger = require("../utils/logger");

async function seedAdmin() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@credentialplatform.local").toLowerCase().trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AdminPass123!";
  const name = process.env.BOOTSTRAP_ADMIN_NAME || "Platform Administrator";
  const ethAddress = process.env.BOOTSTRAP_ADMIN_ETH_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  console.log("===============================================================");
  console.log("Decentralized Credential Platform: Administrator Seeding Script");
  console.log("===============================================================");

  const connected = await connectDB();
  if (!connected) {
    console.error("❌ Failed to connect to MongoDB. Ensure MONGODB_URI is set.");
    process.exit(1);
  }

  try {
    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      console.log(`ℹ️ Admin user with email '${email}' already exists (ID: ${existingAdmin._id}).`);
      if (existingAdmin.role !== ROLES.ADMIN) {
        existingAdmin.role = ROLES.ADMIN;
        await existingAdmin.save();
        console.log(`✔ Upgraded user '${email}' to ADMIN role.`);
      }
    } else {
      const passwordHash = await hashPassword(password);
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
    }
  } catch (error) {
    console.error("❌ Error seeding administrator:", error.message);
  } finally {
    await disconnectDB();
    console.log("===============================================================");
  }
}

if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;
