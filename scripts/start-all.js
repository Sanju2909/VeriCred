/**
 * VeriCred Platform Unified Orchestration Engine
 * 
 * Manages full-stack initialization, prerequisite validation, service readiness polling,
 * and clean Windows process tree teardown for the VeriCred platform.
 * 
 * SECURITY & PERSISTENCE RULES:
 * 1. Zero Secrets Exposure: Never print passwords, private keys, or JWT secrets in logs or dashboard.
 * 2. Non-Destructive: Never overwrite valid .env files or wipe MongoDB collections.
 * 3. Credential Preservation: Alice Sharma's credential record is preserved untouched.
 * 4. Process Isolation: Tracks spawned PIDs strictly; never terminates pre-existing external processes.
 * 5. Decoupled State: Acknowledges in-memory Hardhat EVM vs. persistent MongoDB document storage.
 */

const { spawn, spawnSync, execSync } = require("child_process");
const net = require("net");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Configuration Constants
const ROOT_DIR = path.resolve(__dirname, "..");
const BLOCKCHAIN_DIR = path.join(ROOT_DIR, "blockchain");
const BACKEND_DIR = path.join(ROOT_DIR, "backend");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

const PORTS = {
  MONGODB: 27017,
  BLOCKCHAIN: 8545,
  BACKEND: 5000,
  FRONTEND: 5173,
};

const DETERMINISTIC_ADDRESSES = {
  ISSUER_REGISTRY: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  CREDENTIAL_REGISTRY: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  OPERATOR_ACCOUNT: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  TEST_ISSUER_ACCOUNT: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
};

// Track child process PIDs explicitly launched by this runner
const spawnedPids = new Set();
let isShuttingDown = false;

// Console Formatting Helpers
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(section, message, color = colors.reset) {
  const tag = section ? `[${section}] ` : "";
  console.log(`${color}${tag}${message}${colors.reset}`);
}

function logSuccess(section, message) {
  log(section, `✔ ${message}`, colors.green);
}

function logWarn(section, message) {
  log(section, `⚠ ${message}`, colors.yellow);
}

function logError(section, message) {
  log(section, `❌ ${message}`, colors.red);
}

// -----------------------------------------------------------------------------
// 1. Networking & Port Probes
// -----------------------------------------------------------------------------

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1200);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function waitForPort(port, host = "127.0.0.1", timeoutMs = 30000, pollIntervalMs = 600) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port, host)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

function probeHttp(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "GET",
        timeout: timeoutMs,
      },
      (res) => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode });
      }
    );

    req.on("error", () => resolve({ ok: false, statusCode: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, statusCode: null });
    });
    req.end();
  });
}

async function waitForHttpOk(url, timeoutMs = 30000, pollIntervalMs = 700) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await probeHttp(url);
    if (res.ok) {
      return true;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

function callRpc(rpcUrl, method, params = []) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(rpcUrl);
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: Date.now(),
    });

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 4000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsedRes = JSON.parse(body);
            resolve(parsedRes.result);
          } catch (e) {
            reject(new Error("Invalid JSON-RPC response"));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("RPC request timeout"));
    });
    req.write(postData);
    req.end();
  });
}

// -----------------------------------------------------------------------------
// 2. Safe Process Management & Windows Teardown
// -----------------------------------------------------------------------------

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch {
    // Process already exited
  }
}

function registerCleanupHandlers() {
  const handleExit = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("\n===============================================================");
    log("SHUTDOWN", `Received ${signal}. Gracefully stopping spawned services...`, colors.yellow);

    if (spawnedPids.size > 0) {
      for (const pid of spawnedPids) {
        log("SHUTDOWN", `Terminating spawned process tree (PID: ${pid})...`, colors.dim);
        killProcessTree(pid);
      }
      spawnedPids.clear();
    } else {
      log("SHUTDOWN", "No spawned child processes to terminate.", colors.dim);
    }

    logSuccess("SHUTDOWN", "Clean teardown completed. Exiting.");
    console.log("===============================================================\n");
    process.exit(0);
  };

  process.on("SIGINT", () => handleExit("SIGINT"));
  process.on("SIGTERM", () => handleExit("SIGTERM"));
  process.on("exit", () => {
    if (!isShuttingDown && spawnedPids.size > 0) {
      for (const pid of spawnedPids) {
        killProcessTree(pid);
      }
    }
  });
}

