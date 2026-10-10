# Decentralized Digital Identity and Verifiable Credentials Platform Using Blockchain

## 📌 Project Overview
The **Decentralized Digital Identity and Verifiable Credentials Platform** is a security-conscious, full-stack academic web application designed to eliminate credential fraud, streamline credential issuance, and enable instant, trustless verification.

By leveraging **W3C Verifiable Credentials standards**, **asymmetric cryptography (ECDSA)**, and **EVM Smart Contracts (Solidity)**, the platform establishes a decentralized trust model:
- **Issuers (Universities / Institutes)** issue tamper-evident digitally signed credentials and anchor their cryptographic fingerprints on the blockchain.
- **Holders (Students / Graduates)** store their credentials in a personal digital vault and share them via verifiable JSON payloads or QR codes.
- **Verifiers (Employers / Authorities)** verify credential authenticity, cryptographic signature integrity, issuer authorization on-chain, and check revocation/expiration status in real time.

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, JavaScript, CSS3 | Role-based dashboard interfaces & QR code viewer/scanner |
| **Backend** | Node.js, Express.js | REST API, role-based authentication, cryptographic signing engine |
| **Database** | MongoDB Atlas / Mongoose | Off-chain secure storage for user accounts and encrypted credential data |
| **Smart Contracts** | Solidity (`^0.8.20`) | On-chain Issuer Registry and Credential Revocation Registry |
| **Blockchain Dev** | Hardhat, ethers.js | Local EVM test environment, contract compilation, unit testing, and deployment |
| **Security & Auth** | JWT, bcrypt, ECDSA (elliptic curve cryptography) | Authentication, authorization, and cryptographic signature generation |

---

## 🏛️ System Architecture

```text
+-------------------------------------------------------------------------+
|                                FRONTEND                                 |
|                       (React + Vite Single-Page App)                    |
|  +--------------------+  +--------------------+  +-------------------+  |
|  |   Admin Portal     |  |   Issuer Portal    |  |  Student Vault    |  |
|  | (Manage Institutes)|  | (Issue/Revoke VCs) |  | (View/Share QR)   |  |
|  +--------------------+  +--------------------+  +-------------------+  |
|                                |                                        |
|                     +----------------------+                            |
|                     | Verifier Portal (QR) |                            |
|                     +----------------------+                            |
+-----------------------------------|-------------------------------------+
                                    | REST API & JSON Payloads
                                    v
+-------------------------------------------------------------------------+
|                                BACKEND                                  |
|                         (Node.js + Express)                             |
|  - JWT Authentication & Role-Based Access Control (RBAC)                |
|  - W3C Verifiable Credential Canonicalization & Signature Generation    |
|  - Cryptographic Hash Calculation (SHA-256 / Keccak-256)                |
|  - Ethers.js Blockchain Provider Service                                |
+------------------|-----------------------------------|------------------+
                   |                                   |
                   v                                   v
+----------------------------------+  +-----------------------------------+
|         OFF-CHAIN STORAGE        |  |        BLOCKCHAIN REGISTRY        |
|          (MongoDB Atlas)         |  |         (Hardhat / EVM)           |
|  - User Profiles (Roles)         |  |  1. IssuerRegistry.sol            |
|  - Encrypted Credential Records  |  |     (Authorizes valid issuers)    |
|  - Audit & Issuance Logs         |  |  2. CredentialRegistry.sol        |
|                                  |  |     (Anchors hashes & status)     |
+----------------------------------+  +-----------------------------------+
```

---

## 📋 Staged Development Plan

- [x] **Stage 1: Environment Baseline & Project Scaffolding**
  - Git repository initialization and `.gitignore` setup
  - Project directory structure (`frontend`, `backend`, `blockchain`, `docs`)
  - Configuration templates (`.env.example`) and architectural documentation
- [x] **Stage 2: Smart Contract Implementation & Testing (Solidity + Hardhat)**
  - `IssuerRegistry.sol` (Authority registration & revocation)
  - `CredentialRegistry.sol` (Credential hash anchoring, expiration, & revocation)
  - Comprehensive unit test suite with 100% contract coverage (29 passing tests)
  - Local deployment scripts
- [x] **Stage 3: Backend API & Cryptographic Engine (Node.js + Express + MongoDB)**
  - [x] Stage 3A: Backend Foundation, MongoDB Schemas, JWT Auth & RBAC (20 passing tests)
  - [x] Stage 3B: W3C Verifiable Credentials Signing, RFC 8785 Hashing & Smart Contract Service (40 passing tests)
- [ ] **Stage 4: Frontend Development (React + Vite)**
  - Role-specific portals (Admin, Issuer, Student, Verifier)
  - Interactive credential designer and batch issuance
  - Student wallet and QR code sharing
- [ ] **Stage 5: End-to-End Verification Pipeline**
  - QR code scanning and direct JSON credential upload
  - Multi-step cryptographic and on-chain verification workflow
- [ ] **Stage 6: Testing, Documentation, & Deployment Preparation**
  - Integration tests across frontend, backend, and smart contracts
  - Comprehensive academic project report & presentation assets

---

## ⚙️ Prerequisites & Setup Instructions

### Prerequisites
- **Node.js**: `v18+` (Tested on `v24.x`)
- **npm**: `v9+`
- **Git**: Installed and configured
- **MongoDB Atlas**: Free cluster account for off-chain database

### Initial Setup Steps
1. Clone the repository (or navigate to root directory).
2. Configure environment variables by copying `.env.example` templates:
   - `backend/.env.example` -> `backend/.env`
   - `blockchain/.env.example` -> `blockchain/.env`
   - `frontend/.env.example` -> `frontend/.env`

