# VeriCred: Complete Setup, Architecture & Demonstration Guide

**Project:** VeriCred Decentralized Digital Identity and Verifiable Credentials Platform  
**Target Environment:** Windows 10 / 11 (x64)  
**Standard Port Allocation:** Frontend (`5173`) | Backend API (`5000`) | Hardhat EVM (`8545`) | MongoDB (`27017`)

---

## 1. Quickstart: One-Command Launch

VeriCred provides a unified startup system that works on both pre-configured developer machines and brand-new Windows PCs:

### Option A: Standard Launch (When Node.js is already installed)
From the project root directory, run:
```bash
npm start
```
This triggers the unified orchestrator (`scripts/start-all.js`), which validates dependencies, checks database persistence, starts or reuses the blockchain node, deploys smart contracts if needed, launches the Express backend, boots the Vite frontend, and presents a status dashboard.

### Option B: Fresh Windows PC / Zero-Tooling Launch (No Node.js installed)
If you are running on a fresh Windows PC or extracted this project from a `.zip` archive without Node.js installed:
1. Double-click or run from Command Prompt / PowerShell:
   ```cmd
   start.bat
   ```
2. What happens automatically:
   - `start.bat` detects that `node.exe` is missing.
   - It requests Administrator permission via a standard Windows User Account Control (UAC) dialog.
   - It downloads the official signed Node.js LTS MSI from `nodejs.org`, verifies its Authenticode digital signature, and installs it quietly.
   - It refreshes system environment paths for the session.
   - It automatically launches `npm start` without requiring any second command.

---

## 2. Platform Architecture & Decoupled Persistence

VeriCred is built upon four decoupled tiers, each with distinct persistence models:

```
[ Layer 1: Persistent Off-Chain Storage ]
  └── MongoDB Community Server (Port 27017, Disk-Persisted Service)
        ├── User Accounts (Admin, Issuers, Students)
        └── Credential Records & Digital Signatures (e.g. Alice Sharma)
              │
[ Layer 2: Decentralized Trust Layer ]
  └── Local Hardhat EVM Node (Port 8545, In-Memory Ephemeral Chain, Chain ID 31337)
        ├── IssuerRegistry.sol (0x5FbDB2315678afecb367f032d93F642f64180aa3)
        └── CredentialRegistry.sol (0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512)
              │
[ Layer 3: Application Server & Cryptographic Engine ]
  └── Express.js REST API (Port 5000, http://localhost:5000/api)
        ├── W3C VC JSON-LD / RFC 8785 Canonical Hashing
        ├── ECDSA secp256k1 Signature Verification
        └── Health Endpoint (http://localhost:5000/api/health)
              │
[ Layer 4: Client Application ]
  └── React 18 / Vite SPA (Port 5173, http://localhost:5173)
        ├── Administrator Dashboard (/admin)
        ├── Institutional Issuer Dashboard (/issuer)
        ├── Student Digital Vault (/student)
        └── Public Verifier Portal (/verify)
```

### Important Architectural Note on Ephemeral vs. Persistent State:
- **MongoDB:** Persists user accounts and credentials across restarts on disk.
- **Hardhat Blockchain Node:** Operates **in-memory** for fast, deterministic local development. Whenever the Hardhat node process restarts, the EVM starts at Block 0.
- **Contract Redeployment:** When `start-all.js` detects a fresh Hardhat node, it automatically deploys `IssuerRegistry` and `CredentialRegistry` to deterministic addresses and registers the platform authorities. It does **not** alter or wipe historical records stored in MongoDB.

---

## 3. Demo Accounts & First-Run Authentication

VeriCred automatically provisions idempotent local development accounts upon first launch (preserving any existing accounts, credentials, and passwords without modification):