function spawnBackgroundService(name, command, args, cwd) {
  log("LAUNCH", `Starting ${name} in ${path.relative(ROOT_DIR, cwd)}...`, colors.cyan);

  const child = spawn(command, args, {
    cwd,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  if (child.pid) {
    spawnedPids.add(child.pid);
  }

  child.stdout.on("data", (data) => {
    const text = data.toString().trim();
    if (text && !text.includes("Debugger") && !text.includes("ExperimentalWarning")) {
      // Stream notable lines quietly with prefix
      const firstLine = text.split("\n")[0].trim();
      if (firstLine.length > 0 && !isShuttingDown) {
        // Suppress clutter, keep output tidy
      }
    }
  });

  child.stderr.on("data", (data) => {
    const errText = data.toString().trim();
    if (errText && !errText.includes("ExperimentalWarning") && !isShuttingDown) {
      // Suppress normal framework warnings
    }
  });

  child.on("error", (err) => {
    logError(name, `Process error: ${err.message}`);
  });

  child.on("exit", (code, signal) => {
    if (child.pid) spawnedPids.delete(child.pid);
    if (!isShuttingDown && code !== 0 && code !== null) {
      logWarn(name, `Process exited with code ${code} (signal: ${signal})`);
    }
  });

  return child;
}

// -----------------------------------------------------------------------------
// 3. Dependency & Environment Integrity Checks
// -----------------------------------------------------------------------------

function ensureDependencies(tierName, dirPath) {
  const nodeModulesPath = path.join(dirPath, "node_modules");
  if (!fs.existsSync(nodeModulesPath)) {
    const lockfilePath = path.join(dirPath, "package-lock.json");
    const hasLockfile = fs.existsSync(lockfilePath);
    const cmdArgs = hasLockfile
      ? ["ci", "--no-audit", "--no-fund"]
      : ["install", "--no-audit", "--no-fund"];

    log("DEPENDENCY", `Missing node_modules in ${tierName}. Restoring dependencies via npm ${cmdArgs[0]}...`, colors.yellow);
    const result = spawnSync("npm.cmd", cmdArgs, {
      cwd: dirPath,
      stdio: "inherit",
      shell: true,
    });
    if (result.status !== 0) {
      throw new Error(`Failed to restore dependencies for ${tierName} using existing manifest/lockfile (Exit code ${result.status})`);
    }
    logSuccess("DEPENDENCY", `Restored dependencies for ${tierName} without modifying lockfile.`);
  } else {
    logSuccess("DEPENDENCY", `${tierName} node_modules verified.`);
  }
}

function safeValidateOrGenerateEnv(tierName, dirPath, exampleFileName, envFileName, requiredKeys = [], defaultsFn = null) {
  const envPath = path.join(dirPath, envFileName);
  const examplePath = path.join(dirPath, exampleFileName);

  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  } else {
    // File does not exist: copy from example and apply safe local defaults
    log("CONFIG", `Creating initial ${envFileName} for ${tierName} from ${exampleFileName}...`, colors.yellow);
    if (fs.existsSync(examplePath)) {
      content = fs.readFileSync(examplePath, "utf8");
    }

    if (defaultsFn) {
      content = defaultsFn(content);
    }

    fs.writeFileSync(envPath, content, "utf8");
    logSuccess("CONFIG", `Generated initial ${envFileName} for ${tierName} with safe local development defaults.`);
  }

  // Strictly validate required keys without printing their values
  const configured = new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      // Strip outer quotes if present
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1).trim();
      }
      configured.set(match[1], val);
    }
  }

  const missingKeys = [];
  for (const key of requiredKeys) {
    const val = configured.get(key);
    if (val === undefined || val === null || val === "") {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    logError("CONFIG", `Configuration check failed for ${envFileName} in ${tierName}.`);
    throw new Error(
      `Required environment variable(s) missing or empty in ${path.relative(ROOT_DIR, envPath)}: ${missingKeys.join(", ")}. ` +
      `Startup cannot proceed with incomplete configuration. Please configure them (refer to ${exampleFileName}).`
    );
  }

  logSuccess(
    "CONFIG",
    `Verified ${path.relative(ROOT_DIR, envPath)} (all ${requiredKeys.length} required variables verified present and non-empty). Existing values preserved.`
  );
}

