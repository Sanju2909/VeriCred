# Backend API, Cryptographic Engine & Blockchain Service

Complete RESTful API backend and cryptographic engine for the **Decentralized Digital Identity and Verifiable Credentials Platform**, built with Node.js, Express, MongoDB (Mongoose), ethers.js, ECDSA secp256k1 asymmetric cryptography, and RFC 8785 JSON Canonicalization.

---

## 🏛️ Architecture Overview

```text
backend/
├── src/
│   ├── config/
│   │   ├── contracts/
│   │   │   ├── CredentialRegistry.json # Exported contract ABI
│   │   │   └── IssuerRegistry.json     # Exported contract ABI
│   │   ├── db.js                      # MongoDB Mongoose connection & graceful fallback
│   │   └── environment.js             # Environment variable loader & validator
│   ├── controllers/
│   │   ├── authController.js          # Authentication & user profile handlers
│   │   ├── credentialController.js    # Issuance, verification & revocation handlers
│   │   └── userController.js          # User query & role management (Admin)
│   ├── middleware/
│   │   ├── authMiddleware.js          # JWT verification & RBAC authorization
│   │   ├── errorHandler.js            # Centralized JSON error format handler
│   │   ├── rateLimiter.js             # Brute-force & API DDoS protection
│   │   ├── requestLogger.js           # PII-redacted request logger
│   │   └── validateRequest.js         # express-validator interception
│   ├── models/
│   │   ├── User.js                    # User accounts, bcrypt password hash, DIDs, roles
│   │   ├── IssuerProfile.js           # Institutional profiles & on-chain addresses
│   │   ├── Credential.js              # Off-chain verifiable credentials & signatures
│   │   └── AuditEvent.js              # Security and authorization audit log
│   ├── routes/
│   │   ├── authRoutes.js              # /api/auth
│   │   ├── credentialRoutes.js        # /api/credentials
│   │   ├── healthRoutes.js            # /api/health
│   │   ├── userRoutes.js              # /api/users
│   │   └── index.js                   # Master router
│   ├── services/
│   │   ├── authService.js             # Registration, login, and JWT logic
│   │   ├── blockchainService.js       # Ethers.js contract interaction & on-chain checks
│   │   ├── credentialService.js       # Verifiable credential orchestration
│   │   ├── cryptoService.js           # Canonical hashing & ECDSA signing engine
│   │   └── keyManagerService.js       # Backend private key vault manager
│   ├── utils/
│   │   ├── apiResponse.js             # Standard response envelope utility
│   │   ├── canonicalize.js            # RFC 8785 JSON Canonicalization Scheme (JCS)
│   │   ├── jwtUtils.js                # HMAC-SHA256 JWT generation and verification
│   │   ├── logger.js                  # Sensitive data redaction logger
│   │   └── passwordUtils.js           # bcryptjs password hashing (12 rounds)
│   ├── validators/
│   │   ├── authValidators.js          # Auth input validation
│   │   └── credentialValidators.js    # Credential issuance & revocation validators
│   └── app.js                         # Express application configuration
├── tests/
│   ├── auth.test.js                   # Authentication & RBAC tests (17 tests)
│   ├── credential.test.js             # Credential lifecycle & access control tests (10 tests)
│   ├── crypto.test.js                 # Cryptographic canonicalization & ECDSA tests (8 tests)
│   └── health.test.js                 # Health endpoint & error handler tests (3 tests)
├── package.json
├── README.md
└── server.js                          # Server entry point with graceful shutdown
```

---

## 🔐 Cryptographic Architecture & Design

### 1. Canonical Representation (RFC 8785 JSON Canonicalization Scheme)
Standard `JSON.stringify` does not guarantee key ordering or numeric consistency across different runtimes. We implement **RFC 8785 (JCS)** in [`src/utils/canonicalize.js`](./src/utils/canonicalize.js):
- Object keys are deterministically sorted by UTF-16 code units.
- Whitespace is strictly eliminated.
- Numbers and strings follow uniform serialization.

### 2. Digital Signing Scheme (ECDSA secp256k1)
- **Hash Algorithm**: SHA-256 (NIST fingerprint) and Keccak-256 (EVM-compatible on-chain fingerprint).
- **Signature Scheme**: Elliptic Curve Digital Signature Algorithm (ECDSA) on curve `secp256k1` (`EcdsaSecp256k1Signature2019`).
- **Signature Verification**: Signature recovery extracts the public Ethereum address directly from the signed payload hash, verifying that it matches the authorized issuer address recorded on the blockchain.

### 3. W3C Verifiable Credential Structure
```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.org"
  ],
  "id": "urn:uuid:4c5e65c4-4be6-414b-ab7a-da6a24f393bb",
  "type": ["VerifiableCredential", "AcademicDegreeCredential"],
  "issuer": {
    "id": "did:ethr:0x5fbdb2315678afecb367f032d93f642f64180aa3",
    "name": "Metropolis University",
    "ethereumAddress": "0x5fbdb2315678afecb367f032d93f642f64180aa3"
  },
  "issuanceDate": "2026-10-10T11:00:00.000Z",
  "expirationDate": null,
  "credentialSubject": {
    "id": "did:mailto:alice@student.edu",
    "name": "Alice Sharma",
    "degree": "B.Sc. in Computer Science",
    "gpa": "3.92"
  },
  "proof": {
    "type": "EcdsaSecp256k1Signature2019",
    "created": "2026-10-10T11:00:00.000Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:ethr:0x5fbdb2315678afecb367f032d93f642f64180aa3#key-1",
    "proofValue": "0x..."
  }
}
```

---

## 📡 API Endpoints Specification

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | System uptime, environment, and DB status |
| `POST` | `/api/auth/register` | Public | Register new `HOLDER` or `VERIFIER` account |
| `POST` | `/api/auth/login` | Public | Authenticate credentials and receive JWT |
| `POST` | `/api/auth/logout` | Authenticated | Terminate session |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile |
| `GET` | `/api/users` | `ADMIN` Only | List users with pagination and role filter |
| `POST` | `/api/credentials` | `ISSUER`, `ADMIN` | Issue, sign, and anchor a new Verifiable Credential |
| `GET` | `/api/credentials` | Authenticated | List credentials accessible to current user role |
| `GET` | `/api/credentials/:id` | Authenticated | Retrieve single credential by ID |
| `POST` | `/api/credentials/verify` | Public | Verify signed credential payload (Signature + Chain) |
| `POST` | `/api/credentials/:id/verify` | Public | Verify stored credential by ID |
| `POST` | `/api/credentials/:id/revoke` | `ISSUER`, `ADMIN` | Revoke credential on-chain and in database |

---

## 🚀 Setup & Testing Instructions

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

### 2. Local Hardhat Node (Optional for live on-chain anchoring)
In a separate terminal:
```powershell
cd blockchain
npx.cmd hardhat node
npm.cmd run deploy:local
```
Copy the deployed contract addresses into `backend/.env`:
```ini
ISSUER_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
CREDENTIAL_REGISTRY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### 3. Run Automated Tests
Execute the full 40-test suite (offline in-memory DB):
```powershell
cd backend
npm.cmd test
```
Result: **40 passing tests (100% success rate)**.