| Role | Demo Identifier | Sign-In Method | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Platform Administrator** | `admin@credentialplatform.local` | Autofill Button: **Admin** | User management, issuer onboarding, contract administration |
| **Institutional Issuer** | `registrar@university.edu` | Autofill Button: **Issuer** | Issue digitally signed W3C credentials, anchor hashes on-chain, revoke credentials |
| **Student Vault Holder** | `alice@student.test` | Autofill Button: **Student** | Access digital vault, inspect ECDSA proofs, export QR verification links |

> [!NOTE]
> **Demo Account Autofill & First-Run Setup:**
> - **Autofill Buttons:** The Login page (`/login`) provides **Demo Account Autofill** buttons that populate role email identifiers with a single click without embedding plaintext credentials in client bundles.
> - **First-Run Password Setup:** On a fresh database, the launcher prompts you to set your demonstration passwords (you can set one shared password for all accounts for convenience, or separate passwords). Passwords are saved strictly to your local `backend/.env`.
> - **Retrieval & Reset Utility:** To inspect or reset your local demo passwords at any time, run:
>   - View credentials: `node backend/src/scripts/manageDemoAccounts.js --show`
>   - Reset a password: `node backend/src/scripts/manageDemoAccounts.js --reset <admin|issuer|student>`

---

## 4. End-to-End Demonstration Walkthrough

### Demonstration 1: Verifying the Alice Sharma Demo Credential
VeriCred includes an authentic pre-seeded credential for demonstration:
- **Credential ID:** `urn:uuid:4cfd02f3-e4d2-46e9-afe3-279cf086dfa5`
- **Holder Name:** Alice Sharma
- **Degree:** Bachelor of Science in Computer Science
- **Issuing Authority:** State University of Technology

#### Steps to Verify:
1. Open your browser and navigate to:  
   `http://localhost:5173/verify?id=urn:uuid:4cfd02f3-e4d2-46e9-afe3-279cf086dfa5`
2. The verification engine will perform:
   - Stored record lookup in MongoDB.
   - RFC 8785 canonical hash computation.
   - ECDSA secp256k1 institutional digital signature recovery.
   - On-chain registry authority and revocation status check.
3. Observe the fail-closed status display and cryptographic proof inspection panel.

---

### Demonstration 2: Issuing a New Credential
1. Navigate to `http://localhost:5173/login`.
2. Sign in as the Institutional Issuer using the **Issuer** autofill button (or enter `registrar@university.edu`) and your configured password.
3. You will be redirected to the **Issuer Dashboard** (`/issuer`).
4. Click **Issue New Credential**:
   - Recipient Name: `Bob Smith`
   - Recipient Email: `bob.smith@student.edu`
   - Credential Type: `Degree`
   - Title: `Master of Science in Cybersecurity`
   - Grade / GPA: `3.90`
5. Click **Issue & Anchor Credential**:
   - The backend canonicalizes the claims via RFC 8785.
   - The issuer signs the hash using secp256k1 ECDSA.
   - The hash is anchored on the local blockchain (`CredentialRegistry.issueCredential`).
   - A success notification displays the new Credential ID and Transaction Hash.

---

### Demonstration 3: Student Vault & QR Code Verification
1. Log out and navigate to `http://localhost:5173/login`.
2. Sign in using the **Student** autofill button (`alice@student.test`) and your configured password, or register a new student account at `/register`.
3. View the **Student Vault** (`/student`):
   - Notice the credential appears in the student's personal vault.
   - Click **Inspect** to inspect the raw JSON claims and cryptographic proof.
   - Click **Share QR** to render an scannable QR code deep-linked to the public verification endpoint.
4. Open the deep-link in an incognito window:
   - Notice that public verifiers can verify validity and integrity without seeing unauthenticated private student PII.

---

### Demonstration 4: Credential Revocation & Post-Revocation Verification
1. Sign back in as the Institutional Registrar using the **Issuer** autofill button (`registrar@university.edu`).
2. Locate the issued credential in the issuance log.
3. Click **Revoke**, provide a reason (e.g., `Academic record audit correction`), and confirm.
4. The backend submits an on-chain revocation transaction to `CredentialRegistry.revokeCredential` and updates MongoDB.
5. Re-open the public verification link:
   - The status badge immediately updates to **REVOKED** (`isValid: false`, `status: "CREDENTIAL_REVOKED"`).
   - The revocation reason and timestamp are authoritatively verified.