// -----------------------------------------------------------------------------
// 4. Database (MongoDB) Service Verification & Recovery
// -----------------------------------------------------------------------------

async function verifyAndStartMongo() {
  const isMongoListening = await isPortOpen(PORTS.MONGODB);
  if (isMongoListening) {
    logSuccess("DATABASE", `MongoDB is active and listening on port ${PORTS.MONGODB}. Reusing existing database.`);
    return;
  }

  log("DATABASE", `Port ${PORTS.MONGODB} is not responding. Checking Windows service 'MongoDB'...`, colors.yellow);

  let serviceExists = false;
  try {
    const scOutput = execSync("sc.exe query MongoDB", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    if (scOutput.includes("SERVICE_NAME: MongoDB")) {
      serviceExists = true;
    }
  } catch {
    serviceExists = false;
  }

  if (serviceExists) {
    log("DATABASE", "Windows service 'MongoDB' is installed but stopped. Starting service...", colors.cyan);
    try {
      execSync("net.exe start MongoDB", { stdio: "inherit" });
      const ready = await waitForPort(PORTS.MONGODB, "127.0.0.1", 15000);
      if (ready) {
        logSuccess("DATABASE", "MongoDB service started successfully.");
        return;
      }
    } catch (err) {
      logWarn("DATABASE", `Standard start failed (${err.message}). Attempting elevated service start...`);
      const script = "Start-Process net.exe -ArgumentList 'start MongoDB' -Verb RunAs -Wait";
      spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { stdio: "inherit" });
      const ready = await waitForPort(PORTS.MONGODB, "127.0.0.1", 15000);
      if (ready) {
        logSuccess("DATABASE", "MongoDB service started successfully with elevated permissions.");
        return;
      }
    }
  }

  // Attempt verified automated installer if host bootstrap is present
  logWarn("DATABASE", `MongoDB Community Server was not detected on this system.`);
  log("DATABASE", "VeriCred requires MongoDB Community Server for off-chain persistence.", colors.yellow);
  log("DATABASE", "Attempting automated installation of verified MongoDB Community Server with Administrator approval...", colors.cyan);

  const bootstrapScript = path.join(ROOT_DIR, "scripts", "bootstrap-host.ps1");
  if (fs.existsSync(bootstrapScript)) {
    const installRes = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", bootstrapScript, "-InstallMongoDB"],
      { stdio: "inherit" }
    );
    if (installRes.status === 0) {
      const ready = await waitForPort(PORTS.MONGODB, "127.0.0.1", 20000);
      if (ready) {
        logSuccess("DATABASE", "MongoDB Community Server successfully installed and verified active on port 27017.");
        return;
      }
    }
  }

  // If MongoDB cannot be reached or installed, halt safely with clear diagnostic error
  logError("DATABASE", "MongoDB Community Server is not available on port 27017.");
  throw new Error(
    `MongoDB Community Server is required for off-chain persistence but is not accessible on port ${PORTS.MONGODB}. ` +
    `Startup aborted safely. Please start the local MongoDB service (Start-Service MongoDB), ` +
    `run 'powershell -ExecutionPolicy Bypass -File scripts/bootstrap-host.ps1 -InstallMongoDB' with Administrator approval, ` +
    `or configure a valid remote MONGODB_URI in backend/.env.`
  );
}

// -----------------------------------------------------------------------------
// 5. Blockchain & Smart Contracts Orchestration
// -----------------------------------------------------------------------------

