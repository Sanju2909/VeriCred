/**
 * Demo Accounts Bootstrap / Seeding Script
 * 
 * PURPOSE:
 * Idempotently provisions initial local development accounts for demonstration:
 *   1. Platform Administrator (admin@credentialplatform.local)
 *   2. Institutional Issuer (registrar@university.edu)
 *   3. Student Vault Holder (alice@student.test)
 * 
 * SAFETY RULES:
 * - Idempotent: Never overwrites, resets, or modifies existing accounts or passwords.
 * - Never promotes existing non-admin accounts or alters existing roles.
 * - Non-destructive: Leaves all existing credentials, blocks, and records untouched.
 * - Secure First-Run Setup: If running on a fresh database, prompts user interactively
 *   to configure passwords locally (or uses environment variables / secure local generation).
 * - Passwords are saved only to local backend/.env and never printed, logged, or bundled.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
require("dotenv").config();

const { connectDB, disconnectDB } = require("../config/db");
const { User, ROLES } = require("../models/User");
const { hashPassword } = require("../utils/passwordUtils");

const BACKEND_DIR = path.resolve(__dirname, "../..");

/**
 * Interactive masked password prompt
 */
function askPassword(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (!process.stdin.isTTY) {
      rl.question(promptText, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
      return;
    }

    process.stdout.write(promptText);
    let pwd = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (char) => {
      if (char === "\u0003") {
        // Ctrl+C
        process.stdout.write("\n");
        process.exit(1);
      }
      if (char === "\r" || char === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        rl.close();
        process.stdout.write("\n");
        resolve(pwd.trim());
        return;
      }
      if (char === "\u0008" || char === "\x7f") {
        // Backspace
        if (pwd.length > 0) {
          pwd = pwd.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      if (char.length === 1 && char >= " ") {
        pwd += char;
        process.stdout.write("*");
      }
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Persists bootstrap passwords to local backend/.env without overwriting other variables
 */
function persistBootstrapPasswords(entries) {
  const envPath = path.join(BACKEND_DIR, ".env");
  if (!fs.existsSync(envPath)) return;

  let content = fs.readFileSync(envPath, "utf8");

  for (const [key, val] of Object.entries(entries)) {
    const regex = new RegExp(`^#?\\s*${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${val}`);
    } else {
      content += `\n${key}=${val}`;
    }
  }

  fs.writeFileSync(envPath, content.trim() + "\n", "utf8");
}

async function seedDemoAccounts() {
  console.log("===============================================================");
  console.log("Decentralized Credential Platform: Demo Accounts Seeding");
  console.log("===============================================================");

  const connected = await connectDB();
  if (!connected) {
    console.error("❌ Failed to connect to MongoDB. Ensure MONGODB_URI is configured.");
    if (require.main === module) process.exit(1);
    throw new Error("Database connection failed during demo account seeding.");
  }

  const accountsToSeed = [
    {
      role: ROLES.ADMIN,
      name: process.env.BOOTSTRAP_ADMIN_NAME || "Platform Administrator",
      email: (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@credentialplatform.local").toLowerCase().trim(),
      envPasswordVar: "BOOTSTRAP_ADMIN_PASSWORD",
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD || null,
      ethAddress: (process.env.BOOTSTRAP_ADMIN_ETH_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266").toLowerCase(),
      did: `did:ethr:${(process.env.BOOTSTRAP_ADMIN_ETH_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266").toLowerCase()}`,
    },
    {
      role: ROLES.ISSUER,
      name: process.env.BOOTSTRAP_ISSUER_NAME || "State University of Technology",
      email: (process.env.BOOTSTRAP_ISSUER_EMAIL || "registrar@university.edu").toLowerCase().trim(),
      envPasswordVar: "BOOTSTRAP_ISSUER_PASSWORD",
      password: process.env.BOOTSTRAP_ISSUER_PASSWORD || null,
      ethAddress: (process.env.BOOTSTRAP_ISSUER_ETH_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8").toLowerCase(),
      did: `did:ethr:${(process.env.BOOTSTRAP_ISSUER_ETH_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8").toLowerCase()}`,
    },
    {
      role: ROLES.HOLDER,
      name: process.env.BOOTSTRAP_STUDENT_NAME || "Alice Sharma",
      email: (process.env.BOOTSTRAP_STUDENT_EMAIL || "alice@student.test").toLowerCase().trim(),
      envPasswordVar: "BOOTSTRAP_STUDENT_PASSWORD",
      password: process.env.BOOTSTRAP_STUDENT_PASSWORD || null,
      ethAddress: null,
      did: "did:credential:alice-sharma-vault",
    },
  ];

  try {
    const unseeded = [];

    for (const acc of accountsToSeed) {
      const existing = await User.findOne({ email: acc.email });
      if (existing) {
        if (existing.role === acc.role) {
          console.log(`ℹ️ Account '${acc.email}' (${existing.role}) already exists. Preserved existing record and permissions.`);
        } else {
          console.warn(`⚠️ Account '${acc.email}' already exists with role '${existing.role}'. Preserved existing record and permissions without modification.`);
        }
      } else {
        unseeded.push(acc);
      }
    }

    // If all accounts already exist, nothing more to do
    if (unseeded.length === 0) {
      console.log("✔ All platform demonstration accounts verified. Existing records preserved untouched.");
      return;
    }

    // Fresh database detected: interactive or safe bootstrap setup flow
    const missingPasswords = unseeded.filter((a) => !a.password || a.password.trim().length === 0);
    const envUpdates = {};

    if (missingPasswords.length > 0) {
      if (process.stdin.isTTY) {
        console.log("\n===============================================================");
        console.log("  VeriCred First-Run Setup: Demo Account Password Configuration");
        console.log("===============================================================");
        console.log("A fresh database was detected. Please configure passwords for the");
        console.log("platform demonstration accounts (minimum 8 characters).\n");
        console.log("  [1] Set ONE shared password for all demo accounts (Recommended for easy testing)");
        console.log("  [2] Set distinct passwords for each role individually\n");
        console.log("Passwords will be saved strictly to your local backend/.env file.");
        console.log("They are NEVER printed to ordinary logs or shared.");
        console.log("===============================================================\n");

        const modeAnswer = await askPassword("Choose setup mode [1 or 2, default 1]: ");
        const mode = modeAnswer.trim() === "2" ? "2" : "1";

        if (mode === "1") {
          let masterPass = "";
          while (masterPass.length < 8) {
            masterPass = await askPassword("Enter password for all demo accounts (minimum 8 characters): ");
            if (masterPass.length < 8) {
              console.log("⚠️ Password must be at least 8 characters. Please try again.");
            }
          }
          for (const acc of missingPasswords) {
            acc.password = masterPass;
            envUpdates[acc.envPasswordVar] = masterPass;
          }
        } else {
          for (const acc of missingPasswords) {
            let chosen = "";
            while (chosen.length < 8) {
              chosen = await askPassword(`Set password for ${acc.role} (${acc.email}): `);
              if (chosen.length < 8) {
                console.log("⚠️ Password must be at least 8 characters. Please try again.");
              }
            }
            acc.password = chosen;
            envUpdates[acc.envPasswordVar] = chosen;
          }
        }

        persistBootstrapPasswords(envUpdates);
        console.log("\n✔ Passwords successfully configured and saved to local backend/.env.");
        console.log("  Tip: You can view or reset demo passwords anytime locally using:");
        console.log("       node src/scripts/manageDemoAccounts.js --show");
        console.log("       node src/scripts/manageDemoAccounts.js --reset <admin|issuer|student>\n");
      } else {
        // Non-interactive / headless fallback: generate secure random local passwords
        for (const acc of missingPasswords) {
          const generated = crypto.randomBytes(12).toString("base64url") + "!1Aa";
          acc.password = generated;
          envUpdates[acc.envPasswordVar] = generated;
        }
        persistBootstrapPasswords(envUpdates);
        console.log("\nℹ️ Non-interactive mode: Generated secure random passwords for demo accounts in local backend/.env.");
        console.log("  To view your generated credentials locally on this machine, run:");
        console.log("  node src/scripts/manageDemoAccounts.js --show");
        console.log("  To reset any password, run:");
        console.log("  node src/scripts/manageDemoAccounts.js --reset <admin|issuer|student>\n");
      }
    }

    // Provision the new accounts
    for (const acc of unseeded) {
      const passwordHash = await hashPassword(acc.password.trim());
      const newUser = await User.create({
        name: acc.name,
        email: acc.email,
        passwordHash,
        role: acc.role,
        ethereumAddress: acc.ethAddress,
        did: acc.did,
        isActive: true,
        isVerified: true,
      });

      console.log(`✔ Successfully initialized ${newUser.role} account: ${newUser.email} (ID: ${newUser._id})`);
    }

    console.log("===============================================================");
    console.log("✔ First-run demonstration accounts successfully initialized.");
  } catch (error) {
    console.error("❌ Error while seeding demo accounts:", error.message);
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
  seedDemoAccounts();
}

module.exports = seedDemoAccounts;
