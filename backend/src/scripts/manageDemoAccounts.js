/**
 * Demo Accounts Management & Password Retrieval Utility
 * 
 * Usage:
 *   node src/scripts/manageDemoAccounts.js --show
 *   node src/scripts/manageDemoAccounts.js --reset [admin|issuer|student]
 * 
 * PURPOSE:
 * Allows the local environment owner to securely inspect or reset demonstration
 * account credentials without printing secrets to system logs or exposing them
 * in public repository files.
 * 
 * SAFETY RULES:
 * - Local development utility only.
 * - Never modifies accounts other than the 3 designated demo accounts.
 * - Never touches or alters Alice Sharma's credential or on-chain state.
 * - Never logs secrets to shared or unattended log files.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { connectDB, disconnectDB } = require("../config/db");
const { User, ROLES } = require("../models/User");
const { hashPassword } = require("../utils/passwordUtils");

const BACKEND_DIR = path.resolve(__dirname, "../..");
const ENV_PATH = path.join(BACKEND_DIR, ".env");

const DEMO_EMAILS = {
  admin: (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@credentialplatform.local").toLowerCase().trim(),
  issuer: (process.env.BOOTSTRAP_ISSUER_EMAIL || "registrar@university.edu").toLowerCase().trim(),
  student: (process.env.BOOTSTRAP_STUDENT_EMAIL || "alice@student.test").toLowerCase().trim(),
};

function readEnvPasswords() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, "utf8");
  const result = {};

  const adminMatch = content.match(/^BOOTSTRAP_ADMIN_PASSWORD=(.+)$/m);
  const issuerMatch = content.match(/^BOOTSTRAP_ISSUER_PASSWORD=(.+)$/m);
  const studentMatch = content.match(/^BOOTSTRAP_STUDENT_PASSWORD=(.+)$/m);

  if (adminMatch) result.admin = adminMatch[1].trim();
  if (issuerMatch) result.issuer = issuerMatch[1].trim();
  if (studentMatch) result.student = studentMatch[1].trim();

  return result;
}

function updateEnvPassword(varName, newPassword) {
  if (!fs.existsSync(ENV_PATH)) return;
  let content = fs.readFileSync(ENV_PATH, "utf8");
  const regex = new RegExp(`^#?\\s*${varName}=.*$`, "m");

  if (regex.test(content)) {
    content = content.replace(regex, `${varName}=${newPassword}`);
  } else {
    content += `\n${varName}=${newPassword}`;
  }

  fs.writeFileSync(ENV_PATH, content.trim() + "\n", "utf8");
}

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

async function showCredentials() {
  console.log("===============================================================");
  console.log("  VeriCred Demo Account Credentials (Local Machine Only)");
  console.log("===============================================================");

  const passwords = readEnvPasswords();

  console.log(`\n1. Platform Administrator:`);
  console.log(`   Email:    ${DEMO_EMAILS.admin}`);
  console.log(`   Password: ${passwords.admin ? passwords.admin : "(Not configured in backend/.env)"}`);

  console.log(`\n2. Institutional Issuer:`);
  console.log(`   Email:    ${DEMO_EMAILS.issuer}`);
  console.log(`   Password: ${passwords.issuer ? passwords.issuer : "(Not configured in backend/.env)"}`);

  console.log(`\n3. Student Vault Holder:`);
  console.log(`   Email:    ${DEMO_EMAILS.student}`);
  console.log(`   Password: ${passwords.student ? passwords.student : "(Not configured in backend/.env)"}`);

  console.log("\n===============================================================");
  console.log("Tip: Use 'node src/scripts/manageDemoAccounts.js --reset <role>'");
  console.log("     to change any demo account password locally.");
  console.log("===============================================================\n");
}

async function resetPassword(targetRole) {
  const roleKey = (targetRole || "").toLowerCase().trim();
  const validRoles = {
    admin: { email: DEMO_EMAILS.admin, envVar: "BOOTSTRAP_ADMIN_PASSWORD", role: ROLES.ADMIN },
    issuer: { email: DEMO_EMAILS.issuer, envVar: "BOOTSTRAP_ISSUER_PASSWORD", role: ROLES.ISSUER },
    student: { email: DEMO_EMAILS.student, envVar: "BOOTSTRAP_STUDENT_PASSWORD", role: ROLES.HOLDER },
  };

  if (!validRoles[roleKey]) {
    console.error(`❌ Invalid role: '${targetRole}'. Must be one of: admin, issuer, student.`);
    process.exit(1);
  }

  const roleConfig = validRoles[roleKey];

  console.log("===============================================================");
  console.log(`  Reset Password for Demo Account: ${roleConfig.email}`);
  console.log("===============================================================");

  let newPass = "";
  while (newPass.length < 8) {
    newPass = await askPassword(`Enter new password for ${roleKey} (minimum 8 characters): `);
    if (newPass.length < 8) {
      console.log("⚠️ Password must be at least 8 characters. Please try again.");
    }
  }

  const connected = await connectDB();
  if (!connected) {
    console.error("❌ Failed to connect to MongoDB.");
    process.exit(1);
  }

  try {
    const user = await User.findOne({ email: roleConfig.email });
    if (!user) {
      console.error(`❌ User '${roleConfig.email}' not found in MongoDB.`);
      process.exit(1);
    }

    const newHash = await hashPassword(newPass);
    user.passwordHash = newHash;
    await user.save();

    updateEnvPassword(roleConfig.envVar, newPass);

    console.log(`✔ Successfully updated password for ${roleConfig.email} in MongoDB and backend/.env.`);
    console.log("===============================================================\n");
  } catch (err) {
    console.error("❌ Error updating password:", err.message);
  } finally {
    await disconnectDB();
  }
}

async function main() {
  const arg = (process.argv[2] || "").toLowerCase();

  if (arg === "--show" || arg === "-s" || arg === "show") {
    await showCredentials();
  } else if (arg === "--reset" || arg === "-r" || arg === "reset") {
    const roleArg = process.argv[3];
    if (!roleArg) {
      console.log("Usage: node src/scripts/manageDemoAccounts.js --reset <admin|issuer|student>");
      process.exit(1);
    }
    await resetPassword(roleArg);
  } else {
    console.log("VeriCred Demo Accounts Management Utility");
    console.log("Usage:");
    console.log("  node src/scripts/manageDemoAccounts.js --show              Display configured local credentials");
    console.log("  node src/scripts/manageDemoAccounts.js --reset <role>      Reset password for admin, issuer, or student");
  }
}

if (require.main === module) {
  main();
}

module.exports = { showCredentials, resetPassword, readEnvPasswords };