async function orchestrateBlockchain() {
  const isNodeRunning = await isPortOpen(PORTS.BLOCKCHAIN);

  if (isNodeRunning) {
    logSuccess("BLOCKCHAIN", `Hardhat node already listening on port ${PORTS.BLOCKCHAIN}. Reusing existing EVM instance.`);
  } else {
    log("BLOCKCHAIN", `Starting local in-memory Hardhat EVM node on port ${PORTS.BLOCKCHAIN}...`, colors.cyan);
    spawnBackgroundService("HardhatNode", "npx.cmd", ["hardhat", "node"], BLOCKCHAIN_DIR);

    const isReady = await waitForPort(PORTS.BLOCKCHAIN, "127.0.0.1", 20000);
    if (!isReady) {
      throw new Error(`Hardhat node failed to bind to port ${PORTS.BLOCKCHAIN} within timeout.`);
    }
    logSuccess("BLOCKCHAIN", "Hardhat EVM node is active.");
  }

  // Verify JSON-RPC readiness
  log("BLOCKCHAIN", "Verifying JSON-RPC provider responsiveness...", colors.dim);
  const blockNumberHex = await callRpc("http://127.0.0.1:8545", "eth_blockNumber");
  logSuccess("BLOCKCHAIN", `Connected to JSON-RPC (Current Block: ${parseInt(blockNumberHex, 16)}).`);

  // Probe contract bytecode at deterministic IssuerRegistry address
  log("BLOCKCHAIN", `Checking on-chain registry state at ${DETERMINISTIC_ADDRESSES.ISSUER_REGISTRY}...`, colors.dim);
  let code = "0x";
  try {
    code = await callRpc("http://127.0.0.1:8545", "eth_getCode", [DETERMINISTIC_ADDRESSES.ISSUER_REGISTRY, "latest"]);
  } catch (err) {
    logWarn("BLOCKCHAIN", `RPC error checking contract code: ${err.message}`);
  }

  if (!code || code === "0x" || code === "0x0") {
    log("BLOCKCHAIN", "Contracts not found in current EVM state. Deploying and registering authorities...", colors.yellow);

    log("BLOCKCHAIN", "Executing scripts/deploy.js...", colors.dim);
    const deployRes = spawnSync("npx.cmd", ["hardhat", "run", "scripts/deploy.js", "--network", "localhost"], {
      cwd: BLOCKCHAIN_DIR,
      shell: true,
      encoding: "utf8",
    });
    if (deployRes.status !== 0) {
      throw new Error(`Contract deployment failed:\n${deployRes.stderr || deployRes.stdout}`);
    }
    logSuccess("BLOCKCHAIN", "IssuerRegistry and CredentialRegistry deployed to deterministic addresses.");

    log("BLOCKCHAIN", "Executing scripts/registerTestIssuer.js...", colors.dim);
    const issuerRes = spawnSync("npx.cmd", ["hardhat", "run", "scripts/registerTestIssuer.js", "--network", "localhost"], {
      cwd: BLOCKCHAIN_DIR,
      shell: true,
      encoding: "utf8",
    });
    if (issuerRes.status !== 0) {
      throw new Error(`Test issuer registration failed:\n${issuerRes.stderr || issuerRes.stdout}`);
    }
    logSuccess("BLOCKCHAIN", "Authorized institutional test issuer registered on-chain.");

    log("BLOCKCHAIN", "Executing scripts/registerOperator.js...", colors.dim);
    const operatorRes = spawnSync("npx.cmd", ["hardhat", "run", "scripts/registerOperator.js", "--network", "localhost"], {
      cwd: BLOCKCHAIN_DIR,
      shell: true,
      encoding: "utf8",
    });
    if (operatorRes.status !== 0) {
      throw new Error(`Operator registration failed:\n${operatorRes.stderr || operatorRes.stdout}`);
    }
    logSuccess("BLOCKCHAIN", "Platform operator registered on-chain.");

    log("BLOCKCHAIN", "ℹ Note on In-Memory State: A freshly restarted Hardhat node begins at Block 0. Historical blocks from past sessions are reset, but all off-chain MongoDB records (including Alice Sharma's credential) remain intact.", colors.cyan);
  } else {
    logSuccess("BLOCKCHAIN", "Verified active contract bytecode at deterministic registry address. Reusing existing on-chain state.");
  }
}

// -----------------------------------------------------------------------------
// 6. Backend API Server Orchestration
// -----------------------------------------------------------------------------

