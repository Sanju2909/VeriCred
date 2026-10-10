# Decentralized Digital Identity & Verifiable Credentials Platform

## System Architecture & Technical Specifications

### 1. Overview
The platform addresses credential fraud and verification friction by combining:
1. **Decentralized Identifiers (DIDs)** & asymmetric cryptography for tamper-evident digital credentials.
2. **Ethereum / EVM Smart Contracts** for decentralized trust registry (authorized issuer management) and tamper-proof revocation status checking without disclosing private student data.
3. **Off-Chain Storage & Privacy**: Raw student PII (Personally Identifiable Information) is stored securely off-chain in MongoDB, while only cryptographic hashes (fingerprints) and issuer registry entries are anchored on-chain.

### 2. Core Stakeholders & Roles
- **Platform Admin (Governance)**: Approves verified academic institutions / issuers on the smart contract registry.
- **Issuer (Academic Institution / University)**: Signs structured credentials (W3C-compliant format) with their private key and records the credential hash on the blockchain registry.
- **Holder (Student / Graduate)**: Securely stores credentials, exports verifiable JSON presentations, and generates shareable QR codes / links.
- **Verifier (Employer / Third Party)**: Verifies cryptographic signatures, validates the issuer's authorization status on the blockchain, and checks on-chain revocation/expiration status.

### 3. Verification Workflow
```
[Issuer] --(Signs & Issues VC)--> [Student Vault]
   |                                    |
   +--(Anchors Hash on Registry)        +--(Presents Credential / QR)
   |                                    |
   v                                    v
[Smart Contract] <----------------- [Verifier / Employer]
(Verifies Issuer Status & Revocation)
```

### 4. Cryptographic Engine & Canonicalization (RFC 8785)
- **Deterministic Serialization**: Implements **RFC 8785 (JSON Canonicalization Scheme - JCS)** ensuring consistent key ordering and token serialization across JavaScript runtimes.
- **Digital Signing**: ECDSA on curve `secp256k1` (`EcdsaSecp256k1Signature2019`). Signatures are bound to the issuer's public Ethereum address.
- **Integrity Fingerprints**:
  - **SHA-256**: NIST-standard digest for off-chain verification.
  - **Keccak-256**: EVM-standard `bytes32` digest for smart contract on-chain anchoring.

### 5. Smart Contract Architecture (Solidity `^0.8.24`)
- **`IIssuerRegistry` & `IssuerRegistry.sol`**:
  - Maintains institutional identities, DIDs, approval status, and admin governance.
  - Public interface `isIssuerApproved(address)` enables dynamic authorization checks.
- **`CredentialRegistry.sol`**:
  - Anchors `bytes32 credentialHash`, issuance/expiration timestamps, and revocation state.
  - Multi-tier verification via `verifyCredential(bytes32 credentialId, bytes32 expectedHash)`:
    - `0`: `VALID`
    - `1`: `CREDENTIAL_NOT_FOUND`
    - `2`: `HASH_MISMATCH`
    - `3`: `CREDENTIAL_REVOKED`
    - `4`: `CREDENTIAL_EXPIRED`
    - `5`: `ISSUER_SUSPENDED`

### 6. Privacy & Data Minimization Principle
- **No PII on-chain**: Names, grades, roll numbers, or personal identifying attributes are **never** committed to Ethereum transactions or smart contract storage.
- **Deterministic Fingerprints**: Only cryptographic hashes of canonical JSON credential objects are anchored on-chain.
