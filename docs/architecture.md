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