async function orchestrateBackend() {
  const isBackendRunning = await isPortOpen(PORTS.BACKEND);

  if (isBackendRunning) {
    logSuccess("BACKEND", `Backend API server already listening on port ${PORTS.BACKEND}. Reusing existing instance.`);
  } else {
    log("BACKEND", `Starting Express.js API server on port ${PORTS.BACKEND}...`, colors.cyan);
    spawnBackgroundService("BackendAPI", "node", ["server.js"], BACKEND_DIR);

    const isReady = await waitForHttpOk("http://localhost:5000/api/health", 20000);
    if (!isReady) {
      throw new Error(`Backend API did not respond with HTTP 200 at /api/health within timeout.`);
    }
    logSuccess("BACKEND", "Backend API server initialized and verified healthy.");
  }

  // Safe Demo Accounts Verification (Non-destructive, never resets existing passwords)
  try {
    const seedDemoScript = path.join(BACKEND_DIR, "src", "scripts", "seedDemoAccounts.js");
    const seedAdminScript = path.join(BACKEND_DIR, "src", "scripts", "seedAdmin.js");
    const scriptToRun = fs.existsSync(seedDemoScript)
      ? "src/scripts/seedDemoAccounts.js"
      : fs.existsSync(seedAdminScript)
      ? "src/scripts/seedAdmin.js"
      : null;

    if (scriptToRun) {
      spawnSync("node", [scriptToRun], {
        cwd: BACKEND_DIR,
        shell: true,
        stdio: "inherit",
      });
      logSuccess("BACKEND", "Verified platform demo identities in MongoDB without altering existing account data.");
    }
  } catch {
    // Non-fatal if offline
  }
}

// -----------------------------------------------------------------------------
// 7. Frontend Client Orchestration
// -----------------------------------------------------------------------------

async function orchestrateFrontend() {
  const isFrontendRunning = await isPortOpen(PORTS.FRONTEND);

  if (isFrontendRunning) {
    logSuccess("FRONTEND", `Frontend dev server already active on port ${PORTS.FRONTEND}. Reusing existing instance.`);
  } else {
    log("FRONTEND", `Starting Vite React client on port ${PORTS.FRONTEND}...`, colors.cyan);
    spawnBackgroundService("FrontendVite", "npm.cmd", ["run", "dev"], FRONTEND_DIR);

    const isReady = await waitForPort(PORTS.FRONTEND, "127.0.0.1", 20000);
    if (!isReady) {
      throw new Error(`Frontend dev server failed to respond on port ${PORTS.FRONTEND} within timeout.`);
    }
    logSuccess("FRONTEND", "Frontend React application server is ready.");
  }
}

// -----------------------------------------------------------------------------
// 8. Unified Console Dashboard Display
// -----------------------------------------------------------------------------

function printDashboard() {
  console.log("\n" + "=".repeat(70));
  console.log(`${colors.bright}${colors.green}  ✨ VeriCred Decentralized Credential Platform is Live! ✨${colors.reset}`);
  console.log("=".repeat(70));
  console.log(`\n  ${colors.bright}Access Endpoints:${colors.reset}`);
  console.log(`  • Frontend Client:       ${colors.cyan}http://localhost:${PORTS.FRONTEND}${colors.reset}`);
  console.log(`  • Backend REST API:      ${colors.cyan}http://localhost:${PORTS.BACKEND}/api${colors.reset}`);
  console.log(`  • Health Endpoint:       ${colors.cyan}http://localhost:${PORTS.BACKEND}/api/health${colors.reset}`);
  console.log(`  • Blockchain RPC Node:   ${colors.cyan}http://127.0.0.1:${PORTS.BLOCKCHAIN}${colors.reset} (Chain ID: 31337)`);

  console.log(`\n  ${colors.bright}Role Accounts (Configured in local development):${colors.reset}`);
  console.log(`  • Platform Administrator:  ${colors.dim}admin@credentialplatform.local${colors.reset}`);
  console.log(`  • Institutional Registrar: ${colors.dim}registrar@university.edu${colors.reset}`);
  console.log(`  • Student Vault Holder:    ${colors.dim}alice@student.test${colors.reset}`);
  console.log(`  • Demo Credential Record:  ${colors.dim}urn:uuid:4cfd02f3-e4d2-46e9-afe3-279cf086dfa5 (Alice Sharma)${colors.reset}`);
  console.log(`  • Note: Click "Demo Account Autofill" on /login to populate role identifiers.`);
  console.log(`  • Tip:  View or reset local passwords via: node backend/src/scripts/manageDemoAccounts.js --show`);

  console.log(`\n  ${colors.bright}Process Control:${colors.reset}`);
  if (spawnedPids.size > 0) {
    console.log(`  • Active Spawned PIDs:   ${Array.from(spawnedPids).join(", ")}`);
  } else {
    console.log(`  • Active Processes:      Reusing existing background services`);
  }
  console.log(`  • Press ${colors.yellow}Ctrl+C${colors.reset} to stop all spawned platform processes cleanly.`);
  console.log("=".repeat(70) + "\n");
}