---

## 5. Process Teardown & Troubleshooting

### Stopping the Platform Cleanly
Press **`Ctrl+C`** in the terminal running `npm start` or `start.bat`.
- The orchestrator traps the interrupt signal and terminates all child processes cleanly on Windows using `taskkill /pid <PID> /T /F`.
- Pre-existing external services (such as the MongoDB Windows service) are left running undisturbed.

### Common Troubleshooting Scenarios

1. **Port Conflicts (`EADDRINUSE`):**
   - The orchestrator automatically probes ports `27017`, `8545`, `5000`, and `5173`.
   - If a port is already occupied, it reuses the existing instance rather than crashing.
   - If an orphaned process is holding a port, you can identify and terminate it:
     ```powershell
     Get-NetTCPConnection -LocalPort 5000, 5173, 8545 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
     ```

2. **MongoDB Service Stopped:**
   - If port 27017 is unreachable:
     ```powershell
     Start-Service -Name MongoDB
     ```
   - If MongoDB Community Server is not installed:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts/bootstrap-host.ps1 -InstallMongoDB
     ```

3. **Fresh Blockchain Session & Historical Credentials:**
   - Because the local Hardhat node is in-memory, restarting the node resets the blockchain to Block 0.
   - Alice Sharma's credential in MongoDB will report valid ECDSA signature, valid off-chain record, but `CREDENTIAL_NOT_FOUND` on-chain. This is the intended fail-closed security behavior of Stage 7B.4.
   - New credentials issued during the active session will anchor and verify on-chain seamlessly.

---

## 6. Clean Distribution Packaging & Delivery to Another PC

### Creating the Clean Distribution Package
To generate a distribution folder and standalone ZIP archive for transferring VeriCred to another machine, run:
```bash
npm run dist
```

### What the Distribution Package Contains:
- Complete source code across all three tiers (`blockchain`, `backend`, `frontend`).
- Pre-compiled contract ABIs in `backend/src/config/contracts/`.
- Safe configuration templates (`.env.example`).
- Package manifests and lockfiles (`package.json`, `package-lock.json`).
- Root startup launcher (`start.bat`) and orchestration scripts (`scripts/`).
- Documentation and demo guides.

### What is Strictly Excluded for Security & Cleanliness:
- ❌ `.git/` history and repository metadata.
- ❌ All `node_modules/` folders (restored cleanly on target machine via lockfile).
- ❌ All real `.env` files, production secrets, or private keys.
- ❌ Build outputs, test results, logs, and cache artifacts (`dist/`, `artifacts/`, `cache/`, `test-results/`).

### Launching on the Target Windows PC:
1. Copy `VeriCred-Distribution.zip` to the target PC and extract it.
2. Open the extracted folder.
3. If Node.js is already installed:
   ```bash
   npm start
   ```
4. If Node.js is NOT installed:
   Double-click `start.bat`. It will prompt for Administrator consent, install official Node.js LTS silently, and launch `npm start`.
5. On first launch, the orchestrator automatically generates safe local development `.env` configurations from `.env.example`, restores exact dependencies via `package-lock.json`, ensures MongoDB is ready, deploys contracts to the local chain, and presents the live dashboard.

### Safe Demo Account vs. Production Security Notice:
- The default accounts (`admin@credentialplatform.local`, `registrar@university.edu`) are intended solely for local academic demonstration and testing.
- For production deployments, never use default credentials or in-memory signing keys. Real deployments require strong cryptographic keys stored in Hardware Security Modules (HSMs) or cloud key management services (AWS KMS / HashiCorp Vault), separate administrative credentials, and a secured production database cluster.

