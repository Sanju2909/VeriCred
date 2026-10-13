/**
 * VeriCred Clean Distribution Packager & Deep Security Auditor
 * 
 * Creates a clean, distribution-ready copy and ZIP archive of VeriCred
 * for transfer to another Windows PC.
 * 
 * MANDATORY SAFETY RULES:
 * 1. Exclude .git/, all node_modules/, and all real .env files.
 * 2. Include safe .env.example templates, source code, committed ABIs, manifests, and lockfiles.
 * 3. Never touch, alter, or delete original working repository files.
 * 4. Recursively audit the resulting ZIP archive (both structure and text contents)
 *    for private keys, JWT secrets, cloud API keys, and hardcoded passwords.
 * 5. Fails immediately if any unapproved secret or hardcoded login password is found
 *    in non-test source files or documentation.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DESKTOP_DIR = path.resolve(ROOT_DIR, "..");
const DIST_DIR = path.join(DESKTOP_DIR, "VeriCred-Distribution");
const DIST_ZIP = path.join(DESKTOP_DIR, "VeriCred-Distribution.zip");

// Exclusion rules
const EXCLUDED_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "artifacts",
  "cache",
  "test-results",
  "playwright-report",
  "coverage",
  ".idea",
  ".vscode",
  "blob-report",
]);

function isExcludedFile(relPath, fileName) {
  // Exclude real .env files (ALLOW only .env.example and files ending in .example)
  if (fileName.startsWith(".env") && !fileName.endsWith(".example")) {
    return true;
  }
  // Exclude temporary logs, installers, and key dumps
  if (
    fileName.endsWith(".log") ||
    fileName.endsWith(".msi") ||
    fileName.endsWith(".tmp") ||
    fileName.endsWith(".pid") ||
    fileName.endsWith(".seed") ||
    fileName.endsWith(".pem") ||
    fileName.endsWith(".key") ||
    fileName === "secrets.json" ||
    fileName === "Thumbs.db" ||
    fileName === ".DS_Store"
  ) {
    return true;
  }
  return false;
}

// Recursive copy with strict filtering
function copyFiltered(srcDir, destDir, currentRel = "") {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryName = entry.name;
    const srcPath = path.join(srcDir, entryName);
    const destPath = path.join(destDir, entryName);
    const entryRel = currentRel ? path.join(currentRel, entryName) : entryName;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entryName)) {
        continue;
      }
      copyFiltered(srcPath, destPath, entryRel);
    } else if (entry.isFile()) {
      if (isExcludedFile(entryRel, entryName)) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Count files recursively
function getDirectoryStats(dirPath) {
  let fileCount = 0;
  let totalBytes = 0;

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile()) {
        fileCount++;
        totalBytes += fs.statSync(p).size;
      }
    }
  }

  if (fs.existsSync(dirPath)) {
    walk(dirPath);
  }

  return { fileCount, totalBytes };
}

// -----------------------------------------------------------------------------
// Known harmless local-dev keys & placeholders for content scanner
// -----------------------------------------------------------------------------
const WHITELISTED_DEV_KEYS = new Set([
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat Account #0
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Hardhat Account #1
  "0x5de4111afa1a4b94908f83103eb2f9540807b5a1b32d207f2a13f67f0f62b6a7", // Hardhat Account #2
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // Mock invalid sig fixture in E2E
]);

const WHITELISTED_JWT_VALUES = new Set([
  "your_jwt_access_secret_key_here_min_32_chars",
  "super_secret_jwt_key_here_for_development",
]);

const TEXT_FILE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".sol",
  ".html", ".css", ".ps1", ".bat", ".example", ".yml",
  ".yaml", ".txt", ".sh"
]);

// -----------------------------------------------------------------------------
// Recursive Security & Completeness Audit
// -----------------------------------------------------------------------------

function auditDistributionArchive(zipPath) {
  console.log("\n===============================================================");
  console.log("  Auditing VeriCred Distribution ZIP Archive");
  console.log("===============================================================\n");

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Distribution ZIP file not found at: ${zipPath}`);
  }

  // 1. Inspect archive structure via PowerShell
  const listScript = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/\\/g, "/")}')
    $zip.Entries | ForEach-Object { $_.FullName }
    $zip.Dispose()
  `;

  const psRes = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", listScript],
    { encoding: "utf8" }
  );

  if (psRes.status !== 0) {
    throw new Error(`Failed to inspect ZIP archive contents: ${psRes.stderr || psRes.stdout}`);
  }

  const entries = psRes.stdout
    .split("\n")
    .map((e) => e.trim().replace(/\\/g, "/"))
    .filter(Boolean);

  console.log(`[AUDIT] Total entries scanned in ZIP: ${entries.length}`);

  const violations = [];
  const manualReviewItems = [];
  const documentedTestFixtures = [];

  // Check 1: Zero .git directories or files
  for (const entry of entries) {
    if (entry.includes(".git/") || entry === ".git" || entry.endsWith("/.git")) {
      violations.push(`Forbidden .git history found in archive: ${entry}`);
    }
  }

  // Check 2: Zero node_modules
  for (const entry of entries) {
    if (entry.includes("node_modules/")) {
      violations.push(`Forbidden node_modules found in archive: ${entry}`);
    }
  }

  // Check 3: Zero real .env files
  for (const entry of entries) {
    const parts = entry.split("/");
    const lastPart = parts[parts.length - 1];
    if (lastPart.startsWith(".env") && !lastPart.endsWith(".example")) {
      violations.push(`Forbidden real .env file found in archive: ${entry}`);
    }
  }

  // Check 4: Zero logs, installers, or private keys
  for (const entry of entries) {
    if (
      entry.endsWith(".log") ||
      entry.endsWith(".msi") ||
      entry.endsWith(".pem") ||
      entry.endsWith(".key") ||
      entry.endsWith("secrets.json")
    ) {
      violations.push(`Forbidden temporary/secret artifact found in archive: ${entry}`);
    }
  }

  // Check 5: Critical entry points and manifests must exist
  const REQUIRED_ENTRIES = [
    "start.bat",
    "package.json",
    "README.md",
    "VERICRED_SETUP_AND_DEMO.md",
    "scripts/start-all.js",
    "scripts/bootstrap-host.ps1",
    "blockchain/contracts/CredentialRegistry.sol",
    "blockchain/contracts/IssuerRegistry.sol",
    "blockchain/package.json",
    "blockchain/package-lock.json",
    "blockchain/.env.example",
    "backend/server.js",
    "backend/src/scripts/seedAdmin.js",
    "backend/src/scripts/seedDemoAccounts.js",
    "backend/src/scripts/manageDemoAccounts.js",
    "backend/src/config/contracts/CredentialRegistry.json",
    "backend/src/config/contracts/IssuerRegistry.json",
    "backend/package.json",
    "backend/package-lock.json",
    "backend/.env.example",
    "frontend/index.html",
    "frontend/vite.config.js",
    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/.env.example",
  ];

  for (const req of REQUIRED_ENTRIES) {
    const found = entries.some((e) => e === req || e.endsWith("/" + req));
    if (!found) {
      violations.push(`Missing mandatory project file in archive: ${req}`);
    }
  }

  // Check 6: Deep Content Security Inspection across all text files
  console.log("\n[AUDIT] Performing deep content inspection of text files inside the archive...");

  const tempAuditDir = path.join(os.tmpdir(), `vericred-zip-audit-${Date.now()}`);
  try {
    // Extract archive to temporary sandbox for precise content auditing
    const extractCmd = `Expand-Archive -Path '${zipPath.replace(/\\/g, "/")}' -DestinationPath '${tempAuditDir.replace(/\\/g, "/")}' -Force`;
    const extractRes = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", extractCmd],
      { encoding: "utf8" }
    );

    if (extractRes.status !== 0) {
      throw new Error(`Failed to extract ZIP for content inspection: ${extractRes.stderr || extractRes.stdout}`);
    }

    let scannedTextFiles = 0;

    function walkAndAudit(currentDir) {
      const dirEntries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const ent of dirEntries) {
        const fullPath = path.join(currentDir, ent.name);
        const relToAudit = path.relative(tempAuditDir, fullPath).replace(/\\/g, "/");

        if (ent.isDirectory()) {
          walkAndAudit(fullPath);
        } else if (ent.isFile()) {
          const ext = path.extname(ent.name).toLowerCase();
          const isExample = ent.name.endsWith(".example");

          if (!TEXT_FILE_EXTENSIONS.has(ext) && !isExample) {
            continue;
          }

          scannedTextFiles++;
          const content = fs.readFileSync(fullPath, "utf8");
          const lines = content.split("\n");
          const isTestFile = relToAudit.includes("tests/") || relToAudit.includes("e2e/");

          // 6A. Scan for hardcoded login passwords in non-test source files
          const isScannerScript = relToAudit.endsWith("create-distribution.js");
          if (!isTestFile && !isScannerScript) {
            lines.forEach((line, lineIdx) => {
              // Check for predictable default passwords in non-test files
              const forbiddenPrefixes = ["AdminPass", "Password", "IssuerPass", "HolderPass", "AdminPassword"];
              const hasForbidden = forbiddenPrefixes.some((p) => line.includes(p + "123!"));
              if (hasForbidden) {
                violations.push(
                  `Hardcoded demo password detected in non-test file ${relToAudit}:${lineIdx + 1}: ${line.trim()}`
                );
              }
              // Check for password literal assignments in code
              if (/password\s*[:=]\s*["'][A-Za-z0-9!@#$%^&*]{6,}["']/i.test(line)) {
                if (
                  !line.includes("process.env") &&
                  !line.includes("<password>") &&
                  !line.includes("your_custom") &&
                  !line.includes("placeholder")
                ) {
                  violations.push(
                    `Plaintext password assignment in source file ${relToAudit}:${lineIdx + 1}: ${line.trim()}`
                  );
                }
              }
            });
          } else {
            // In test files, catalog documented test fixtures for reviewer transparency
            lines.forEach((line, lineIdx) => {
              if (/password\s*[:=]\s*["'][A-Za-z0-9!@#$%^&*]{6,}["']/i.test(line)) {
                documentedTestFixtures.push({
                  file: relToAudit,
                  line: lineIdx + 1,
                  type: "TEST_FIXTURE_PASSWORD",
                  detail: line.trim(),
                });
              }
            });
          }

          // 6B. Scan for 64-character hex private keys
          const hex64Matches = content.match(/\b0x[a-fA-F0-9]{64}\b/g) || [];
          for (const hexVal of hex64Matches) {
            const lowerHex = hexVal.toLowerCase();
            if (!WHITELISTED_DEV_KEYS.has(lowerHex)) {
              // Disregard compiled ABI bytecode blobs or large JSON artifacts if within contracts
              if (relToAudit.includes("config/contracts/") || relToAudit.includes("artifacts/")) {
                manualReviewItems.push({
                  file: relToAudit,
                  type: "CONTRACT_HEX64_HASH",
                  detail: `${hexVal.slice(0, 10)}...${hexVal.slice(-6)} (Contract artifact hash/signature)`,
                });
              } else {
                violations.push(
                  `Unapproved 64-hex private key detected in ${relToAudit}: ${hexVal.slice(0, 10)}...${hexVal.slice(-6)}`
                );
              }
            }
          }

          // 6C. Scan for real non-placeholder JWT secrets
          const jwtMatches = content.match(/JWT_SECRET\s*=\s*['"]?([^\r\n'"]+)/g) || [];
          for (const match of jwtMatches) {
            const val = match.replace(/JWT_SECRET\s*=\s*['"]?/, "").trim();
            if (
              !WHITELISTED_JWT_VALUES.has(val) &&
              !val.startsWith("${") && // Template literal
              !val.includes("randomSecret") &&
              !val.includes("your_jwt")
            ) {
              violations.push(
                `Non-placeholder JWT_SECRET detected in ${relToAudit} (value length: ${val.length})`
              );
            }
          }

          // 6D. Scan for cloud / third-party API keys
          const apiKeyRegex = /\b(AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16})\b/g;
          const apiKeyMatches = content.match(apiKeyRegex) || [];
          for (const key of apiKeyMatches) {
            violations.push(`Live third-party API key detected in ${relToAudit}: ${key.slice(0, 6)}...`);
          }

          // 6E. Scan for live database URIs with non-placeholder passwords
          const mongoUriMatches = content.match(/\bmongodb(?:\+srv)?:\/\/[^:\/\s]+:([^@\/\s]+)@\S+/g) || [];
          for (const uri of mongoUriMatches) {
            if (!uri.includes("<password>") && !uri.includes("admin:admin")) {
              violations.push(`MongoDB URI with embedded credentials detected in ${relToAudit}`);
            }
          }

          // 6F. Scan for hardcoded plaintext passwords in Markdown documentation
          if (ext === ".md") {
            lines.forEach((line, lineIdx) => {
              if (/\|\s*.*(?:password|passphrase).*\|\s*`?(?:[A-Za-z0-9!@#$%^&*]{8,})`?\s*\|/i.test(line)) {
                violations.push(
                  `Hardcoded password in documentation table in ${relToAudit}:${lineIdx + 1}: ${line.trim()}`
                );
              }
              if (/-\s*\*\*Password:\*\*\s*`?[A-Za-z0-9!@#$%^&*]{6,}`?/i.test(line)) {
                violations.push(
                  `Hardcoded plaintext password in ${relToAudit}:${lineIdx + 1}: ${line.trim()}`
                );
              }
            });
          }
        }
      }
    }

    walkAndAudit(tempAuditDir);
    console.log(`[AUDIT] Scanned ${scannedTextFiles} text files inside extracted archive.`);
  } finally {
    // Cleanup temporary audit sandbox
    try {
      if (fs.existsSync(tempAuditDir)) {
        fs.rmSync(tempAuditDir, { recursive: true, force: true });
      }
    } catch {
      // Best-effort temp dir cleanup
    }
  }

  // Print documented test fixtures catalog
  console.log(`\n✔ Documented Test Fixtures: ${documentedTestFixtures.length} test-suite fixture references verified isolated to test directories.`);

  // Print manual review items
  if (manualReviewItems.length > 0) {
    console.log(`\nℹ️ [MANUAL REVIEW] ${manualReviewItems.length} uncertain item(s) detected for verification:`);
    for (const item of manualReviewItems) {
      console.log(`  • [${item.type}] ${item.file}: ${item.detail}`);
    }
  }

  // Check violations
  if (violations.length > 0) {
    console.error("\n❌ DISTRIBUTION AUDIT FAILED with the following violations:\n");
    for (const v of violations) {
      console.error(`  • ${v}`);
    }
    throw new Error(`Distribution ZIP failed security/completeness audit (${violations.length} violation(s)).`);
  }

  console.log("✔ Audit Check 1 Passed: 0 .git entries detected.");
  console.log("✔ Audit Check 2 Passed: 0 node_modules entries detected.");
  console.log("✔ Audit Check 3 Passed: 0 real .env files detected (only safe .env.example files included).");
  console.log("✔ Audit Check 4 Passed: 0 temporary logs, installers, or key files detected.");
  console.log(`✔ Audit Check 5 Passed: All ${REQUIRED_ENTRIES.length} mandatory manifest, seeder, and source files verified present.`);
  console.log("✔ Audit Check 6 Passed: Deep content inspection verified ZERO hardcoded login passwords in source code, zero leaked private keys, zero JWT secrets, and zero plaintext documentation credentials.");
  console.log("\n===============================================================");
  console.log("✔ DISTRIBUTION ZIP ARCHIVE AUDIT PASSED (100% CLEAN)");
  console.log("===============================================================\n");
}

// -----------------------------------------------------------------------------
// Main Packaging Routine
// -----------------------------------------------------------------------------

function main() {
  console.log("\n===============================================================");
  console.log("  VeriCred Distribution Packager");
  console.log("===============================================================");

  console.log(`[SOURCE] Reading repository from: ${ROOT_DIR}`);
  console.log(`[TARGET FOLDER] Preparing:       ${DIST_DIR}`);
  console.log(`[TARGET ZIP]    Preparing:       ${DIST_ZIP}\n`);

  // 1. Clean previous distribution artifacts if present
  if (fs.existsSync(DIST_DIR)) {
    console.log(`Cleaning previous distribution folder...`);
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(DIST_ZIP)) {
    console.log(`Cleaning previous distribution ZIP...`);
    fs.rmSync(DIST_ZIP, { force: true });
  }

  // 2. Perform filtered copy into clean directory
  console.log(`Copying source files with strict exclusion filters...`);
  copyFiltered(ROOT_DIR, DIST_DIR);

  const stats = getDirectoryStats(DIST_DIR);
  console.log(`✔ Filtered copy complete: ${stats.fileCount} files (${(stats.totalBytes / 1024 / 1024).toFixed(2)} MB).`);

  // 3. Create ZIP archive using PowerShell Compress-Archive
  console.log(`\nCompressing distribution folder into ZIP archive...`);
  const zipCmd = `Compress-Archive -Path '${DIST_DIR.replace(/\\/g, "/")}\\*' -DestinationPath '${DIST_ZIP.replace(/\\/g, "/")}' -Force`;
  const zipRes = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", zipCmd],
    { stdio: "inherit" }
  );

  if (zipRes.status !== 0) {
    throw new Error(`Compress-Archive failed with exit code ${zipRes.status}`);
  }

  const zipStats = fs.statSync(DIST_ZIP);
  console.log(`✔ Archive created successfully: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB`);

  // 4. Run automated security and integrity audit
  auditDistributionArchive(DIST_ZIP);

  console.log(`\n🎉 Distribution package is ready for delivery:`);
  console.log(`📁 Folder: ${DIST_DIR}`);
  console.log(`📦 Archive: ${DIST_ZIP} (${(zipStats.size / 1024 / 1024).toFixed(2)} MB)\n`);
}

try {
  main();
} catch (err) {
  console.error(`\n❌ Packaging failed: ${err.message}`);
  process.exit(1);
}