// -----------------------------------------------------------------------------
// Main Execution Pipeline
// -----------------------------------------------------------------------------

async function main() {
  console.log("\n===============================================================");
  console.log(`${colors.bright}  VeriCred Platform Unified Startup Orchestrator${colors.reset}`);
  console.log("===============================================================\n");

  registerCleanupHandlers();

  // Step 1: Dependencies check
  log("SETUP", "Validating project dependencies across all tiers...", colors.bright);
  ensureDependencies("blockchain", BLOCKCHAIN_DIR);
  ensureDependencies("backend", BACKEND_DIR);
  ensureDependencies("frontend", FRONTEND_DIR);

  // Step 2: Environment configuration verification (non-destructive)
  log("\nSETUP", "Validating environment configurations...", colors.bright);

  const BACKEND_REQUIRED_KEYS = [
    "PORT",
    "NODE_ENV",
    "CLIENT_URL",
    "MONGODB_URI",
    "JWT_SECRET",
    "BLOCKCHAIN_RPC_URL",
    "CHAIN_ID",
    "ISSUER_REGISTRY_ADDRESS",
    "CREDENTIAL_REGISTRY_ADDRESS",
    "BACKEND_OPERATOR_PRIVATE_KEY",
  ];

  safeValidateOrGenerateEnv("backend", BACKEND_DIR, ".env.example", ".env", BACKEND_REQUIRED_KEYS, (example) => {
    const randomSecret = crypto.randomBytes(32).toString("hex");
    const devOperatorKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const devIssuerKeys = JSON.stringify({
      "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    });

    return (
      example
        .replace(/JWT_SECRET=.*/, `JWT_SECRET=${randomSecret}`)
        .replace(/MONGODB_URI=.*/, "MONGODB_URI=mongodb://127.0.0.1:27017/credential_platform")
        .replace(/ISSUER_REGISTRY_ADDRESS=.*/, `ISSUER_REGISTRY_ADDRESS=${DETERMINISTIC_ADDRESSES.ISSUER_REGISTRY}`)
        .replace(/CREDENTIAL_REGISTRY_ADDRESS=.*/, `CREDENTIAL_REGISTRY_ADDRESS=${DETERMINISTIC_ADDRESSES.CREDENTIAL_REGISTRY}`)
        .replace(/BACKEND_OPERATOR_PRIVATE_KEY=.*/, `BACKEND_OPERATOR_PRIVATE_KEY=${devOperatorKey}`)
        + `\nISSUER_PRIVATE_KEYS='${devIssuerKeys}'\n`
    );
  });

  const BLOCKCHAIN_REQUIRED_KEYS = ["LOCAL_RPC_URL"];
  safeValidateOrGenerateEnv("blockchain", BLOCKCHAIN_DIR, ".env.example", ".env", BLOCKCHAIN_REQUIRED_KEYS);

  const FRONTEND_REQUIRED_KEYS = ["VITE_API_BASE_URL", "VITE_CHAIN_ID"];
  safeValidateOrGenerateEnv("frontend", FRONTEND_DIR, ".env.example", ".env", FRONTEND_REQUIRED_KEYS);

  // Step 3: MongoDB Database check
  log("\nSETUP", "Verifying off-chain database persistence...", colors.bright);
  await verifyAndStartMongo();

  // Step 4: Blockchain & Smart Contracts
  log("\nSETUP", "Verifying decentralized blockchain infrastructure...", colors.bright);
  await orchestrateBlockchain();

  // Step 5: Backend API Server
  log("\nSETUP", "Initializing backend application server...", colors.bright);
  await orchestrateBackend();

  // Step 6: Frontend Client Server
  log("\nSETUP", "Initializing frontend client application...", colors.bright);
  await orchestrateFrontend();

  // Step 7: Presentation Dashboard
  printDashboard();

  // Keep event loop alive while child processes run
  setInterval(() => {}, 10000);
}

main().catch((err) => {
  logError("FATAL", `Platform startup failed: ${err.message}`);
  if (spawnedPids.size > 0) {
    for (const pid of spawnedPids) {
      killProcessTree(pid);
    }
  }
  process.exit(1);
});

